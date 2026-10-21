import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { boldInfluence } from '../model/declaration.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Demagogue, Bold: on declaring an ambition, influence any number of Court cards once each.
export type BoldInfluence = Type.Static<typeof BoldInfluence>
export const BoldInfluence = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BoldInfluence),
            playerId: Type.String(),
            cardIds: Type.Array(Type.String())
        })
    ])
)

export const BoldInfluenceValidator = Compile(BoldInfluence)

export function isBoldInfluence(action?: GameAction): action is BoldInfluence {
    return action?.type === ActionType.BoldInfluence
}

export class HydratedBoldInfluence
    extends HydratableAction<typeof BoldInfluence>
    implements BoldInfluence
{
    declare type: ActionType.BoldInfluence
    declare playerId: string
    declare cardIds: string[]

    constructor(data: BoldInfluence) {
        super(data, BoldInfluenceValidator)
    }

    apply(state: HydratedArcsGameState) {
        boldInfluence(state, this.playerId, this.cardIds)
    }
}
