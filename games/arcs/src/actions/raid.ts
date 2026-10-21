import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Resource, ResourceSchema } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

export type RaidMetadata = Type.Static<typeof RaidMetadata>
export const RaidMetadata = Type.Object({
    resource: Type.Optional(ResourceSchema),
    discarded: Type.Optional(ResourceSchema),
    cardId: Type.Optional(Type.String())
})

// Spend keys to steal the defender's resource from one slot, or one of their Guild cards
// (rule 7.7.5). With no empty slot, `discard` names the resource to give up for the stolen one.
export type Raid = Type.Static<typeof Raid>
export const Raid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Raid),
            playerId: Type.String(),
            slot: Type.Optional(Type.Integer({ minimum: 0 })),
            cardId: Type.Optional(Type.String()),
            discard: Type.Optional(ResourceSchema),
            metadata: Type.Optional(RaidMetadata)
        })
    ])
)

export const RaidValidator = Compile(Raid)

export function isRaid(action?: GameAction): action is Raid {
    return action?.type === ActionType.Raid
}

export class HydratedRaid extends HydratableAction<typeof Raid> implements Raid {
    declare type: ActionType.Raid
    declare playerId: string
    declare slot?: number
    declare cardId?: string
    declare discard?: Resource
    declare metadata?: RaidMetadata

    constructor(data: Raid) {
        super(data, RaidValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = state.raid(
            this.playerId,
            { slot: this.slot, cardId: this.cardId },
            this.discard
        )
    }
}
