import type { HydratedAction, MachineStateHandler } from '@tabletop/common'
import type { HydratedConduitGameState } from '../model/gameState.js'
import { MachineState } from './states.js'
import { BiddingStateHandler } from '../stateHandlers/bidding.js'
import { OfferingStateHandler } from '../stateHandlers/offering.js'
import { PlacingStateHandler } from '../stateHandlers/placing.js'
import {
    FillingMarketStateHandler,
    LosingInfrastructureStateHandler,
    PayingRevenueStateHandler
} from '../stateHandlers/automatic.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'

export const ConduitStateHandlers: Record<
    MachineState,
    MachineStateHandler<HydratedAction, HydratedConduitGameState>
> = {
    [MachineState.Bidding]: new BiddingStateHandler(),
    [MachineState.Offering]: new OfferingStateHandler(),
    [MachineState.Placing]: new PlacingStateHandler(),
    [MachineState.FillingMarket]: new FillingMarketStateHandler(),
    [MachineState.PayingRevenue]: new PayingRevenueStateHandler(),
    [MachineState.LosingInfrastructure]: new LosingInfrastructureStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
