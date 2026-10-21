import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Place an agent on a Court card (rule 7.5).
export type Influence = Type.Static<typeof Influence>
export const Influence = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Influence),
            playerId: Type.String(),
            cardId: Type.String(),
            via: Type.Optional(ResourceSchema)
        })
    ])
)

export const InfluenceValidator = Compile(Influence)

export function isInfluence(action?: GameAction): action is Influence {
    return action?.type === ActionType.Influence
}

export class HydratedInfluence extends HydratableAction<typeof Influence> implements Influence {
    declare type: ActionType.Influence
    declare playerId: string
    declare cardId: string
    declare via?: Resource

    constructor(data: Influence) {
        super(data, InfluenceValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Influence, this.via)
        state.influence(this.playerId, this.cardId)
    }
}
