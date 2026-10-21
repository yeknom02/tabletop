import { type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from './states.js'
import type { HydratedArcsGameState } from '../model/gameState.js'
import { DraftingStateHandler } from '../stateHandlers/drafting.js'
import { DealingStateHandler } from '../stateHandlers/dealing.js'
import { ArchivingStateHandler } from '../stateHandlers/archiving.js'
import { MulliganStateHandler } from '../stateHandlers/mulligan.js'
import { PlayingCardStateHandler } from '../stateHandlers/playingCard.js'
import { TakingActionsStateHandler } from '../stateHandlers/takingActions.js'
import { BattlingStateHandler } from '../stateHandlers/battling.js'
import { DeclaringStateHandler } from '../stateHandlers/declaring.js'
import { EndingChapterStateHandler } from '../stateHandlers/endingChapter.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const ArcsStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedArcsGameState>
> = {
    [MachineState.Drafting]: new DraftingStateHandler(),
    [MachineState.Dealing]: new DealingStateHandler(),
    [MachineState.Archiving]: new ArchivingStateHandler(),
    [MachineState.Mulligan]: new MulliganStateHandler(),
    [MachineState.PlayingCard]: new PlayingCardStateHandler(),
    [MachineState.TakingActions]: new TakingActionsStateHandler(),
    [MachineState.Battling]: new BattlingStateHandler(),
    [MachineState.Declaring]: new DeclaringStateHandler(),
    [MachineState.EndingChapter]: new EndingChapterStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
