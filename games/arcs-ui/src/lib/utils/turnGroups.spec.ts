import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { turnGroups } from './turnGroups.js'

const action = (id: string, playerId?: string): GameAction => ({
    id,
    gameId: 'game',
    source: playerId ? ActionSource.User : ActionSource.System,
    type: 'Test',
    ...(playerId ? { playerId } : {})
})

describe('turnGroups', () => {
    it('groups consecutive actions by player, with System Actions in the group before them', () => {
        const groups = turnGroups([
            action('1', 'a'),
            action('2', 'a'),
            action('3'),
            action('4', 'b'),
            action('5', 'a')
        ])
        expect(groups.map((group) => [group.playerId, group.actions.map(({ id }) => id)])).toEqual([
            ['a', ['1', '2', '3']],
            ['b', ['4']],
            ['a', ['5']]
        ])
    })

    it('starts a group for System Actions with no player before them', () => {
        expect(turnGroups([action('1'), action('2', 'a')]).map((group) => group.playerId)).toEqual([
            undefined,
            'a'
        ])
    })
})
