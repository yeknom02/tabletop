import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { BattleDice, BattleRoll } from './battle.js'

// The attacker's dice, once the defender's Predictive Sensors step is over. A reveal.
export type RollDice = Type.Static<typeof RollDice>
export const RollDice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.RollDice),
            playerId: Type.String(),
            dice: BattleDice,
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(BattleRoll)
        })
    ])
)

export const RollDiceValidator = Compile(RollDice)

export function isRollDice(action?: GameAction): action is RollDice {
    return action?.type === ActionType.RollDice
}

export class HydratedRollDice extends HydratableAction<typeof RollDice> implements RollDice {
    declare type: ActionType.RollDice
    declare playerId: string
    declare dice: BattleDice
    declare revealsInfo: true
    declare metadata?: BattleRoll

    constructor(data: RollDice) {
        super(data, RollDiceValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = { rolled: [...state.rollBattleDice(this.playerId, this.dice)] }
    }
}
