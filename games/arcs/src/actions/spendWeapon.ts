import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Prelude: spend a Weapon so this turn's pips may battle (rule 9.1).
export type SpendWeapon = Type.Static<typeof SpendWeapon>
export const SpendWeapon = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SpendWeapon),
            playerId: Type.String(),
            // Another resource spent as a Weapon, with Loyal Marines.
            token: Type.Optional(ResourceSchema)
        })
    ])
)

export const SpendWeaponValidator = Compile(SpendWeapon)

export function isSpendWeapon(action?: GameAction): action is SpendWeapon {
    return action?.type === ActionType.SpendWeapon
}

export class HydratedSpendWeapon
    extends HydratableAction<typeof SpendWeapon>
    implements SpendWeapon
{
    declare type: ActionType.SpendWeapon
    declare playerId: string
    declare token?: Resource

    constructor(data: SpendWeapon) {
        super(data, SpendWeaponValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.spendWeapon(this.playerId, this.token)
    }
}
