import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { VoxChoice } from '../model/courtEffects.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type RuthlessMetadata = Type.Static<typeof RuthlessMetadata>
export const RuthlessMetadata = Type.Object({
    destroyed: Type.Boolean(),
    gained: Type.Array(ResourceSchema),
    discarded: Type.Array(ResourceSchema)
})

// Overseer, Ruthless: once per turn, straight after a tax or ship build, hit that building to take
// the action again. `ransack` names the Court card to secure if a Rival city is destroyed.
export type Ruthless = Type.Static<typeof Ruthless>
export const Ruthless = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Ruthless),
            playerId: Type.String(),
            discard: Type.Optional(Type.Array(ResourceSchema)),
            ransack: Type.Optional(Type.String()),
            vox: Type.Optional(VoxChoice),
            metadata: Type.Optional(RuthlessMetadata)
        })
    ])
)

export const RuthlessValidator = Compile(Ruthless)

export function isRuthless(action?: GameAction): action is Ruthless {
    return action?.type === ActionType.Ruthless
}

export class HydratedRuthless extends HydratableAction<typeof Ruthless> implements Ruthless {
    declare type: ActionType.Ruthless
    declare playerId: string
    declare discard?: Resource[]
    declare ransack?: string
    declare vox?: VoxChoice
    declare metadata?: RuthlessMetadata

    constructor(data: Ruthless) {
        super(data, RuthlessValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = state.ruthless(this.playerId, this)
    }
}
