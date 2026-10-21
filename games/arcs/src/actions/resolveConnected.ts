import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { VoxChoice, VoxResult } from '../model/courtEffects.js'
import { resolveConnected } from '../model/declaration.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Noble, Connected: the choices for the When Secured action of the Vox card drawn.
export type ResolveConnected = Type.Static<typeof ResolveConnected>
export const ResolveConnected = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveConnected),
            playerId: Type.String(),
            vox: Type.Optional(VoxChoice),
            metadata: Type.Optional(VoxResult)
        })
    ])
)

export const ResolveConnectedValidator = Compile(ResolveConnected)

export function isResolveConnected(action?: GameAction): action is ResolveConnected {
    return action?.type === ActionType.ResolveConnected
}

export class HydratedResolveConnected
    extends HydratableAction<typeof ResolveConnected>
    implements ResolveConnected
{
    declare type: ActionType.ResolveConnected
    declare playerId: string
    declare vox?: VoxChoice
    declare metadata?: VoxResult

    constructor(data: ResolveConnected) {
        super(data, ResolveConnectedValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = resolveConnected(state, this.playerId, this.vox)
    }
}
