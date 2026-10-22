import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { ActionType, NewActionName, type MoveShips, type TakeNewAction } from '@tabletop/arcs'
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

describe('a new action', () => {
    it('tells the ships Guide moved', () => {
        const guide: TakeNewAction = {
            id: 'guide',
            gameId: 'game',
            source: ActionSource.User,
            type: ActionType.TakeNewAction,
            playerId: 'a',
            name: NewActionName.Guide,
            system: '1C',
            to: '1G',
            ships: { a: { fresh: 2, damaged: 0 }, b: { fresh: 1, damaged: 1 } },
            metadata: { gained: [], discarded: [], captured: {} }
        }
        expect(describeAction(guide, names)).toBe('Amira used Guide, moving 4 ships from 1C to 1G')
    })
})
