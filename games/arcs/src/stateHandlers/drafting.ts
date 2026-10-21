import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { DraftKind, HydratedArcsGameState } from '../model/gameState.js'
import { HydratedDraftCard, isDraftCard } from '../actions/draftCard.js'
import { DealHands } from '../actions/dealHands.js'

export class DraftingStateHandler implements MachineStateHandler<
    HydratedDraftCard,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is HydratedDraftCard {
        return (
            isDraftCard(action) &&
            context.gameState.canDraft(action.playerId, action.cardId, action.kind)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const draft = gameState.draft
        if (!draft || draft.drafter !== playerId) {
            return []
        }
        const canPick =
            (gameState.needsFromDraft(playerId, DraftKind.Leader) && draft.leaders.length > 0) ||
            (gameState.needsFromDraft(playerId, DraftKind.Lore) && draft.lore.length > 0)
        return canPick ? [ActionType.DraftCard] : []
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const draft = context.gameState.draft
        if (draft) {
            context.gameState.activate(draft.drafter)
        }
    }

    onAction(
        _action: HydratedDraftCard,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        const gameState = context.gameState
        if (!gameState.draftComplete()) {
            return MachineState.Drafting
        }
        gameState.finishDraft()
        gameState.activePlayerIds = []
        context.addSystemAction(DealHands, { revealsInfo: true })
        return MachineState.Dealing
    }
}
