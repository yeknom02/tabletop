import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { BuildingHits, ShipHits } from '../model/battle.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { BuildingKind } from '../model/pieces.js'

export type HitsResult = Type.Static<typeof HitsResult>
export const HitsResult = Type.Object({
    attackerShipsDestroyed: Type.Integer({ minimum: 0 }),
    defenderShipsDestroyed: Type.Integer({ minimum: 0 }),
    buildingsDestroyed: Type.Array(Type.Enum(BuildingKind)),
    outraged: Type.Array(ResourceSchema)
})

// The attacker places every rolled hit: self-hits and intercepts on their own ships, hits on the
// defender's ships and then buildings, building hits on buildings (rules 7.7.1.4–7.7.4).
export type AssignHits = Type.Static<typeof AssignHits>
export const AssignHits = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AssignHits),
            playerId: Type.String(),
            attacking: ShipHits,
            defending: ShipHits,
            buildings: Type.Array(BuildingHits),
            metadata: Type.Optional(HitsResult)
        })
    ])
)

export const AssignHitsValidator = Compile(AssignHits)

export function isAssignHits(action?: GameAction): action is AssignHits {
    return action?.type === ActionType.AssignHits
}

export class HydratedAssignHits extends HydratableAction<typeof AssignHits> implements AssignHits {
    declare type: ActionType.AssignHits
    declare playerId: string
    declare attacking: ShipHits
    declare defending: ShipHits
    declare buildings: BuildingHits[]
    declare metadata?: HitsResult

    constructor(data: AssignHits) {
        super(data, AssignHitsValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = state.assignHits(
            this.playerId,
            this.attacking,
            this.defending,
            this.buildings
        )
    }
}
