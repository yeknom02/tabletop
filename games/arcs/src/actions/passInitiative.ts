import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// The initiative holder skips their turn and passes the initiative on (rule 5.1.2).
export type PassInitiative = Type.Static<typeof PassInitiative>
export const PassInitiative = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassInitiative),
            playerId: Type.String()
        })
    ])
)

export const PassInitiativeValidator = Compile(PassInitiative)

export function isPassInitiative(action?: GameAction): action is PassInitiative {
    return action?.type === ActionType.PassInitiative
}

export class HydratedPassInitiative
    extends HydratableAction<typeof PassInitiative>
    implements PassInitiative
{
    declare type: ActionType.PassInitiative
    declare playerId: string

    constructor(data: PassInitiative) {
        super(data, PassInitiativeValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.passInitiative(this.playerId)
    }
}
