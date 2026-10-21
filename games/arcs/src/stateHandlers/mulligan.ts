import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { HydratedKeepHand, isKeepHand } from '../actions/keepHand.js'
import { HydratedRedrawHand, isRedrawHand } from '../actions/redrawHand.js'

type MulliganAction = HydratedKeepHand | HydratedRedrawHand

export class MulliganStateHandler implements MachineStateHandler<
    MulliganAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is MulliganAction {
        return (
            (isKeepHand(action) || isRedrawHand(action)) &&
            action.playerId === context.gameState.mulliganPlayer()
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        return playerId === context.gameState.mulliganPlayer()
            ? [ActionType.KeepHand, ActionType.RedrawHand]
            : []
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        context.gameState.activate(context.gameState.mulliganPlayer())
    }

    onAction(): MachineState {
        return MachineState.PlayingCard
    }
}
