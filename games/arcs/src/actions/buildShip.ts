import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type BuildShipResult = Type.Static<typeof BuildShipResult>
export const BuildShipResult = Type.Object({ damaged: Type.Boolean() })

// Build a ship at a Loyal starport, once per starport per turn (rule 7.2).
export type BuildShip = Type.Static<typeof BuildShip>
export const BuildShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildShip),
            playerId: Type.String(),
            system: SystemIdSchema,
            slot: Type.Integer({ minimum: 0 }),
            via: Type.Optional(ResourceSchema),
            // The token spent, when a card lets another resource stand in for `via`.
            token: Type.Optional(ResourceSchema),
            metadata: Type.Optional(BuildShipResult)
        })
    ])
)

export const BuildShipValidator = Compile(BuildShip)

export function isBuildShip(action?: GameAction): action is BuildShip {
    return action?.type === ActionType.BuildShip
}

export class HydratedBuildShip extends HydratableAction<typeof BuildShip> implements BuildShip {
    declare type: ActionType.BuildShip
    declare playerId: string
    declare system: SystemId
    declare slot: number
    declare via?: Resource
    declare token?: Resource
    declare metadata?: BuildShipResult

    constructor(data: BuildShip) {
        super(data, BuildShipValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Build, this.via, this.token)
        this.metadata = { damaged: state.buildShip(this.playerId, this.system, this.slot) }
    }
}
