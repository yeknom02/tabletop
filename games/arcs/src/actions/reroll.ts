import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { BattleRoll } from './battle.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// After rolling, reroll the dice that cards allow (Skirmishers, Corsair, Seeker Torpedoes,
// Empath's Vision), once. `dice` are indexes into the roll. The new faces are a reveal, so Undo stops here.
export type Reroll = Type.Static<typeof Reroll>
export const Reroll = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.Reroll),
            playerId: Type.String(),
            dice: Type.Array(Type.Integer({ minimum: 0 })),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(BattleRoll)
        })
    ])
)

export const RerollValidator = Compile(Reroll)

export function isReroll(action?: GameAction): action is Reroll {
    return action?.type === ActionType.Reroll
}

export class HydratedReroll extends HydratableAction<typeof Reroll> implements Reroll {
    declare type: ActionType.Reroll
    declare playerId: string
    declare dice: number[]
    declare revealsInfo: true
    declare metadata?: BattleRoll

    constructor(data: Reroll) {
        super(data, RerollValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = { rolled: [...state.reroll(this.playerId, this.dice)] }
    }
}
