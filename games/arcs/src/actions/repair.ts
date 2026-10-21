import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Repair a damaged Loyal ship, or the damaged Loyal building in a slot, anywhere (rule 7.4).
export type Repair = Type.Static<typeof Repair>
export const Repair = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Repair),
            playerId: Type.String(),
            system: SystemIdSchema,
            slot: Type.Optional(Type.Integer({ minimum: 0 })),
            via: Type.Optional(ResourceSchema)
        })
    ])
)

export const RepairValidator = Compile(Repair)

export function isRepair(action?: GameAction): action is Repair {
    return action?.type === ActionType.Repair
}

export class HydratedRepair extends HydratableAction<typeof Repair> implements Repair {
    declare type: ActionType.Repair
    declare playerId: string
    declare system: SystemId
    declare slot?: number
    declare via?: Resource

    constructor(data: Repair) {
        super(data, RepairValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Repair, this.via)
        if (this.slot === undefined) {
            state.repairShip(this.playerId, this.system)
        } else {
            state.repairBuilding(this.playerId, this.system, this.slot)
        }
    }
}
