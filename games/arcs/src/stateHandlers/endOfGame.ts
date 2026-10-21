import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedArcsGameState
> {
    isValidAction(_action: HydratedAction): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    // Ties are broken in turn order, so there is always one winner (rule 6.2.3.1).
    enter(context: MachineContext<HydratedArcsGameState>) {
        const gameState = context.gameState
        gameState.result = GameResult.Win
        gameState.winningPlayerIds = [gameState.winner()]
        gameState.activePlayerIds = []
    }

    onAction(): MachineState {
        throw Error('No actions are valid at the end of the game')
    }
}
