import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { StandardAction } from '../components/actionCards.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { VoxChoice, VoxResult } from '../model/courtEffects.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type SecureResult = Type.Static<typeof SecureResult>
export const SecureResult = Type.Object({
    captured: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
    vox: Type.Optional(VoxResult)
})

// Take a Court card on which the player has more agents than each Rival, capturing theirs (rule 7.6).
export type Secure = Type.Static<typeof Secure>
export const Secure = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Secure),
            playerId: Type.String(),
            cardId: Type.String(),
            // The choices for a Vox card's When Secured action.
            vox: Type.Optional(VoxChoice),
            via: Type.Optional(ResourceSchema),
            // The token spent, when a card lets another resource stand in for `via`.
            token: Type.Optional(ResourceSchema),
            metadata: Type.Optional(SecureResult)
        })
    ])
)

export const SecureValidator = Compile(Secure)

export function isSecure(action?: GameAction): action is Secure {
    return action?.type === ActionType.Secure
}

export class HydratedSecure extends HydratableAction<typeof Secure> implements Secure {
    declare type: ActionType.Secure
    declare playerId: string
    declare cardId: string
    declare vox?: VoxChoice
    declare via?: Resource
    declare token?: Resource
    declare metadata?: SecureResult

    constructor(data: Secure) {
        super(data, SecureValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.pay(this.playerId, StandardAction.Secure, this.via, this.token)
        const secured = state.secure(this.playerId, this.cardId, this.vox)
        this.metadata = {
            captured: secured.taken,
            ...(secured.vox ? { vox: secured.vox } : {})
        }
    }
}
