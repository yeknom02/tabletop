import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type RansackResult = Type.Static<typeof RansackResult>
export const RansackResult = Type.Object({
    trophies: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
})

// For each city destroyed, secure a Court card with any of the defender's agents, taking the
// Rival agents on it as Trophies (rule 7.7.4.2).
export type Ransack = Type.Static<typeof Ransack>
export const Ransack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Ransack),
            playerId: Type.String(),
            cardId: Type.String(),
            metadata: Type.Optional(RansackResult)
        })
    ])
)

export const RansackValidator = Compile(Ransack)

export function isRansack(action?: GameAction): action is Ransack {
    return action?.type === ActionType.Ransack
}

export class HydratedRansack extends HydratableAction<typeof Ransack> implements Ransack {
    declare type: ActionType.Ransack
    declare playerId: string
    declare cardId: string
    declare metadata?: RansackResult

    constructor(data: Ransack) {
        super(data, RansackValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = { trophies: state.ransack(this.playerId, this.cardId) }
    }
}
