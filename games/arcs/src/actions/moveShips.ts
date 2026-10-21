import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import type { ShipsMoving } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Move ships from one system, Catapulting on from a Loyal starport, dropping ships off along the way (rule 7.3). `dropOffs` has one entry per system passed through, before the last.
export type MoveShips = Type.Static<typeof MoveShips>
export const MoveShips = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveShips),
            playerId: Type.String(),
            from: SystemIdSchema,
            path: Type.Array(SystemIdSchema, { minItems: 1 }),
            fresh: Type.Integer({ minimum: 0 }),
            damaged: Type.Integer({ minimum: 0 }),
            dropOffs: Type.Array(
                Type.Object({
                    fresh: Type.Integer({ minimum: 0 }),
                    damaged: Type.Integer({ minimum: 0 })
                })
            ),
            via: Type.Optional(ResourceSchema),
            // The token spent, when a card lets another resource stand in for `via`.
            token: Type.Optional(ResourceSchema)
        })
    ])
)

export const MoveShipsValidator = Compile(MoveShips)

export function isMoveShips(action?: GameAction): action is MoveShips {
    return action?.type === ActionType.MoveShips
}

export class HydratedMoveShips extends HydratableAction<typeof MoveShips> implements MoveShips {
    declare type: ActionType.MoveShips
    declare playerId: string
    declare from: SystemId
    declare path: SystemId[]
    declare fresh: number
    declare damaged: number
    declare dropOffs: ShipsMoving[]
    declare via?: Resource
    declare token?: Resource

    constructor(data: MoveShips) {
        super(data, MoveShipsValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Move, this.via, this.token)
        state.move(
            this.playerId,
            this.from,
            this.path,
            { fresh: this.fresh, damaged: this.damaged },
            this.dropOffs
        )
    }
}
