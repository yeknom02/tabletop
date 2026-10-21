import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { DrawArchive, HydratedDrawArchive, isDrawArchive } from '../actions/drawArchive.js'
import { HydratedKeepLore, isKeepLore } from '../actions/keepLore.js'

type ArchivingAction = HydratedDrawArchive | HydratedKeepLore

// The Archivist's lore: drawn as a System Action, then 2 kept.
export class ArchivingStateHandler implements MachineStateHandler<
    ArchivingAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is ArchivingAction {
        if (isDrawArchive(action)) {
            return action.source === ActionSource.System && !context.gameState.archive
        }
        return (
            isKeepLore(action) &&
            context.gameState.canKeepLore(action.playerId ?? '', action.cardIds)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        return context.gameState.archive?.playerId === playerId ? [ActionType.KeepLore] : []
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const archivist = context.gameState.archivist()
        if (archivist) {
            context.gameState.activate(archivist)
        }
        if (!context.gameState.archive) {
            context.addSystemAction(DrawArchive, { revealsInfo: true })
        }
    }

    onAction(
        action: ArchivingAction,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        if (isDrawArchive(action)) {
            return MachineState.Archiving
        }
        return startPlay(context.gameState)
    }
}

// Two players get a mulligan after every deal; otherwise play begins.
export function startPlay(gameState: HydratedArcsGameState): MachineState {
    return gameState.players.length === 2 ? MachineState.Mulligan : MachineState.PlayingCard
}
