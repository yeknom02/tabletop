import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Two players: the player without initiative keeps the hand they were dealt (rule 6.2.4.1).
export type KeepHand = Type.Static<typeof KeepHand>
export const KeepHand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.KeepHand),
            playerId: Type.String()
        })
    ])
)

export const KeepHandValidator = Compile(KeepHand)

export function isKeepHand(action?: GameAction): action is KeepHand {
    return action?.type === ActionType.KeepHand
}

export class HydratedKeepHand extends HydratableAction<typeof KeepHand> implements KeepHand {
    declare type: ActionType.KeepHand
    declare playerId: string

    constructor(data: KeepHand) {
        super(data, KeepHandValidator)
    }

    apply(_state: HydratedArcsGameState) {}
}
