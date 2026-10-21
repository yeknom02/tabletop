import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { ActionCardIdSchema } from '../components/actionCards.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Farseers' Prelude: discard it and any cards from hand, then draw one card per card discarded,
// Farseers included, from the bottom of the action discard pile. Only the player sees which cards;
// the draw is a reveal, so Undo stops here.
export type UseFarseers = Type.Static<typeof UseFarseers>
export const UseFarseers = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.UseFarseers),
            playerId: Type.String(),
            discards: Visibility.protect(Type.Array(ActionCardIdSchema), {
                policy: Visibility.Policy.Actor
            }),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(Type.Object({ drawn: Type.Integer({ minimum: 0 }) }))
        })
    ])
)

export const UseFarseersValidator = Compile(UseFarseers)

export function isUseFarseers(action?: GameAction): action is UseFarseers {
    return action?.type === ActionType.UseFarseers
}

export class HydratedUseFarseers
    extends HydratableAction<typeof UseFarseers>
    implements UseFarseers
{
    declare type: ActionType.UseFarseers
    declare playerId: string
    declare discards: string[]
    declare revealsInfo: true
    declare metadata?: { drawn: number }

    constructor(data: UseFarseers) {
        super(data, UseFarseersValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = { drawn: state.useFarseers(this.playerId, this.discards) }
    }
}
