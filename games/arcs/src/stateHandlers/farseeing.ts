import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { HydratedFarsee, isFarsee } from '../actions/farsee.js'
import { HydratedSwapWithRival, isSwapWithRival } from '../actions/swapWithRival.js'

type FarseeingAction = HydratedFarsee | HydratedSwapWithRival

// Farseers' holder picks a Rival, sees their hand, then swaps a card or not. The turn then goes on
// where the declaration interrupted it.
export class FarseeingStateHandler implements MachineStateHandler<
    FarseeingAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is FarseeingAction {
        const gameState = context.gameState
        const playerId = action.playerId ?? ''
        if (isFarsee(action)) {
            return gameState.canFarsee(playerId, action.rival)
        }
        return (
            isSwapWithRival(action) &&
            gameState.canSwapWithRival(playerId, action.give, action.take)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const farsight = context.gameState.farsight
        if (farsight?.playerId !== playerId) {
            return []
        }
        return farsight.rival === undefined ? [ActionType.Farsee] : [ActionType.SwapWithRival]
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const farsight = context.gameState.farsight
        if (farsight) {
            context.gameState.activate(farsight.playerId)
        }
    }

    onAction(
        _action: FarseeingAction,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        return afterDeclaring(context.gameState)
    }
}

// Where play goes after anything that may declare an ambition: Farseers first, if it was
// triggered, then the battle under way, if any, else the turn.
export function afterDeclaring(gameState: HydratedArcsGameState): MachineState {
    if (gameState.farsight) {
        return MachineState.Farseeing
    }
    return gameState.battle ? MachineState.Battling : MachineState.TakingActions
}
