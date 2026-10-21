import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// After the Leaders & Lore draft, each player draws six action cards from the shuffled pile (rule
// 3.1.2.5). Hands are a reveal to their owners, so Undo stops here.
export type DealHands = Type.Static<typeof DealHands>
export const DealHands = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DealHands),
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const DealHandsValidator = Compile(DealHands)

export function isDealHands(action?: GameAction): action is DealHands {
    return action?.type === ActionType.DealHands
}

export class HydratedDealHands extends HydratableAction<typeof DealHands> implements DealHands {
    declare type: ActionType.DealHands
    declare revealsInfo: true

    constructor(data: DealHands) {
        super(data, DealHandsValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.deal(state.actionDiscard.takeAll())
    }
}
