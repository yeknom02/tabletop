import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { PlayKind } from '../model/round.js'
import { HydratedLeadCard, isLeadCard } from '../actions/leadCard.js'
import { HydratedFollowCard, isFollowCard } from '../actions/followCard.js'
import { HydratedPassInitiative, isPassInitiative } from '../actions/passInitiative.js'
import { EndChapter } from '../actions/endChapter.js'
import { afterDeclaring } from './declaring.js'

type PlayingCardAction = HydratedLeadCard | HydratedFollowCard | HydratedPassInitiative

export class PlayingCardStateHandler implements MachineStateHandler<
    PlayingCardAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is PlayingCardAction {
        const gameState = context.gameState
        if (isLeadCard(action)) {
            return gameState.canLead(action.playerId, action.cardId, action.declare)
        }
        if (isFollowCard(action)) {
            return gameState.canFollow(
                action.playerId,
                action.cardId,
                action.playKind,
                action.seizeWith,
                action.declare
            )
        }
        return isPassInitiative(action) && gameState.canPassInitiative(action.playerId)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) {
            return []
        }
        if (gameState.leadPlay() === undefined) {
            return gameState.hasCards(playerId)
                ? [ActionType.LeadCard, ActionType.PassInitiative]
                : [ActionType.PassInitiative]
        }
        const hand = gameState.getPlayerState(playerId).hand ?? []
        const kinds = [PlayKind.Surpass, PlayKind.Pivot, PlayKind.Copy]
        const canFollow = hand.some((cardId) =>
            kinds.some((kind) => gameState.canFollow(playerId, cardId, kind))
        )
        return canFollow ? [ActionType.FollowCard] : []
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const gameState = context.gameState
        if (gameState.leadPlay() === undefined) {
            if (!gameState.hasCards(gameState.initiative)) {
                gameState.forfeitInitiative()
            }
            gameState.activate(gameState.initiative)
            return
        }
        const next = gameState.nextTurnPlayer()
        if (next) {
            gameState.activate(next)
        }
    }

    onAction(
        action: PlayingCardAction,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        const gameState = context.gameState
        if (isPassInitiative(action)) {
            return gameState.everyonePassed() ? endChapter(context) : MachineState.PlayingCard
        }
        return afterDeclaring(gameState)
    }
}

// The chapter ends when nobody has cards, or everyone with cards passed (rule 6.1).
export function endChapter(context: MachineContext<HydratedArcsGameState>): MachineState {
    context.gameState.activePlayerIds = []
    context.addSystemAction(EndChapter, { revealsInfo: true })
    return MachineState.EndingChapter
}
