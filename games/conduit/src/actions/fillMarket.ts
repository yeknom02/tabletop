import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, type MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { marketSizeOf } from '../definition/gameConfig.js'
import { HydratedConduitGameState } from '../model/gameState.js'

export type MarketFilled = Type.Static<typeof MarketFilled>
export const MarketFilled = Type.Object({
    round: Type.Integer(),
    tileIds: Type.Array(Type.Integer())
})

// Turning over tiles from the stacks is a reveal, so Undo cannot step back past it.
export type FillMarket = Type.Static<typeof FillMarket>
export const FillMarket = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.FillMarket),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(MarketFilled)
        })
    ])
)

export const FillMarketValidator = Compile(FillMarket)

export function isFillMarket(action?: GameAction): action is FillMarket {
    return action?.type === ActionType.FillMarket
}

export class HydratedFillMarket extends HydratableAction<typeof FillMarket> implements FillMarket {
    declare type: ActionType.FillMarket
    declare revealsInfo: true
    declare metadata?: MarketFilled

    constructor(data: FillMarket) {
        super(data, FillMarketValidator)
    }

    apply(state: HydratedConduitGameState, context?: MachineContext) {
        const tileIds = state.fillMarket(marketSizeOf(context?.gameConfig ?? {}))
        this.metadata = { round: state.round, tileIds }
    }
}
