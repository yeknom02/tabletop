import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ChapterEnd, HydratedArcsGameState } from '../model/gameState.js'

// The chapter is over: score, clean up, and deal new hands, which is a reveal (rule 6.2).
export type EndChapter = Type.Static<typeof EndChapter>
export const EndChapter = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.EndChapter),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(ChapterEnd)
        })
    ])
)

export const EndChapterValidator = Compile(EndChapter)

export function isEndChapter(action?: GameAction): action is EndChapter {
    return action?.type === ActionType.EndChapter
}

export class HydratedEndChapter extends HydratableAction<typeof EndChapter> implements EndChapter {
    declare type: ActionType.EndChapter
    declare revealsInfo: true
    declare metadata?: ChapterEnd

    constructor(data: EndChapter) {
        super(data, EndChapterValidator)
    }

    apply(state: HydratedArcsGameState) {
        this.metadata = state.endChapter()
    }
}
