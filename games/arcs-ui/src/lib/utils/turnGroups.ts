import type { GameAction } from '@tabletop/common'

export type TurnGroup = { playerId?: string; actions: GameAction[] }

// Consecutive Actions by one player form a group; System Actions join the group they follow,
// except those `standalone` says start a group of their own.
export function turnGroups(
    actions: readonly GameAction[],
    standalone: (action: GameAction) => boolean = () => false
): TurnGroup[] {
    const groups: TurnGroup[] = []
    for (const action of actions) {
        const last = groups.at(-1)
        const joins = action.playerId ? action.playerId === last?.playerId : !standalone(action)
        if (last && joins) {
            last.actions.push(action)
        } else {
            groups.push({ playerId: action.playerId, actions: [action] })
        }
    }
    return groups
}
