import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { SystemIdSchema, type SystemId } from '../components/map.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// The player is done with their turn, whatever pips are left. A player with no ships or starports
// on the map names the gate where their 3 new ships go (rule 22.2.1).
export type EndTurn = Type.Static<typeof EndTurn>
export const EndTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndTurn),
            playerId: Type.String(),
            returnTo: Type.Optional(SystemIdSchema)
        })
    ])
)

export const EndTurnValidator = Compile(EndTurn)

export function isEndTurn(action?: GameAction): action is EndTurn {
    return action?.type === ActionType.EndTurn
}

export class HydratedEndTurn extends HydratableAction<typeof EndTurn> implements EndTurn {
    declare type: ActionType.EndTurn
    declare playerId: string
    declare returnTo?: SystemId

    constructor(data: EndTurn) {
        super(data, EndTurnValidator)
    }

    apply(state: HydratedArcsGameState) {
        if (this.returnTo !== undefined) {
            state.returnFleet(this.playerId, this.returnTo)
        }
        state.endTurn()
    }
}
