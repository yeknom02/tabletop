import type { GameAction } from '@tabletop/common'

export type TurnGroup = { playerId?: string; actions: GameAction[] }

// Consecutive Actions by one player form a group; System Actions join the group they follow.
export function turnGroups(actions: readonly GameAction[]): TurnGroup[] {
    const groups: TurnGroup[] = []
    for (const action of actions) {
        const last = groups.at(-1)
        if (last && (!action.playerId || action.playerId === last.playerId)) {
            last.actions.push(action)
        } else {
            groups.push({ playerId: action.playerId, actions: [action] })
        }
    }
    return groups
}
