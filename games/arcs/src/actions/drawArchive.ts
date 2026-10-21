import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Archivist, Learned: 5 lore drawn at random after setup, a reveal.
export type DrawArchive = Type.Static<typeof DrawArchive>
export const DrawArchive = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DrawArchive),
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const DrawArchiveValidator = Compile(DrawArchive)

export function isDrawArchive(action?: GameAction): action is DrawArchive {
    return action?.type === ActionType.DrawArchive
}

export class HydratedDrawArchive
    extends HydratableAction<typeof DrawArchive>
    implements DrawArchive
{
    declare type: ActionType.DrawArchive
    declare revealsInfo: true

    constructor(data: DrawArchive) {
        super(data, DrawArchiveValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.drawArchive()
    }
}
