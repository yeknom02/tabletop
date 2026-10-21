import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Shaper, Mythic: straight after taxing, place a resource over the planet's icon, making it that
// planet's type for good.
export type Mythic = Type.Static<typeof Mythic>
export const Mythic = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Mythic),
            playerId: Type.String(),
            resource: ResourceSchema
        })
    ])
)

export const MythicValidator = Compile(Mythic)

export function isMythic(action?: GameAction): action is Mythic {
    return action?.type === ActionType.Mythic
}

export class HydratedMythic extends HydratableAction<typeof Mythic> implements Mythic {
    declare type: ActionType.Mythic
    declare playerId: string
    declare resource: Resource

    constructor(data: Mythic) {
        super(data, MythicValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.mythic(this.playerId, this.resource)
    }
}
