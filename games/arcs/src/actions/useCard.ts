import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import type { SystemId } from '../components/map.js'
import type { Resource } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { CardUse, CardUseResult, useCard } from '../model/courtEffects.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import type { StealTarget } from '../model/pieces.js'

// Prelude: use a held Court card's Prelude action (rule 8.1).
export type UseCard = Type.Static<typeof UseCard>
export const UseCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardUse,
        Type.Object({
            type: Type.Literal(ActionType.UseCard),
            playerId: Type.String(),
            metadata: Type.Optional(CardUseResult)
        })
    ])
)

export const UseCardValidator = Compile(UseCard)

export function isUseCard(action?: GameAction): action is UseCard {
    return action?.type === ActionType.UseCard
}

export class HydratedUseCard extends HydratableAction<typeof UseCard> implements UseCard {
    declare type: ActionType.UseCard
    declare playerId: string
    declare cardId: string
    declare system?: SystemId
    declare steal?: StealTarget[]
    declare actionCardId?: string
    declare discard?: Resource[]
    declare metadata?: CardUseResult

    constructor(data: UseCard) {
        super(data, UseCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = useCard(state, this.playerId, this)
    }
}
