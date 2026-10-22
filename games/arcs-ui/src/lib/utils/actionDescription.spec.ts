import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { ActionType, type MoveShips } from '@tabletop/arcs'
import { describeAction } from './actionDescription.js'

const names = { name: (playerId: string) => (playerId === 'a' ? 'Amira' : playerId) }

const move = (extra: Partial<MoveShips> = {}): MoveShips => ({
    id: 'move',
    gameId: 'game',
    source: ActionSource.User,
    type: ActionType.MoveShips,
    playerId: 'a',
    from: '1A',
    path: ['1G', '2G', '2A'],
    fresh: 4,
    damaged: 0,
    dropOffs: [
        { fresh: 1, damaged: 0 },
        { fresh: 0, damaged: 0 }
    ],
    ...extra
})

describe('a move', () => {
    it('tells the ships left along the way', () => {
        expect(describeAction(move(), names)).toBe(
            'Amira moved 4 ships from 1A to 2A, leaving 1 at 1G'
        )
    })

    it("tells Sprinter Drives' second move", () => {
        expect(
            describeAction(
                move({ sprint: { from: '2A', path: ['2G'], fresh: 2, dropOffs: [] } }),
                names
            )
        ).toBe(
            'Amira moved 4 ships from 1A to 2A, leaving 1 at 1G and then 2 sprinted from 2A to 2G'
        )
    })
})
