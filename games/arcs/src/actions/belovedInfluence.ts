import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Elder, Beloved: after defending in a battle where the attacker took Trophies, influence a Court
// card, or decline by naming none.
export type BelovedInfluence = Type.Static<typeof BelovedInfluence>
export const BelovedInfluence = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BelovedInfluence),
            playerId: Type.String(),
            cardId: Type.Optional(Type.String())
        })
    ])
)

export const BelovedInfluenceValidator = Compile(BelovedInfluence)

export function isBelovedInfluence(action?: GameAction): action is BelovedInfluence {
    return action?.type === ActionType.BelovedInfluence
}

export class HydratedBelovedInfluence
    extends HydratableAction<typeof BelovedInfluence>
    implements BelovedInfluence
{
    declare type: ActionType.BelovedInfluence
    declare playerId: string
    declare cardId?: string

    constructor(data: BelovedInfluence) {
        super(data, BelovedInfluenceValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.belovedInfluence(this.playerId, this.cardId)
    }
}
