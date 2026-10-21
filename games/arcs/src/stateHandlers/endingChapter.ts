import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { HydratedEndChapter, isEndChapter } from '../actions/endChapter.js'
import { afterDeal } from './dealing.js'

export class EndingChapterStateHandler implements MachineStateHandler<
    HydratedEndChapter,
    HydratedArcsGameState
> {
    isValidAction(action: HydratedAction): action is HydratedEndChapter {
        return isEndChapter(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        action: HydratedEndChapter,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        return action.metadata?.gameOver ? MachineState.EndOfGame : afterDeal(context.gameState)
    }
}
