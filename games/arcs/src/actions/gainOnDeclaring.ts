import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Resource, ResourceSchema } from '../components/resources.js'
import { gainOnDeclaring } from '../model/declaration.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Upstart, Ambitious: gain any resource on declaring an ambition.
export type GainOnDeclaring = Type.Static<typeof GainOnDeclaring>
export const GainOnDeclaring = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.GainOnDeclaring),
            playerId: Type.String(),
            // None, to decline.
            resource: Type.Optional(ResourceSchema),
            discard: Type.Optional(Type.Array(ResourceSchema))
        })
    ])
)

export const GainOnDeclaringValidator = Compile(GainOnDeclaring)

export function isGainOnDeclaring(action?: GameAction): action is GainOnDeclaring {
    return action?.type === ActionType.GainOnDeclaring
}

export class HydratedGainOnDeclaring
    extends HydratableAction<typeof GainOnDeclaring>
    implements GainOnDeclaring
{
    declare type: ActionType.GainOnDeclaring
    declare playerId: string
    declare resource?: Resource
    declare discard?: Resource[]

    constructor(data: GainOnDeclaring) {
        super(data, GainOnDeclaringValidator)
    }

    apply(state: HydratedArcsGameState) {
        gainOnDeclaring(state, this.playerId, this.resource, this.discard ?? [])
    }
}
