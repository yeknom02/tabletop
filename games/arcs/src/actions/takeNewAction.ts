import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import type { SystemId } from '../components/map.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import {
    NewActionChoice,
    NewActionName,
    NewActionResult,
    NewActions,
    takeNewAction
} from '../model/courtEffects.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// A card's new action, taken in place of the standard action it names, paid the same way (rule 8.2).
export type TakeNewAction = Type.Static<typeof TakeNewAction>
export const TakeNewAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        NewActionChoice,
        Type.Object({
            type: Type.Literal(ActionType.TakeNewAction),
            playerId: Type.String(),
            via: Type.Optional(ResourceSchema),
            // The token spent, when a card lets another resource stand in for `via`.
            token: Type.Optional(ResourceSchema),
            metadata: Type.Optional(NewActionResult)
        })
    ])
)

export const TakeNewActionValidator = Compile(TakeNewAction)

export function isTakeNewAction(action?: GameAction): action is TakeNewAction {
    return action?.type === ActionType.TakeNewAction
}

export class HydratedTakeNewAction
    extends HydratableAction<typeof TakeNewAction>
    implements TakeNewAction
{
    declare type: ActionType.TakeNewAction
    declare playerId: string
    declare name: NewActionName
    declare discard?: Resource[]
    declare captives?: Record<string, number>
    declare gains?: Resource[]
    declare courtCardId?: string
    declare system?: SystemId
    declare slot?: number
    declare give?: Resource
    declare via?: Resource
    declare token?: Resource
    declare metadata?: NewActionResult

    constructor(data: TakeNewAction) {
        super(data, TakeNewActionValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, NewActions[this.name].replaces, this.via, this.token)
        this.metadata = takeNewAction(state, this.playerId, this)
    }
}
