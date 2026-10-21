import { assert, assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { actionCard, ActionCardIdSchema, StandardAction, Suit } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { isGate, planetOf, SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { MachineState } from '../definition/states.js'
import type { HydratedArcsGameState } from './gameState.js'
import { BuildingKind, StealTarget, TrophyKind } from './pieces.js'

// What a player chooses when using a Court card's Prelude action. Each card reads only the fields
// it needs: `steal` for the cards that steal, `system` for those that place ships, `actionCardId`
// for the Unions, and `discard` for resources given up (Relic Fence's cost, or what can't be held).
export type CardUse = Type.Static<typeof CardUse>
export const CardUse = Type.Object({
    cardId: Type.String(),
    system: Type.Optional(SystemIdSchema),
    steal: Type.Optional(Type.Array(StealTarget)),
    actionCardId: Type.Optional(ActionCardIdSchema),
    discard: Type.Optional(Type.Array(ResourceSchema))
})

export type CardUseResult = Type.Static<typeof CardUseResult>
export const CardUseResult = Type.Object({
    gained: Type.Array(ResourceSchema),
    stolen: Type.Array(Type.Union([ResourceSchema, Type.String()])),
    discarded: Type.Array(ResourceSchema),
    shipsPlaced: Type.Integer({ minimum: 0 }),
    seized: Type.Boolean()
})

// Interests gain their resource up to the empty slots, stealing it once the supply runs out.
const Interests: Partial<Record<string, Resource>> = {
    [Court.MiningInterest]: Resource.Material,
    [Court.ShippingInterest]: Resource.Fuel
}

// Cartels may be discarded to steal 1 of their resource.
const CartelSteals: Partial<Record<string, Resource>> = {
    [Court.MaterialCartel]: Resource.Material,
    [Court.FuelCartel]: Resource.Fuel
}

// Unions claim a face-up played card of their suit.
const Unions: Partial<Record<string, Suit>> = {
    [Court.AdminUnion]: Suit.Administration,
    [Court.ConstructionUnion]: Suit.Construction,
    [Court.SpacingUnion]: Suit.Mobilization,
    [Court.ArmsUnion]: Suit.Aggression
}

// Discard to place 3 ships in a system the player controls.
const Reinforcements: readonly string[] = [
    Court.PrisonWardens,
    Court.Skirmishers,
    Court.CourtEnforcers,
    Court.LoyalMarines
]

const ReinforcementShips = 3

const ElderBrokerGains = [Resource.Material, Resource.Fuel, Resource.Weapon]

function sameTarget(a: StealTarget, b: StealTarget): boolean {
    return a.playerId === b.playerId && a.slot === b.slot && a.cardId === b.cardId
}

// Rival slots holding the resource that the thief could steal.
function stealableResources(
    state: HydratedArcsGameState,
    thief: string,
    resource: Resource
): StealTarget[] {
    return state.players.flatMap((player) =>
        player.resources.flatMap((held, slot) => {
            const target = { playerId: player.playerId, slot }
            return held === resource && state.canSteal(thief, target) ? [target] : []
        })
    )
}

export function canUseCard(state: HydratedArcsGameState, playerId: string, use: CardUse): boolean {
    const turn = state.turn
    if (
        state.machineState !== MachineState.TakingActions ||
        turn?.playerId !== playerId ||
        !turn.prelude ||
        !state.holds(playerId, use.cardId) ||
        turn.securedInPrelude.includes(use.cardId)
    ) {
        return false
    }
    const player = state.getPlayerState(playerId)
    const steal = use.steal ?? []
    const discard = use.discard ?? []
    const only = (...fields: (keyof CardUse)[]) =>
        (['system', 'steal', 'actionCardId', 'discard'] as const).every(
            (field) => fields.includes(field) || use[field] === undefined
        )
    const interest = Interests[use.cardId]
    if (interest !== undefined) {
        const empty = player.emptySlots()
        const fromSupply = Math.min(empty, state.supplyAvailable(interest))
        const stealable = stealableResources(state, playerId, interest)
        const owed = Math.min(empty - fromSupply, stealable.length)
        return (
            only('steal') &&
            steal.length === owed &&
            steal.every(
                (target, index) =>
                    stealable.some((candidate) => sameTarget(candidate, target)) &&
                    steal.findIndex((other) => sameTarget(other, target)) === index
            )
        )
    }
    const cartel = CartelSteals[use.cardId]
    if (cartel !== undefined) {
        if (steal.length === 0) {
            return only()
        }
        const [target] = steal
        return (
            only('steal', 'discard') &&
            steal.length === 1 &&
            discard.length <= 1 &&
            state.canStealAndGain(playerId, target, discard[0]) &&
            state.getPlayerState(target.playerId).resources[target.slot ?? -1] === cartel
        )
    }
    const union = Unions[use.cardId]
    if (union !== undefined) {
        const claimed = use.actionCardId
        return (
            only('actionCardId') &&
            claimed !== undefined &&
            actionCard(claimed).suit === union &&
            state.round.plays.some((play) => play.cardId === claimed) &&
            !state.round.unions.some((other) => other.actionCardId === claimed)
        )
    }
    if (Reinforcements.includes(use.cardId)) {
        return (
            only('system') &&
            use.system !== undefined &&
            state.inPlay(use.system) &&
            state.controller(use.system) === playerId
        )
    }
    switch (use.cardId) {
        case Court.Gatekeepers:
            return only()
        case Court.LatticeSpies:
            return only() && !turn.acted
        case Court.SilverTongues: {
            if (steal.length === 0) {
                return only()
            }
            return (
                only('steal', 'discard') &&
                steal.length === 1 &&
                discard.length <= 1 &&
                state.canStealAndGain(playerId, steal[0], discard[0])
            )
        }
        case Court.ElderBroker: {
            const gains = ElderBrokerGains.filter((resource) => state.supplyAvailable(resource) > 0)
            return only('discard') && player.canGainAll(gains, discard)
        }
        case Court.RelicFence:
            return (
                only('discard') &&
                !turn.usedCards.includes(use.cardId) &&
                discard.length === 1 &&
                player.resourceCount(discard[0]) > 0
            )
        default:
            return false
    }
}

// Uses the card. Most are discarded to the Court discard pile; Relic Fence stays, once per turn,
// and a Union waits beside its claimed card until the round ends.
export function useCard(
    state: HydratedArcsGameState,
    playerId: string,
    use: CardUse
): CardUseResult {
    assert(canUseCard(state, playerId, use), `${playerId} cannot use ${use.cardId}`)
    const turn = state.currentTurn()
    turn.acted = true
    const player = state.getPlayerState(playerId)
    const result: CardUseResult = {
        gained: [],
        stolen: [],
        discarded: [],
        shipsPlaced: 0,
        seized: false
    }
    const steal = use.steal ?? []
    const discard = use.discard ?? []
    const placeShips = (id: SystemId, count: number) => {
        for (let index = 0; index < count && state.placeShipFromSupply(id, playerId); index++) {
            result.shipsPlaced += 1
        }
    }
    const takeStolen = (target: StealTarget, toDiscard?: Resource) => {
        const stolen = state.stealAndGain(playerId, target, toDiscard)
        const taken = stolen.resource ?? stolen.cardId
        if (taken !== undefined) {
            result.stolen.push(taken)
        }
        if (stolen.discarded !== undefined) {
            result.discarded.push(stolen.discarded)
        }
    }

    if (use.cardId === Court.RelicFence) {
        turn.usedCards.push(use.cardId)
    } else if (Unions[use.cardId] !== undefined && use.actionCardId !== undefined) {
        player.guildCards = player.guildCards.filter((cardId) => cardId !== use.cardId)
        state.round.unions.push({
            playerId,
            unionId: use.cardId,
            actionCardId: use.actionCardId
        })
        return result
    } else {
        player.guildCards = player.guildCards.filter((cardId) => cardId !== use.cardId)
        state.courtDiscard.push(use.cardId)
    }

    const interest = Interests[use.cardId]
    if (interest !== undefined) {
        const fromSupply = Math.min(player.emptySlots(), state.supplyAvailable(interest))
        state.supply[interest] -= fromSupply
        const gains = Array.from({ length: fromSupply }, () => interest)
        player.gainAll(gains, [])
        result.gained.push(...gains)
        for (const target of steal) {
            takeStolen(target)
        }
        return result
    }
    if (CartelSteals[use.cardId] !== undefined || use.cardId === Court.SilverTongues) {
        for (const target of steal) {
            takeStolen(target, discard[0])
        }
        return result
    }
    if (Reinforcements.includes(use.cardId) && use.system !== undefined) {
        placeShips(use.system, ReinforcementShips)
        return result
    }
    switch (use.cardId) {
        case Court.Gatekeepers:
            for (const system of state.systems) {
                if (isGate(system.id) && state.inPlay(system.id)) {
                    placeShips(system.id, 1)
                }
            }
            break
        case Court.LatticeSpies:
            if (state.canSeize(playerId)) {
                state.round.seizedBy = playerId
                result.seized = true
            }
            break
        case Court.ElderBroker: {
            const gains = ElderBrokerGains.filter((resource) => state.supplyAvailable(resource) > 0)
            for (const resource of gains) {
                state.supply[resource] -= 1
            }
            const kept = [...gains]
            for (const discarded of player.gainAll(gains, discard)) {
                state.supply[discarded] += 1
                result.discarded.push(discarded)
                const index = kept.indexOf(discarded)
                if (index >= 0) {
                    kept.splice(index, 1)
                }
            }
            result.gained.push(...kept)
            break
        }
        case Court.RelicFence: {
            player.removeResource(discard[0])
            state.supply[discard[0]] += 1
            result.discarded.push(discard[0])
            if (state.supplyAvailable(Resource.Relic) > 0) {
                state.supply[Resource.Relic] -= 1
                player.gainResource(Resource.Relic)
                result.gained.push(Resource.Relic)
            }
            break
        }
    }
    return result
}

// New actions that cards offer in place of a standard action (rule 8.2).
export enum NewActionName {
    Manufacture = 'manufacture',
    Synthesize = 'synthesize',
    Pressgang = 'pressgang',
    Execute = 'execute',
    Abduct = 'abduct',
    Trade = 'trade'
}

export const NewActions: Readonly<
    Record<NewActionName, { cardId: Court; replaces: StandardAction }>
> = {
    [NewActionName.Manufacture]: { cardId: Court.MiningInterest, replaces: StandardAction.Build },
    [NewActionName.Synthesize]: { cardId: Court.ShippingInterest, replaces: StandardAction.Build },
    [NewActionName.Pressgang]: { cardId: Court.PrisonWardens, replaces: StandardAction.Build },
    [NewActionName.Execute]: { cardId: Court.PrisonWardens, replaces: StandardAction.Influence },
    [NewActionName.Abduct]: { cardId: Court.CourtEnforcers, replaces: StandardAction.Battle },
    [NewActionName.Trade]: { cardId: Court.ElderBroker, replaces: StandardAction.Tax }
}

// The choices a new action takes: `discard` for what can't be held, `captives` (by owner) for
// Pressgang and Execute, `gains` for Pressgang, `courtCardId` for Abduct, and for Trade the Rival
// city at `system` and `slot` and the resource to `give`.
export type NewActionChoice = Type.Static<typeof NewActionChoice>
export const NewActionChoice = Type.Object({
    name: Type.Enum(NewActionName),
    discard: Type.Optional(Type.Array(ResourceSchema)),
    captives: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 1 }))),
    gains: Type.Optional(Type.Array(ResourceSchema)),
    courtCardId: Type.Optional(Type.String()),
    system: Type.Optional(SystemIdSchema),
    slot: Type.Optional(Type.Integer({ minimum: 0 })),
    give: Type.Optional(ResourceSchema)
})

export type NewActionResult = Type.Static<typeof NewActionResult>
export const NewActionResult = Type.Object({
    gained: Type.Array(ResourceSchema),
    discarded: Type.Array(ResourceSchema),
    captured: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
})

const NewActionGains: Partial<Record<NewActionName, Resource>> = {
    [NewActionName.Manufacture]: Resource.Material,
    [NewActionName.Synthesize]: Resource.Fuel
}

function capturesHeld(
    state: HydratedArcsGameState,
    playerId: string,
    captives: Readonly<Record<string, number>>
): boolean {
    const held = state.getPlayerState(playerId).captives
    return Object.entries(captives).every(([owner, count]) => count <= (held[owner] ?? 0))
}

// Whether the supply can give every gain (a Cartel's supply can't).
function supplyCovers(state: HydratedArcsGameState, gains: readonly Resource[]): boolean {
    return Object.values(Resource).every(
        (resource) =>
            gains.filter((gain) => gain === resource).length <= state.supplyAvailable(resource)
    )
}

// The action's own conditions; paying for it is checked separately.
export function canTakeNewAction(
    state: HydratedArcsGameState,
    playerId: string,
    choice: NewActionChoice
): boolean {
    if (!state.holds(playerId, NewActions[choice.name].cardId)) {
        return false
    }
    const player = state.getPlayerState(playerId)
    const discard = choice.discard ?? []
    const captives = choice.captives ?? {}
    const gains = choice.gains ?? []
    const gain = NewActionGains[choice.name]
    if (gain !== undefined) {
        return discard.length <= 1 && state.canGainFromSupply(playerId, gain, discard[0])
    }
    switch (choice.name) {
        case NewActionName.Pressgang: {
            const returned = Object.values(captives).reduce((sum, count) => sum + count, 0)
            return (
                capturesHeld(state, playerId, captives) &&
                gains.length === returned &&
                supplyCovers(state, gains) &&
                player.canGainAll(gains, discard)
            )
        }
        case NewActionName.Execute:
            return discard.length === 0 && capturesHeld(state, playerId, captives)
        case NewActionName.Abduct: {
            const slot = state.court.find((candidate) => candidate.cardId === choice.courtCardId)
            if (!slot) {
                return false
            }
            const rivals = Object.entries(slot.agents)
                .filter(([owner]) => owner !== playerId)
                .reduce((sum, [, count]) => sum + count, 0)
            return rivals > 0 && rivals < state.weaponIcons(playerId)
        }
        case NewActionName.Trade: {
            if (choice.system === undefined || choice.slot === undefined || !choice.give) {
                return false
            }
            const city = state.system(choice.system).slots[choice.slot]
            const planet = planetOf(choice.system)
            if (
                !city ||
                !planet ||
                city.kind !== BuildingKind.City ||
                city.owner === playerId ||
                state.controller(choice.system) !== playerId
            ) {
                return false
            }
            const rival = state.getPlayerState(city.owner)
            return (
                rival.resourceCount(planet.resource) > 0 &&
                rival.resourceCount(choice.give) === 0 &&
                player.resourceCount(choice.give) > 0
            )
        }
        default:
            return false
    }
}

export function takeNewAction(
    state: HydratedArcsGameState,
    playerId: string,
    choice: NewActionChoice
): NewActionResult {
    assert(canTakeNewAction(state, playerId, choice), `${playerId} cannot ${choice.name}`)
    const player = state.getPlayerState(playerId)
    const result: NewActionResult = { gained: [], discarded: [], captured: {} }
    const discard = choice.discard ?? []
    const captives = choice.captives ?? {}
    const gain = NewActionGains[choice.name]
    if (gain !== undefined) {
        const gained = state.gainFromSupply(playerId, gain, discard[0])
        if (gained.gained) {
            result.gained.push(gain)
        }
        if (gained.discarded !== undefined) {
            result.discarded.push(gained.discarded)
        }
        return result
    }
    switch (choice.name) {
        case NewActionName.Pressgang: {
            for (const [owner, count] of Object.entries(captives)) {
                player.releaseCaptives(owner, count)
                state.getPlayerState(owner).agents += count
            }
            const gains = choice.gains ?? []
            for (const resource of gains) {
                state.supply[resource] -= 1
            }
            for (const discarded of player.gainAll(gains, discard)) {
                state.supply[discarded] += 1
                result.discarded.push(discarded)
            }
            result.gained.push(...gains)
            break
        }
        case NewActionName.Execute:
            for (const [owner, count] of Object.entries(captives)) {
                player.releaseCaptives(owner, count)
                for (let index = 0; index < count; index++) {
                    player.trophies.push({ owner, kind: TrophyKind.Agent })
                }
            }
            break
        case NewActionName.Abduct: {
            const slot = state.courtSlot(choice.courtCardId ?? '')
            for (const [owner, count] of Object.entries(slot.agents)) {
                if (owner !== playerId) {
                    player.capture(owner, count)
                    result.captured[owner] = count
                    delete slot.agents[owner]
                }
            }
            break
        }
        case NewActionName.Trade: {
            const system = choice.system
            const give = choice.give
            assertExists(system, 'Trade names a system')
            assertExists(give, 'Trade names a resource to give')
            const city = state.building(system, choice.slot ?? 0)
            const taken = planetOf(system)?.resource
            assertExists(taken, 'Trade is at a planet')
            const rival = state.getPlayerState(city.owner)
            rival.removeResource(taken)
            player.removeResource(give)
            rival.gainResource(give)
            player.gainResource(taken)
            result.gained.push(taken)
            break
        }
    }
    return result
}
