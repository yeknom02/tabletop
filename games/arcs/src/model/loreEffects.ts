import { assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Ambition, AmbitionSchema } from '../components/actionCards.js'
import { Lore } from '../components/personas.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { MachineState } from '../definition/states.js'
import { VoxChoice, VoxResult } from './courtEffects.js'
import { canAffordDeclaration } from './declaration.js'
import type { HydratedArcsGameState } from './gameState.js'
import { Trophy } from './pieces.js'

// What a player chooses when using a lore card's Prelude ability. `clear` discards the card to
// clear Outrage; otherwise the card's other ability uses the fields it needs.
export type LoreUse = Type.Static<typeof LoreUse>
export const LoreUse = Type.Object({
    cardId: Type.String(),
    clear: Type.Optional(Type.Boolean()),
    // Tycoon's Charm: a Material or Fuel to discard, and the resource gained for it.
    discard: Type.Optional(ResourceSchema),
    gain: Type.Optional(ResourceSchema),
    // Warlord's Terror: a Trophy returned, and the Court card influenced for it.
    trophy: Type.Optional(Trophy),
    influence: Type.Optional(Type.String()),
    // Tyrant's Ego: a Captive returned (by owner), and the Court card secured for it.
    captive: Type.Optional(Type.String()),
    secure: Type.Optional(Type.String()),
    vox: Type.Optional(VoxChoice),
    // Tycoon's Ambition: the undeclared ambition to declare.
    ambition: Type.Optional(AmbitionSchema)
})

export type LoreUseResult = Type.Static<typeof LoreUseResult>
export const LoreUseResult = Type.Object({
    discarded: Type.Array(ResourceSchema),
    captured: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 0 }))),
    vox: Type.Optional(VoxResult)
})

// Lore discarded in the Prelude to clear Outrage of these resources.
const OutrageClears: Partial<Record<string, readonly Resource[]>> = {
    [Lore.EmpathsVision]: [Resource.Psionic],
    [Lore.KeepersTrust]: [Resource.Relic],
    [Lore.WarlordsCruelty]: [Resource.Weapon],
    [Lore.TyrantsEgo]: [Resource.Weapon],
    [Lore.TycoonsCharm]: [Resource.Material, Resource.Fuel]
}

const LoreFields = [
    'clear',
    'discard',
    'gain',
    'trophy',
    'influence',
    'captive',
    'secure',
    'vox',
    'ambition'
] as const

const CharmResources: readonly Resource[] = [Resource.Material, Resource.Fuel]

export function canUseLore(state: HydratedArcsGameState, playerId: string, use: LoreUse): boolean {
    const turn = state.turn
    if (
        state.machineState !== MachineState.TakingActions ||
        turn?.playerId !== playerId ||
        !turn.prelude ||
        !state.getPlayerState(playerId).lore.includes(use.cardId)
    ) {
        return false
    }
    const only = (...fields: (typeof LoreFields)[number][]) =>
        LoreFields.every((field) => fields.includes(field) || use[field] === undefined)
    const player = state.getPlayerState(playerId)
    if (use.clear) {
        return only('clear') && OutrageClears[use.cardId] !== undefined
    }
    switch (use.cardId) {
        case Lore.TycoonsCharm:
            return (
                only('discard', 'gain') &&
                state.isDeclared(Ambition.Tycoon) &&
                use.discard !== undefined &&
                use.gain !== undefined &&
                CharmResources.includes(use.discard) &&
                player.resourceCount(use.discard) > 0 &&
                state.availableGains([use.gain]).length === 1
            )
        case Lore.WarlordsTerror: {
            const trophy = use.trophy
            return (
                only('trophy', 'influence') &&
                state.isDeclared(Ambition.Warlord) &&
                trophy !== undefined &&
                player.trophies.some(
                    (held) => held.owner === trophy.owner && held.kind === trophy.kind
                ) &&
                use.influence !== undefined &&
                state.canInfluence(playerId, use.influence)
            )
        }
        case Lore.TyrantsEgo:
            return (
                only('captive', 'secure', 'vox') &&
                state.isDeclared(Ambition.Tyrant) &&
                use.captive !== undefined &&
                (player.captives[use.captive] ?? 0) > 0 &&
                use.secure !== undefined &&
                state.canSecure(playerId, use.secure, use.vox)
            )
        case Lore.TycoonsAmbition:
            return (
                only('ambition') &&
                !turn.acted &&
                state.isDeclared(Ambition.Tycoon) &&
                use.ambition !== undefined &&
                !state.isDeclared(use.ambition) &&
                state.availableMarker() !== undefined &&
                canAffordDeclaration(state, playerId)
            )
        default:
            return false
    }
}

export function useLore(
    state: HydratedArcsGameState,
    playerId: string,
    use: LoreUse
): LoreUseResult {
    assert(canUseLore(state, playerId, use), `${playerId} cannot use ${use.cardId}`)
    const turn = state.currentTurn()
    turn.acted = true
    const player = state.getPlayerState(playerId)
    const result: LoreUseResult = { discarded: [] }
    if (use.clear) {
        player.lore = player.lore.filter((cardId) => cardId !== use.cardId)
        for (const resource of OutrageClears[use.cardId] ?? []) {
            if (player.outrage.includes(resource)) {
                player.outrage = player.outrage.filter((outraged) => outraged !== resource)
                player.agents += 1
            }
        }
        return result
    }
    switch (use.cardId) {
        case Lore.TycoonsCharm: {
            assertExists(use.discard, 'Charm discards a resource')
            assertExists(use.gain, 'Charm gains a resource')
            player.removeResource(use.discard)
            state.supply[use.discard] += 1
            result.discarded.push(use.discard)
            state.gainAllFromSupply(playerId, [use.gain], [])
            break
        }
        case Lore.WarlordsTerror: {
            const trophy = use.trophy
            assertExists(trophy, 'Terror spends a Trophy')
            assertExists(use.influence, 'Terror influences a card')
            const index = player.trophies.findIndex(
                (held) => held.owner === trophy.owner && held.kind === trophy.kind
            )
            player.trophies.splice(index, 1)
            state.returnPiece(trophy.owner, trophy.kind)
            state.influence(playerId, use.influence)
            break
        }
        case Lore.TyrantsEgo: {
            assertExists(use.captive, 'Ego spends a Captive')
            assertExists(use.secure, 'Ego secures a card')
            player.releaseCaptives(use.captive, 1)
            state.getPlayerState(use.captive).agents += 1
            const secured = state.secure(playerId, use.secure, use.vox)
            result.captured = secured.taken
            if (secured.vox) {
                result.vox = secured.vox
            }
            break
        }
        case Lore.TycoonsAmbition: {
            assertExists(use.ambition, 'Tycoon’s Ambition declares an ambition')
            for (const [slot, held] of player.resources.entries()) {
                if (held !== null && CharmResources.includes(held)) {
                    player.resources[slot] = null
                    state.supply[held] += 1
                    result.discarded.push(held)
                }
            }
            state.declareAmbition(use.ambition, playerId)
            break
        }
    }
    return result
}
