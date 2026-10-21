import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Archivist, Learned: keep 2 of the 5 lore drawn; the rest are scrapped.
export type KeepLore = Type.Static<typeof KeepLore>
export const KeepLore = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.KeepLore),
            playerId: Type.String(),
            cardIds: Type.Array(Type.String())
        })
    ])
)

export const KeepLoreValidator = Compile(KeepLore)

export function isKeepLore(action?: GameAction): action is KeepLore {
    return action?.type === ActionType.KeepLore
}

export class HydratedKeepLore extends HydratableAction<typeof KeepLore> implements KeepLore {
    declare type: ActionType.KeepLore
    declare playerId: string
    declare cardIds: string[]

    constructor(data: KeepLore) {
        super(data, KeepLoreValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.keepLore(this.playerId, this.cardIds)
    }
}
