import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import {
    awaitsConnectedDraw,
    canBoldInfluence,
    canFarsee,
    canGainOnDeclaring,
    canGiveGuildCard,
    canResolveConnected,
    canSwapWithRival,
    currentStep,
    DeclareStep
} from '../model/declaration.js'
import { HydratedGiveGuildCard, isGiveGuildCard } from '../actions/giveGuildCard.js'
import { DrawCourtCard, HydratedDrawCourtCard, isDrawCourtCard } from '../actions/drawCourtCard.js'
import { HydratedResolveConnected, isResolveConnected } from '../actions/resolveConnected.js'
import { HydratedGainOnDeclaring, isGainOnDeclaring } from '../actions/gainOnDeclaring.js'
import { HydratedBoldInfluence, isBoldInfluence } from '../actions/boldInfluence.js'
import { HydratedFarsee, isFarsee } from '../actions/farsee.js'
import { HydratedSwapWithRival, isSwapWithRival } from '../actions/swapWithRival.js'

type DeclaringAction =
    | HydratedGiveGuildCard
    | HydratedDrawCourtCard
    | HydratedResolveConnected
    | HydratedGainOnDeclaring
    | HydratedBoldInfluence
    | HydratedFarsee
    | HydratedSwapWithRival

const StepActions: Readonly<Record<DeclareStep, ActionType>> = {
    [DeclareStep.Generous]: ActionType.GiveGuildCard,
    [DeclareStep.Connected]: ActionType.ResolveConnected,
    [DeclareStep.Ambitious]: ActionType.GainOnDeclaring,
    [DeclareStep.Bold]: ActionType.BoldInfluence,
    [DeclareStep.Farsee]: ActionType.Farsee,
    [DeclareStep.Swap]: ActionType.SwapWithRival
}

// The declarer resolves what their declaration set off, one step at a time; play then goes on
// where the declaration interrupted it.
export class DeclaringStateHandler implements MachineStateHandler<
    DeclaringAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is DeclaringAction {
        const gameState = context.gameState
        const playerId = action.playerId ?? ''
        if (isDrawCourtCard(action)) {
            return action.source === ActionSource.System && awaitsConnectedDraw(gameState)
        }
        if (isGiveGuildCard(action)) {
            return canGiveGuildCard(gameState, playerId, action.cardId, action.to)
        }
        if (isResolveConnected(action)) {
            return canResolveConnected(gameState, playerId, action.vox)
        }
        if (isGainOnDeclaring(action)) {
            return canGainOnDeclaring(gameState, playerId, action.resource, action.discard ?? [])
        }
        if (isBoldInfluence(action)) {
            return canBoldInfluence(gameState, playerId, action.cardIds)
        }
        if (isFarsee(action)) {
            return canFarsee(gameState, playerId, action.rival)
        }
        return (
            isSwapWithRival(action) &&
            canSwapWithRival(gameState, playerId, action.give, action.take)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const step = currentStep(gameState)
        if (
            gameState.declaration?.playerId !== playerId ||
            step === undefined ||
            awaitsConnectedDraw(gameState)
        ) {
            return []
        }
        return [StepActions[step]]
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const declaration = context.gameState.declaration
        if (declaration) {
            context.gameState.activate(declaration.playerId)
        }
        drawIfConnected(context)
    }

    onAction(
        _action: DeclaringAction,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        const next = afterDeclaring(context.gameState)
        if (next === MachineState.Declaring) {
            drawIfConnected(context)
        }
        return next
    }
}

// Connected's draw happens on its own, as a reveal.
function drawIfConnected(context: MachineContext<HydratedArcsGameState>) {
    if (awaitsConnectedDraw(context.gameState)) {
        context.addSystemAction(DrawCourtCard, { revealsInfo: true })
    }
}

// Where play goes after anything that may declare an ambition: its triggered abilities first,
// then the battle under way, if any, else the turn.
export function afterDeclaring(gameState: HydratedArcsGameState): MachineState {
    if (gameState.declaration) {
        return MachineState.Declaring
    }
    return gameState.battle ? MachineState.Battling : MachineState.TakingActions
}
