import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { Die } from '../components/dice.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { RolledDie } from '../model/battle.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type BattleDice = Type.Static<typeof BattleDice>
export const BattleDice = Type.Object({
    [Die.Assault]: Type.Integer({ minimum: 0 }),
    [Die.Skirmish]: Type.Integer({ minimum: 0 }),
    [Die.Raid]: Type.Integer({ minimum: 0 })
})

export type BattleRoll = Type.Static<typeof BattleRoll>
export const BattleRoll = Type.Object({ rolled: Type.Array(RolledDie) })

// Battle a Rival in a system with Loyal ships, rolling up to one die per attacking ship (rule 7.7).
// The roll is a reveal, so Undo stops here.
export type Battle = Type.Static<typeof Battle>
export const Battle = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.Battle),
            playerId: Type.String(),
            system: SystemIdSchema,
            defender: Type.String(),
            dice: BattleDice,
            via: Type.Optional(ResourceSchema),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(BattleRoll)
        })
    ])
)

export const BattleValidator = Compile(Battle)

export function isBattle(action?: GameAction): action is Battle {
    return action?.type === ActionType.Battle
}

export class HydratedBattle extends HydratableAction<typeof Battle> implements Battle {
    declare type: ActionType.Battle
    declare playerId: string
    declare system: SystemId
    declare defender: string
    declare dice: BattleDice
    declare via?: Resource
    declare revealsInfo: true
    declare metadata?: BattleRoll

    constructor(data: Battle) {
        super(data, BattleValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Battle, this.via)
        const battle = state.startBattle(this.playerId, this.system, this.defender, this.dice)
        this.metadata = { rolled: battle.rolled }
    }
}
