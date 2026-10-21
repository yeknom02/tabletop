import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { BuildingKind } from '../model/pieces.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type BuildBuildingResult = Type.Static<typeof BuildBuildingResult>
export const BuildBuildingResult = Type.Object({ damaged: Type.Boolean() })

// Build a city or starport in an empty slot where the player has a piece (rule 7.2).
export type BuildBuilding = Type.Static<typeof BuildBuilding>
export const BuildBuilding = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildBuilding),
            playerId: Type.String(),
            system: SystemIdSchema,
            building: Type.Enum(BuildingKind),
            via: Type.Optional(ResourceSchema),
            metadata: Type.Optional(BuildBuildingResult)
        })
    ])
)

export const BuildBuildingValidator = Compile(BuildBuilding)

export function isBuildBuilding(action?: GameAction): action is BuildBuilding {
    return action?.type === ActionType.BuildBuilding
}

export class HydratedBuildBuilding
    extends HydratableAction<typeof BuildBuilding>
    implements BuildBuilding
{
    declare type: ActionType.BuildBuilding
    declare playerId: string
    declare system: SystemId
    declare building: BuildingKind
    declare via?: Resource
    declare metadata?: BuildBuildingResult

    constructor(data: BuildBuilding) {
        super(data, BuildBuildingValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Build, this.via)
        this.metadata = { damaged: state.buildBuilding(this.playerId, this.system, this.building) }
    }
}
