import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { connectedDraw } from '../model/declaration.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Noble, Connected: the top card of the Court deck is drawn and secured. Nobody knew it, so this
// is a reveal.
export type DrawCourtCard = Type.Static<typeof DrawCourtCard>
export const DrawCourtCard = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DrawCourtCard),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(Type.Object({ cardId: Type.Optional(Type.String()) }))
        })
    ])
)

export const DrawCourtCardValidator = Compile(DrawCourtCard)

export function isDrawCourtCard(action?: GameAction): action is DrawCourtCard {
    return action?.type === ActionType.DrawCourtCard
}

export class HydratedDrawCourtCard
    extends HydratableAction<typeof DrawCourtCard>
    implements DrawCourtCard
{
    declare type: ActionType.DrawCourtCard
    declare revealsInfo: true
    declare metadata?: { cardId?: string }

    constructor(data: DrawCourtCard) {
        super(data, DrawCourtCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        const cardId = connectedDraw(state)
        this.metadata = cardId === undefined ? {} : { cardId }
    }
}
