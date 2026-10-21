import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Call to Action, once secured: its player draws the bottom card of the action discard pile. Only
// they see it, so this is a reveal.
export type DrawActionCard = Type.Static<typeof DrawActionCard>
export const DrawActionCard = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DrawActionCard),
            drawer: Type.String(),
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const DrawActionCardValidator = Compile(DrawActionCard)

export function isDrawActionCard(action?: GameAction): action is DrawActionCard {
    return action?.type === ActionType.DrawActionCard
}

export class HydratedDrawActionCard
    extends HydratableAction<typeof DrawActionCard>
    implements DrawActionCard
{
    declare type: ActionType.DrawActionCard
    declare drawer: string
    declare revealsInfo: true

    constructor(data: DrawActionCard) {
        super(data, DrawActionCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.getPlayerState(this.drawer).takeIntoHand(state.actionDiscard.drawFromBottom(1))
    }
}
