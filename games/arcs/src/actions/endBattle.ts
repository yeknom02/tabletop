import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// The attacker stops raiding, leaving any keys unspent.
export type EndBattle = Type.Static<typeof EndBattle>
export const EndBattle = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndBattle),
            playerId: Type.String()
        })
    ])
)

export const EndBattleValidator = Compile(EndBattle)

export function isEndBattle(action?: GameAction): action is EndBattle {
    return action?.type === ActionType.EndBattle
}

export class HydratedEndBattle extends HydratableAction<typeof EndBattle> implements EndBattle {
    declare type: ActionType.EndBattle
    declare playerId: string

    constructor(data: EndBattle) {
        super(data, EndBattleValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.endBattle(this.playerId)
    }
}
