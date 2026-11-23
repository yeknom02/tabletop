import {
    assertExists,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import type { HydratedConduitGameState } from '../model/gameState.js'
import { endTurn, nextResolutionState, startTurn } from './flow.js'

// Starting with the Start Player, players in turn place one cube each, skipping anyone who cannot.
export class BiddingStateHandler implements MachineStateHandler<
    HydratedPlaceBid,
    HydratedConduitGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedConduitGameState>
    ): action is HydratedPlaceBid {
        return (
            isPlaceBid(action) &&
            context.gameState.isActivePlayer(action.playerId) &&
            HydratedPlaceBid.canPlaceBid(context.gameState, action.playerId, action.slot)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedConduitGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PlaceBid] : []
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        const state = context.gameState
        startTurn(state, this.nextBidder(state))
    }

    onAction(
        _action: HydratedPlaceBid,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        const state = context.gameState
        endTurn(state)
        return state.isBiddingOver() ? nextResolutionState(context) : MachineState.Bidding
    }

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
