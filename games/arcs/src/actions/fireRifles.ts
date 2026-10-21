import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { BattleRoll } from './battle.js'

// Galactic Rifles' Fire Rifles (Battle): skirmish dice for the fresh Loyal ships in `system`,
// rolled at a defender in the adjacent `target`; each hit lands there. A reveal.
export type FireRifles = Type.Static<typeof FireRifles>
export const FireRifles = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.FireRifles),
            playerId: Type.String(),
            system: SystemIdSchema,
            target: SystemIdSchema,
            defender: Type.String(),
            via: Type.Optional(ResourceSchema),
            // The token spent, when a card lets another resource stand in for `via`.
            token: Type.Optional(ResourceSchema),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(BattleRoll)
        })
    ])
)

export const FireRiflesValidator = Compile(FireRifles)

export function isFireRifles(action?: GameAction): action is FireRifles {
    return action?.type === ActionType.FireRifles
}

export class HydratedFireRifles extends HydratableAction<typeof FireRifles> implements FireRifles {
    declare type: ActionType.FireRifles
    declare playerId: string
    declare system: SystemId
    declare target: SystemId
    declare defender: string
    declare via?: Resource
    declare token?: Resource
    declare revealsInfo: true
    declare metadata?: BattleRoll

    constructor(data: FireRifles) {
        super(data, FireRiflesValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Battle, this.via, this.token)
        const rolled = state.fireRifles(this.playerId, this.system, this.target, this.defender)
        this.metadata = { rolled: [...rolled] }
    }
}
