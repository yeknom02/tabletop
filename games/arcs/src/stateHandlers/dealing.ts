import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { HydratedDealHands, isDealHands } from '../actions/dealHands.js'

export class DealingStateHandler implements MachineStateHandler<
    HydratedDealHands,
    HydratedArcsGameState
> {
    isValidAction(action: HydratedAction): action is HydratedDealHands {
        return isDealHands(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter() {}

    onAction(
        _action: HydratedDealHands,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        return afterDeal(context.gameState)
    }
}

// Two players get a mulligan after every deal; otherwise play begins.
export function afterDeal(gameState: HydratedArcsGameState): MachineState {
    return gameState.players.length === 2 ? MachineState.Mulligan : MachineState.PlayingCard
}
