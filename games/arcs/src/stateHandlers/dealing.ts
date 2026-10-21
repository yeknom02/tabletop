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
import { startPlay } from './archiving.js'

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

// The first deal is the end of setup, after which the Archivist draws lore. Two players get a
// mulligan after every deal; otherwise play begins.
export function afterDeal(gameState: HydratedArcsGameState): MachineState {
    if (gameState.chapter === 1 && gameState.archivist() !== undefined) {
        return MachineState.Archiving
    }
    return startPlay(gameState)
}
