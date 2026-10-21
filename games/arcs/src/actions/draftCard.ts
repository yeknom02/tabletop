import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { DraftKind, HydratedArcsGameState } from '../model/gameState.js'

// Leaders & Lore: take one leader or lore card from its row (rule 11.1.2).
export type DraftCard = Type.Static<typeof DraftCard>
export const DraftCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DraftCard),
            playerId: Type.String(),
            cardId: Type.String(),
            kind: Type.Enum(DraftKind)
        })
    ])
)

export const DraftCardValidator = Compile(DraftCard)

export function isDraftCard(action?: GameAction): action is DraftCard {
    return action?.type === ActionType.DraftCard
}

export class HydratedDraftCard extends HydratableAction<typeof DraftCard> implements DraftCard {
    declare type: ActionType.DraftCard
    declare playerId: string
    declare cardId: string
    declare kind: DraftKind

    constructor(data: DraftCard) {
        super(data, DraftCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.draftCard(this.playerId, this.cardId, this.kind)
    }
}
