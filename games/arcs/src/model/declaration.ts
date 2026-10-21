import { assert, assertExists, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { ActionCardIdSchema, AmbitionSchema } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Leader } from '../components/personas.js'
import { Resource } from '../components/resources.js'
import { isVox, resolveVox, type VoxChoice, type VoxResult } from './courtEffects.js'
import type { HydratedArcsGameState } from './gameState.js'

// What declaring an ambition sets off, resolved in this order before play goes on.
export enum DeclareStep {
    // Feastbringer, Generous: give 1 Guild card to the Rival with the least Power.
    Generous = 'generous',
    // Noble, Connected: secure the top card of the Court deck, for an undeclared ambition.
    Connected = 'connected',
    // Upstart, Ambitious: gain any resource.
    Ambitious = 'ambitious',
    // Demagogue, Bold: influence any number of Court cards once each.
    Bold = 'bold',
    // Farseers: look at a Rival's hand, then swap a card with them or not.
    Farsee = 'farsee',
    Swap = 'swap'
}

export type Declaration = Type.Static<typeof Declaration>
export const Declaration = Type.Object({
    playerId: Type.String(),
    ambition: AmbitionSchema,
    steps: Type.Array(Type.Enum(DeclareStep)),
    // Connected: the Vox card drawn, waiting for its When Secured choices.
    drawn: Type.Optional(Type.String()),
    // Farseers: the Rival whose hand the declarer sees, which nobody else does.
    rival: Type.Optional(Type.String()),
    rivalHand: Type.Optional(
        Visibility.protect(Type.Array(ActionCardIdSchema), { policy: Visibility.Policy.Owner })
    )
})

// Feastbringer, Generous: declaring costs a Guild card, so it needs one.
export function canAffordDeclaration(state: HydratedArcsGameState, playerId: string): boolean {
    return (
        !state.isLeader(playerId, Leader.Feastbringer) ||
        state.getPlayerState(playerId).guildCards.length > 0
    )
}

export function stepsOnDeclaring(
    state: HydratedArcsGameState,
    playerId: string,
    wasDeclared: boolean
): DeclareStep[] {
    const steps: DeclareStep[] = []
    if (state.isLeader(playerId, Leader.Feastbringer)) {
        steps.push(DeclareStep.Generous)
    }
    if (state.isLeader(playerId, Leader.Noble) && !wasDeclared) {
        steps.push(DeclareStep.Connected)
    }
    if (state.isLeader(playerId, Leader.Upstart)) {
        steps.push(DeclareStep.Ambitious)
    }
    if (state.isLeader(playerId, Leader.Demagogue)) {
        steps.push(DeclareStep.Bold)
    }
    if (state.holds(playerId, Court.Farseers) && state.players.length > 1) {
        steps.push(DeclareStep.Farsee, DeclareStep.Swap)
    }
    return steps
}

export function currentStep(state: HydratedArcsGameState): DeclareStep | undefined {
    return state.declaration?.steps[0]
}

function isStep(state: HydratedArcsGameState, playerId: string, step: DeclareStep): boolean {
    return state.declaration?.playerId === playerId && currentStep(state) === step
}

function finishStep(state: HydratedArcsGameState) {
    const declaration = state.declaration
    assertExists(declaration, 'No declaration is being resolved')
    declaration.steps.shift()
    if (declaration.steps.length === 0) {
        state.declaration = undefined
    }
}

// ----- Generous -----

export function leastPowerfulRivals(state: HydratedArcsGameState, playerId: string): string[] {
    const rivals = state.players.filter((player) => player.playerId !== playerId)
    const least = Math.min(...rivals.map((player) => player.power))
    return rivals.filter((player) => player.power === least).map((player) => player.playerId)
}

export function canGiveGuildCard(
    state: HydratedArcsGameState,
    playerId: string,
    cardId: string,
    to: string
): boolean {
    return (
        isStep(state, playerId, DeclareStep.Generous) &&
        state.holds(playerId, cardId) &&
        leastPowerfulRivals(state, playerId).includes(to)
    )
}

export function giveGuildCard(
    state: HydratedArcsGameState,
    playerId: string,
    cardId: string,
    to: string
) {
    assert(canGiveGuildCard(state, playerId, cardId, to), `${playerId} cannot give ${cardId}`)
    const player = state.getPlayerState(playerId)
    player.guildCards = player.guildCards.filter((held) => held !== cardId)
    state.getPlayerState(to).guildCards.push(cardId)
    finishStep(state)
}

// ----- Connected -----

export function awaitsConnectedDraw(state: HydratedArcsGameState): boolean {
    return currentStep(state) === DeclareStep.Connected && state.declaration?.drawn === undefined
}

// Draws the top card of the Court deck and secures it. A Guild card is simply taken; a Vox card
// waits for its When Secured choices. Its Prelude action can't be used this turn.
export function connectedDraw(state: HydratedArcsGameState): string | undefined {
    const declaration = state.declaration
    assertExists(declaration, 'No declaration is being resolved')
    if (state.courtDeck.count() === 0) {
        finishStep(state)
        return undefined
    }
    const cardId = state.courtDeck.draw()
    state.turn?.securedInPrelude.push(cardId)
    if (isVox(cardId)) {
        declaration.drawn = cardId
    } else {
        state.getPlayerState(declaration.playerId).guildCards.push(cardId)
        finishStep(state)
    }
    return cardId
}

export function canResolveConnected(
    state: HydratedArcsGameState,
    playerId: string,
    vox?: VoxChoice
): boolean {
    const drawn = state.declaration?.drawn
    return (
        isStep(state, playerId, DeclareStep.Connected) &&
        drawn !== undefined &&
        state.canChooseWhenSecured(playerId, drawn, vox)
    )
}

export function resolveConnected(
    state: HydratedArcsGameState,
    playerId: string,
    vox?: VoxChoice
): VoxResult {
    assert(canResolveConnected(state, playerId, vox), `${playerId} cannot resolve that`)
    const declaration = state.declaration
    assertExists(declaration?.drawn, 'A card was drawn')
    const cardId = declaration.drawn
    declaration.drawn = undefined
    finishStep(state)
    // Resolving it may declare again (Populist Demands), queueing more steps.
    return resolveVox(state, playerId, cardId, vox)
}

// ----- Ambitious -----

export function canGainOnDeclaring(
    state: HydratedArcsGameState,
    playerId: string,
    resource: Resource | undefined,
    discard: readonly Resource[]
): boolean {
    if (!isStep(state, playerId, DeclareStep.Ambitious)) {
        return false
    }
    return resource === undefined
        ? discard.length === 0
        : state.canGainAllFromSupply(playerId, [resource], discard)
}

export function gainOnDeclaring(
    state: HydratedArcsGameState,
    playerId: string,
    resource: Resource | undefined,
    discard: readonly Resource[]
): Resource[] {
    assert(canGainOnDeclaring(state, playerId, resource, discard), `${playerId} cannot gain that`)
    const gained =
        resource === undefined ? [] : state.gainAllFromSupply(playerId, [resource], discard).gained
    finishStep(state)
    return gained
}

// ----- Bold -----

export function canBoldInfluence(
    state: HydratedArcsGameState,
    playerId: string,
    cardIds: readonly string[]
): boolean {
    return (
        isStep(state, playerId, DeclareStep.Bold) &&
        new Set(cardIds).size === cardIds.length &&
        cardIds.length <= state.getPlayerState(playerId).agents &&
        cardIds.every((cardId) => state.court.some((slot) => slot.cardId === cardId))
    )
}

export function boldInfluence(
    state: HydratedArcsGameState,
    playerId: string,
    cardIds: readonly string[]
) {
    assert(canBoldInfluence(state, playerId, cardIds), `${playerId} cannot influence those`)
    for (const cardId of cardIds) {
        state.influence(playerId, cardId)
    }
    finishStep(state)
}

// ----- Farseers -----

export function canFarsee(state: HydratedArcsGameState, playerId: string, rival: string): boolean {
    return (
        isStep(state, playerId, DeclareStep.Farsee) &&
        rival !== playerId &&
        state.turnManager.turnOrder.includes(rival)
    )
}

export function farsee(state: HydratedArcsGameState, playerId: string, rival: string) {
    assert(canFarsee(state, playerId, rival), `${playerId} cannot look at ${rival}'s hand`)
    const declaration = state.declaration
    assertExists(declaration, 'No declaration is being resolved')
    declaration.rival = rival
    declaration.rivalHand = [...state.getPlayerState(rival).knownHand()]
    finishStep(state)
}

// Both cards or neither.
export function canSwapWithRival(
    state: HydratedArcsGameState,
    playerId: string,
    give?: string,
    take?: string
): boolean {
    const rival = state.declaration?.rival
    if (!isStep(state, playerId, DeclareStep.Swap) || rival === undefined) {
        return false
    }
    if (give === undefined || take === undefined) {
        return give === take
    }
    return (
        state.getPlayerState(playerId).hasInHand(give) &&
        state.getPlayerState(rival).hasInHand(take)
    )
}

export function swapWithRival(
    state: HydratedArcsGameState,
    playerId: string,
    give?: string,
    take?: string
) {
    assert(canSwapWithRival(state, playerId, give, take), `${playerId} cannot swap those`)
    const declaration = state.declaration
    assertExists(declaration?.rival, 'A Rival was chosen')
    if (give !== undefined && take !== undefined) {
        const player = state.getPlayerState(playerId)
        const other = state.getPlayerState(declaration.rival)
        player.removeFromHand(give)
        other.removeFromHand(take)
        player.takeIntoHand([take])
        other.takeIntoHand([give])
    }
    declaration.rival = undefined
    declaration.rivalHand = undefined
    finishStep(state)
}
