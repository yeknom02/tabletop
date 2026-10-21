import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Two players: the player without initiative discards their hand and draws six new cards, which
// they must keep (rule 6.2.4.1). The new cards are a reveal, so Undo stops here.
export type RedrawHand = Type.Static<typeof RedrawHand>
export const RedrawHand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.RedrawHand),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const RedrawHandValidator = Compile(RedrawHand)

export function isRedrawHand(action?: GameAction): action is RedrawHand {
    return action?.type === ActionType.RedrawHand
}

export class HydratedRedrawHand extends HydratableAction<typeof RedrawHand> implements RedrawHand {
    declare type: ActionType.RedrawHand
    declare playerId: string
    declare revealsInfo: true

    constructor(data: RedrawHand) {
        super(data, RedrawHandValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.redrawHand(this.playerId)
    }
}
