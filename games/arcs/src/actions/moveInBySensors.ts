import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { SensorsMove } from '../model/battle.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Predictive Sensors: before the attacker collects dice, the defender moves fresh ships in from
// adjacent systems, or none.
export type MoveInBySensors = Type.Static<typeof MoveInBySensors>
export const MoveInBySensors = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveInBySensors),
            playerId: Type.String(),
            moves: Type.Array(SensorsMove)
        })
    ])
)

export const MoveInBySensorsValidator = Compile(MoveInBySensors)

export function isMoveInBySensors(action?: GameAction): action is MoveInBySensors {
    return action?.type === ActionType.MoveInBySensors
}

export class HydratedMoveInBySensors
    extends HydratableAction<typeof MoveInBySensors>
    implements MoveInBySensors
{
    declare type: ActionType.MoveInBySensors
    declare playerId: string
    declare moves: SensorsMove[]

    constructor(data: MoveInBySensors) {
        super(data, MoveInBySensorsValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.moveInBySensors(this.playerId, this.moves)
    }
}
