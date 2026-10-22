import type { GameAction } from '@tabletop/common'
import { isEndChapter, type AmbitionAward } from '@tabletop/arcs'

export type ChapterScore = { chapter: number; awards: AmbitionAward[] }

// The ambitions scored at each chapter's end in the history. The last scoring was this chapter's
// if the game is over, and the one before it otherwise.
export function chapterScores(
    actions: readonly GameAction[],
    chapter: number,
    gameOver: boolean
): ChapterScore[] {
    const ends = actions.filter(isEndChapter)
    const last = gameOver ? chapter : chapter - 1
    return ends.map((end, index) => ({
        chapter: last - (ends.length - 1 - index),
        awards: end.metadata?.awards ?? []
    }))
}

// The Power a player gained from ambitions in one chapter.
export function chapterPower(score: ChapterScore, playerId: string): number {
    return score.awards
        .filter((award) => award.playerId === playerId)
        .reduce((sum, award) => sum + award.power, 0)
}
