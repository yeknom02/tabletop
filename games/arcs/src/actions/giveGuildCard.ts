import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { giveGuildCard } from '../model/declaration.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Feastbringer, Generous: the cost of declaring, a Guild card given to a Rival with the least Power.
export type GiveGuildCard = Type.Static<typeof GiveGuildCard>
export const GiveGuildCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.GiveGuildCard),
            playerId: Type.String(),
            cardId: Type.String(),
            to: Type.String()
        })
    ])
)

export const GiveGuildCardValidator = Compile(GiveGuildCard)

export function isGiveGuildCard(action?: GameAction): action is GiveGuildCard {
    return action?.type === ActionType.GiveGuildCard
}

export class HydratedGiveGuildCard
    extends HydratableAction<typeof GiveGuildCard>
    implements GiveGuildCard
{
    declare type: ActionType.GiveGuildCard
    declare playerId: string
    declare cardId: string
    declare to: string

    constructor(data: GiveGuildCard) {
        super(data, GiveGuildCardValidator)
    }

    apply(state: HydratedArcsGameState) {
        giveGuildCard(state, this.playerId, this.cardId, this.to)
    }
}
