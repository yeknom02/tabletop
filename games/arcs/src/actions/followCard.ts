import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Visibility } from '@tabletop/common'
import { ActionCardIdSchema, Ambition, AmbitionSchema } from '../components/actionCards.js'
import { PlayKind } from '../model/round.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Surpass, Copy or Pivot after the lead, optionally seizing the initiative with an extra face-down card (rule 5.2). A Copy's card and a seizing card are face down: only their player sees which.
export type FollowCard = Type.Static<typeof FollowCard>
export const FollowCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FollowCard),
            playerId: Type.String(),
            playKind: Type.Enum(PlayKind),
            cardId: Visibility.protect(ActionCardIdSchema, { policy: Visibility.Policy.Actor }),
            seizeWith: Type.Optional(
                Visibility.protect(ActionCardIdSchema, { policy: Visibility.Policy.Actor })
            ),
            // With Galactic Bards: the ambition to declare.
            declare: Type.Optional(AmbitionSchema)
        })
    ])
)

export const FollowCardValidator = Compile(FollowCard)

export function isFollowCard(action?: GameAction): action is FollowCard {
    return action?.type === ActionType.FollowCard
}

export class HydratedFollowCard extends HydratableAction<typeof FollowCard> implements FollowCard {
    declare type: ActionType.FollowCard
    declare playerId: string
    declare playKind: PlayKind
    declare cardId: string
    declare seizeWith?: string
    declare declare?: Ambition

    constructor(data: FollowCard) {
        super(data, FollowCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.follow(this.playerId, this.cardId, this.playKind, this.seizeWith, this.declare)
    }
}
