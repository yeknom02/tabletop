import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { Ambition, ActionType, type AmbitionAward, type EndChapter } from '@tabletop/arcs'
import { chapterPower, chapterScores } from './chapterScores.js'

const end = (id: string, awards: AmbitionAward[], gameOver = false): EndChapter => ({
    id,
    gameId: 'game',
    source: ActionSource.System,
    type: ActionType.EndChapter,
    revealsInfo: true,
    metadata: { awards, gameOver }
})

const award = (playerId: string, power: number): AmbitionAward => ({
    ambition: Ambition.Tycoon,
    playerId,
    place: 1,
    power
})

describe('chapterScores', () => {
    it('numbers the scorings back from the chapter being played', () => {
        const scores = chapterScores([end('1', []), end('2', [])], 3, false)
        expect(scores.map((score) => score.chapter)).toEqual([1, 2])
    })

    it('counts the current chapter as scored once the game is over', () => {
        const scores = chapterScores([end('1', []), end('2', [], true)], 2, true)
        expect(scores.map((score) => score.chapter)).toEqual([1, 2])
    })

    it("totals each player's Power from the chapter's awards", () => {
        const [score] = chapterScores(
            [end('1', [award('a', 5), award('b', 3), award('a', 2)])],
            2,
            false
        )
        expect(chapterPower(score, 'a')).toBe(7)
        expect(chapterPower(score, 'c')).toBe(0)
    })
})
