import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Prelude: spend a Weapon so this turn's pips may battle (rule 9.1).
export type SpendWeapon = Type.Static<typeof SpendWeapon>
export const SpendWeapon = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SpendWeapon),
            playerId: Type.String()
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

    constructor(data: SpendWeapon) {
        super(data, SpendWeaponValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.spendWeapon(this.playerId)
    }
}
