import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import type { Ambition } from '../components/actionCards.js'
import type { Resource } from '../components/resources.js'
import { ActionType } from '../definition/actions.js'
import type { VoxChoice } from '../model/courtEffects.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { LoreUse, LoreUseResult, useLore } from '../model/loreEffects.js'
import type { Trophy } from '../model/pieces.js'

// Prelude: use a lore card's Prelude ability (rule 8.1).
export type UseLore = Type.Static<typeof UseLore>
export const UseLore = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        LoreUse,
        Type.Object({
            type: Type.Literal(ActionType.UseLore),
            playerId: Type.String(),
            metadata: Type.Optional(LoreUseResult)
        })
    ])
)

export const UseLoreValidator = Compile(UseLore)

export function isUseLore(action?: GameAction): action is UseLore {
    return action?.type === ActionType.UseLore
}

export class HydratedUseLore extends HydratableAction<typeof UseLore> implements UseLore {
    declare type: ActionType.UseLore
    declare playerId: string
    declare cardId: string
    declare clear?: boolean
    declare discard?: Resource
    declare gain?: Resource
    declare trophy?: Trophy
    declare influence?: string
    declare captive?: string
    declare secure?: string
    declare vox?: VoxChoice
    declare ambition?: Ambition
    declare metadata?: LoreUseResult

    constructor(data: UseLore) {
        super(data, UseLoreValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = useLore(state, this.playerId, this)
    }
}
