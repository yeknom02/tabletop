import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedConduitGameState } from '../model/gameState.js'

// Who the chosen route's tolls pay, one entry per station passed, for the history.
export type RouteChosen = Type.Static<typeof RouteChosen>
export const RouteChosen = Type.Object({
    tolls: Type.Array(Type.String())
})

// Before revenue, the owner of a station whose equally good routes would pay tolls to different
// players chooses which route it takes (designer ruling, 2026-11-25).
export type ChooseRoute = Type.Static<typeof ChooseRoute>
export const ChooseRoute = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseRoute),
            playerId: Type.String(),
            tileId: Type.Integer(),
            option: Type.Integer({ minimum: 0 }),
            metadata: Type.Optional(RouteChosen)
        })
    ])
)

export const ChooseRouteValidator = Compile(ChooseRoute)

export function isChooseRoute(action?: GameAction): action is ChooseRoute {
    return action?.type === ActionType.ChooseRoute
}

export class HydratedChooseRoute
    extends HydratableAction<typeof ChooseRoute>
    implements ChooseRoute
{
    declare type: ActionType.ChooseRoute
    declare playerId: string
    declare tileId: number
    declare option: number
    declare metadata?: RouteChosen

    constructor(data: ChooseRoute) {
        super(data, ChooseRouteValidator)
    }

    static canChooseRoute(state: HydratedConduitGameState, action: ChooseRoute): boolean {
        const choice = state.pendingRouteChoice()
        return (
            choice !== undefined &&
            choice.playerId === action.playerId &&
            choice.tileId === action.tileId &&
            action.option < choice.options.length
        )
    }

    apply(state: HydratedConduitGameState) {
        const choice = state.pendingRouteChoice()
        state.chooseRoute(this.playerId, this.tileId, this.option)
        this.metadata = { tolls: choice?.options[this.option]?.tolls ?? [] }
    }
}
