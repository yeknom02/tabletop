import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionCardIdSchema, Ambition, AmbitionSchema } from '../components/actionCards.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// The initiative holder leads a card face up, optionally declaring its ambition first (rule 5.1).
export type LeadCard = Type.Static<typeof LeadCard>
export const LeadCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LeadCard),
            playerId: Type.String(),
            cardId: ActionCardIdSchema,
            declare: Type.Optional(AmbitionSchema)
        })
    ])
)

export const LeadCardValidator = Compile(LeadCard)

export function isLeadCard(action?: GameAction): action is LeadCard {
    return action?.type === ActionType.LeadCard
}

export class HydratedLeadCard extends HydratableAction<typeof LeadCard> implements LeadCard {
    declare type: ActionType.LeadCard
    declare playerId: string
    declare cardId: string
    declare declare?: Ambition

    constructor(data: LeadCard) {
        super(data, LeadCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.lead(this.playerId, this.cardId, this.declare)
    }
}
