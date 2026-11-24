import {
    assertExists,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import type { HydratedConduitGameState } from '../model/gameState.js'
import { endTurn, nextResolutionState, startTurn } from './flow.js'
import { biddingEndOf, minimumBidsOf } from '../definition/gameConfig.js'

type BiddingAction = HydratedPlaceBid | HydratedPassBid

// Starting with the Start Player, players in turn place one cube each, skipping anyone who cannot.
// In the bid-until-all-pass variant, players may pass once the minimum is done.
export class BiddingStateHandler implements MachineStateHandler<
    BiddingAction,
    HydratedConduitGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedConduitGameState>
    ): action is BiddingAction {
        const state = context.gameState
        if (!state.isActivePlayer(action.playerId ?? '')) return false
        if (isPlaceBid(action)) {
            return HydratedPlaceBid.canPlaceBid(state, action.playerId, action.slot)
        }
        if (isPassBid(action)) return this.canPass(action.playerId, context)
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedConduitGameState>
    ): ActionType[] {
        if (!context.gameState.isActivePlayer(playerId)) return []
        return [
            ActionType.PlaceBid,
            ...(this.canPass(playerId, context) ? [ActionType.PassBid] : [])
        ]
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        const state = context.gameState
        startTurn(state, this.nextBidder(state))
    }

    onAction(
        _action: BiddingAction,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        const state = context.gameState
        endTurn(state)
        return state.isBiddingOver(
            minimumBidsOf(context.gameConfig),
            biddingEndOf(context.gameConfig)
        )
            ? nextResolutionState(context)
            : MachineState.Bidding
    }

    private canPass(playerId: string, context: MachineContext<HydratedConduitGameState>) {
        return context.gameState.canPassBid(
            playerId,
            minimumBidsOf(context.gameConfig),
            biddingEndOf(context.gameConfig)
        )
    }

    // After a pass, the turn still moves on from the player who just acted.
    private nextBidder(state: HydratedConduitGameState): string {
        const canBid = (playerId: string) => state.canBid(playerId)
        const anyBids = state.market.some((slot) => slot.bids.length > 0)
        const lastBidder = state.turnManager.lastPlayer()
        const bidder = anyBids
            ? state.turnManager.nextPlayer(lastBidder, canBid)
            : state.turnManager.turnOrder.find(canBid)
        assertExists(bidder, 'Bidding goes on only while someone can bid')
        return bidder
    }
}
