import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type TaxResult = Type.Static<typeof TaxResult>
export const TaxResult = Type.Object({
    resource: Type.Optional(ResourceSchema),
    discarded: Type.Optional(ResourceSchema),
    captured: Type.Optional(Type.String())
})

// Gain a resource from a Loyal city, or from a Rival city the player controls and capture an agent (rule 7.1).
export type Tax = Type.Static<typeof Tax>
export const Tax = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Tax),
            playerId: Type.String(),
            system: SystemIdSchema,
            slot: Type.Integer({ minimum: 0 }),
            via: Type.Optional(ResourceSchema),
            // The token spent, when a card lets another resource stand in for `via`.
            token: Type.Optional(ResourceSchema),
            // With every open slot full: the resource to discard, possibly the one gained (rule 9.2.1).
            discard: Type.Optional(ResourceSchema),
            metadata: Type.Optional(TaxResult)
        })
    ])
)

export const TaxValidator = Compile(Tax)

export function isTax(action?: GameAction): action is Tax {
    return action?.type === ActionType.Tax
}

export class HydratedTax extends HydratableAction<typeof Tax> implements Tax {
    declare type: ActionType.Tax
    declare playerId: string
    declare system: SystemId
    declare slot: number
    declare via?: Resource
    declare token?: Resource
    declare discard?: Resource
    declare metadata?: TaxResult

    constructor(data: Tax) {
        super(data, TaxValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Tax, this.via, this.token)
        this.metadata = state.tax(this.playerId, this.system, this.slot, this.discard)
    }
}
