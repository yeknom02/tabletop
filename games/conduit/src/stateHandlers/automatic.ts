import {
    ActionSource,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedFillMarket, isFillMarket } from '../actions/fillMarket.js'
import { HydratedPayRevenue, isPayRevenue } from '../actions/payRevenue.js'
import {
    HydratedLoseInfrastructure,
    isLoseInfrastructure,
    LoseInfrastructure
} from '../actions/loseInfrastructure.js'
import { FillMarket } from '../actions/fillMarket.js'
import { PayRevenue } from '../actions/payRevenue.js'
import { type HydratedConduitGameState, Rounds } from '../model/gameState.js'
import { nextResolutionState } from './flow.js'
import { biddingEndOf, minimumBidsOf } from '../definition/gameConfig.js'

export class FillingMarketStateHandler implements MachineStateHandler<
    HydratedFillMarket,
    HydratedConduitGameState
> {
    isValidAction(action: HydratedAction): action is HydratedFillMarket {
        return isFillMarket(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        context.gameState.activePlayerIds = []
    }

    // When no one has a cube to bid, every tile goes straight to the Start Player face down.
    onAction(
        _action: HydratedFillMarket,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        return context.gameState.isBiddingOver(
            minimumBidsOf(context.gameConfig),
            biddingEndOf(context.gameConfig)
        )
            ? nextResolutionState(context)
            : MachineState.Bidding
    }
}

export class PayingRevenueStateHandler implements MachineStateHandler<
    HydratedPayRevenue,
    HydratedConduitGameState
> {
    isValidAction(action: HydratedAction): action is HydratedPayRevenue {
        return isPayRevenue(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedPayRevenue,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        context.addSystemAction(LoseInfrastructure)
        return MachineState.LosingInfrastructure
    }
}

// After the fifth round, revenue and infrastructure loss repeat until no cubes remain on the board.
export class LosingInfrastructureStateHandler implements MachineStateHandler<
    HydratedLoseInfrastructure,
    HydratedConduitGameState
> {
    isValidAction(action: HydratedAction): action is HydratedLoseInfrastructure {
        return isLoseInfrastructure(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedConduitGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(
        _action: HydratedLoseInfrastructure,
        context: MachineContext<HydratedConduitGameState>
    ): MachineState {
        const state = context.gameState
        if (state.round < Rounds) {
            context.addSystemAction(FillMarket, { revealsInfo: true })
            return MachineState.FillingMarket
        }
        if (state.cubesOnBoard() > 0) {
            context.addSystemAction(PayRevenue)
            return MachineState.PayingRevenue
        }
        return MachineState.EndOfGame
    }
}
