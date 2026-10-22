import { assert } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Lore } from '../components/personas.js'
import { canTakeCourtAction, takeCourtAction } from './courtEffects.js'
import type { HydratedArcsGameState } from './gameState.js'
import { canTakeLoreAction, takeLoreAction } from './loreActions.js'
import { NewActionName, type NewActionChoice, type NewActionResult } from './newActionTypes.js'

// Each new action: the card that gives it, and the standard action it is taken in place of.
export const NewActions: Readonly<
    Record<NewActionName, { cardId: string; lore: boolean; replaces: StandardAction }>
> = {
    [NewActionName.Manufacture]: {
        cardId: Court.MiningInterest,
        lore: false,
        replaces: StandardAction.Build
    },
    [NewActionName.Synthesize]: {
        cardId: Court.ShippingInterest,
        lore: false,
        replaces: StandardAction.Build
    },
    [NewActionName.Pressgang]: {
        cardId: Court.PrisonWardens,
        lore: false,
        replaces: StandardAction.Build
    },
    [NewActionName.Execute]: {
        cardId: Court.PrisonWardens,
        lore: false,
        replaces: StandardAction.Influence
    },
    [NewActionName.Abduct]: {
        cardId: Court.CourtEnforcers,
        lore: false,
        replaces: StandardAction.Battle
    },
    [NewActionName.Trade]: { cardId: Court.ElderBroker, lore: false, replaces: StandardAction.Tax },
    [NewActionName.Summon]: {
        cardId: Lore.ToolPriests,
        lore: true,
        replaces: StandardAction.Build
    },
    [NewActionName.Nurture]: {
        cardId: Lore.LivingStructures,
        lore: true,
        replaces: StandardAction.Build
    },
    [NewActionName.Prune]: {
        cardId: Lore.LivingStructures,
        lore: true,
        replaces: StandardAction.Repair
    },
    [NewActionName.Guide]: { cardId: Lore.ForceBeams, lore: true, replaces: StandardAction.Move },
    [NewActionName.Martyr]: {
        cardId: Lore.SurvivalOverrides,
        lore: true,
        replaces: StandardAction.Move
    },
    [NewActionName.Annex]: {
        cardId: Lore.TyrantsAuthority,
        lore: true,
        replaces: StandardAction.Build
    }
}

export function hasNewAction(
    state: HydratedArcsGameState,
    playerId: string,
    name: NewActionName
): boolean {
    const { cardId, lore } = NewActions[name]
    return lore
        ? state.getPlayerState(playerId).lore.includes(cardId)
        : state.holds(playerId, cardId)
}

// The choices each new action reads; any other is refused, so each choice means one thing.
const NewActionFields: Readonly<Record<NewActionName, readonly (keyof NewActionChoice)[]>> = {
    [NewActionName.Manufacture]: ['discard'],
    [NewActionName.Synthesize]: ['discard'],
    [NewActionName.Pressgang]: ['captives', 'gains', 'discard'],
    [NewActionName.Execute]: ['captives'],
    [NewActionName.Abduct]: ['courtCardId'],
    [NewActionName.Trade]: ['system', 'slot', 'give'],
    [NewActionName.Summon]: ['system', 'slot'],
    [NewActionName.Nurture]: ['system', 'slot', 'discard', 'cityType'],
    [NewActionName.Prune]: ['system', 'slot'],
    [NewActionName.Guide]: ['system', 'to', 'ships'],
    [NewActionName.Martyr]: ['system', 'target', 'targetDamaged'],
    [NewActionName.Annex]: ['system', 'slot']
}

export function newActionReads(name: NewActionName, field: keyof NewActionChoice): boolean {
    return NewActionFields[name].includes(field)
}

const ChoiceFields = [
    'discard',
    'captives',
    'gains',
    'courtCardId',
    'system',
    'slot',
    'give',
    'cityType',
    'to',
    'ships',
    'target',
    'targetDamaged'
] as const satisfies readonly (keyof NewActionChoice)[]

export function canTakeNewAction(
    state: HydratedArcsGameState,
    playerId: string,
    choice: NewActionChoice
): boolean {
    const allowed: readonly string[] = NewActionFields[choice.name]
    if (
        !hasNewAction(state, playerId, choice.name) ||
        ChoiceFields.some((field) => !allowed.includes(field) && choice[field] !== undefined)
    ) {
        return false
    }
    return NewActions[choice.name].lore
        ? canTakeLoreAction(state, playerId, choice)
        : canTakeCourtAction(state, playerId, choice)
}

export function takeNewAction(
    state: HydratedArcsGameState,
    playerId: string,
    choice: NewActionChoice
): NewActionResult {
    assert(canTakeNewAction(state, playerId, choice), `${playerId} cannot ${choice.name}`)
    return NewActions[choice.name].lore
        ? takeLoreAction(state, playerId, choice)
        : takeCourtAction(state, playerId, choice)
}
