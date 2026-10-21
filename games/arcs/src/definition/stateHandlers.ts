import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedArcsGameState } from '../model/gameState.js'
import { DraftingStateHandler } from '../stateHandlers/drafting.js'
import { DealingStateHandler } from '../stateHandlers/dealing.js'
import { MulliganStateHandler } from '../stateHandlers/mulligan.js'
import { PlayingCardStateHandler } from '../stateHandlers/playingCard.js'
import { TakingActionsStateHandler } from '../stateHandlers/takingActions.js'
import { BattlingStateHandler } from '../stateHandlers/battling.js'
import { FarseeingStateHandler } from '../stateHandlers/farseeing.js'
import { EndingChapterStateHandler } from '../stateHandlers/endingChapter.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const ArcsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedArcsGameState>
> = {
    [MachineState.Drafting]: new DraftingStateHandler(),
    [MachineState.Dealing]: new DealingStateHandler(),
    [MachineState.Mulligan]: new MulliganStateHandler(),
    [MachineState.PlayingCard]: new PlayingCardStateHandler(),
    [MachineState.TakingActions]: new TakingActionsStateHandler(),
    [MachineState.Battling]: new BattlingStateHandler(),
    [MachineState.Farseeing]: new FarseeingStateHandler(),
    [MachineState.EndingChapter]: new EndingChapterStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
