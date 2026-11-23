import type { GameAction } from '@tabletop/common'
import {
    isBuyTile,
    isFillMarket,
    isLoseInfrastructure,
    isPassTile,
    isPayRevenue,
    isPlaceBid,
    isPlaceTile,
    Rounds,
    stationTile
} from '@tabletop/conduit'

export type HistoryDivider = { kind: 'divider'; key: string; label: string }

export type HistoryEntry = {
    kind: 'entry'
    key: string
    title: string
    playerId?: string
    lines: string[]
    // Index of the last action in the entry, for jumping to the table as it then stood.
    lastIndex: number
}

export type HistoryItem = HistoryDivider | HistoryEntry

type Name = (playerId: string) => string

const tileName = (tileId: number) => `${stationTile(tileId).letter} tile`
const dollars = (amount: number) => `$${amount}`
const cubes = (count: number) => `${count} cube${count === 1 ? '' : 's'}`

// Describes one action from its input and metadata alone.
export function describeAction(action: GameAction, name: Name): string | undefined {
    const who = action.playerId ? name(action.playerId) : ''
    if (isPlaceBid(action)) {
        return `${who} bid on spot ${action.slot + 1}`
    }
    if (isBuyTile(action) && action.metadata) {
        const paid = action.metadata.payments
            .map((payment) => `${name(payment.playerId)} ${dollars(payment.amount)}`)
            .join(', ')
        return `${who} bought the ${tileName(action.metadata.tileId)} for ${dollars(action.metadata.price)}${paid ? ` (paid ${paid})` : ''}`
    }
    if (isPassTile(action) && action.metadata) {
        return `${who} passed on the ${tileName(action.metadata.tileId)}, taking $1 and ${cubes(action.metadata.cubes)} back`
    }
    if (isPlaceTile(action) && action.metadata) {
        return action.metadata.faceUp
            ? `${who} placed it with ${cubes(1 + action.extraCubes)}`
            : `${who} placed the ${tileName(action.metadata.tileId)} face down`
    }
    if (isFillMarket(action) && action.metadata) {
        return `Market: ${action.metadata.tileIds.map((tileId) => stationTile(tileId).letter).join(' ')}`
    }
    if (isPayRevenue(action) && action.metadata) {
        const paid = action.metadata.revenues
        return paid.length === 0
            ? 'No stations earned'
            : paid
                  .map(
                      (revenue) =>
                          `${name(revenue.playerId)}: ${tileName(revenue.tileId)} ${revenue.amount > 0 ? dollars(revenue.amount) : 'no route'}`
                  )
                  .join('; ')
    }
    if (isLoseInfrastructure(action) && action.metadata) {
        const flipped = action.metadata.flippedTileIds.length
        return flipped === 0
            ? 'No stations went dark'
            : `${flipped} station${flipped === 1 ? '' : 's'} went dark`
    }
    return undefined
}

function tileOf(action: GameAction): number | undefined {
    if ((isBuyTile(action) || isPassTile(action) || isPlaceTile(action)) && action.metadata) {
        return action.metadata.tileId
    }
    return undefined
}

// Groups the actions into history entries: a round's market, its bidding, each tile's offers and
// placement, revenue and infrastructure loss, with a divider at each round and the final payouts.
export function historyItems(actions: readonly GameAction[], name: Name): HistoryItem[] {
    const items: HistoryItem[] = [{ kind: 'divider', key: 'round-1', label: 'Round 1' }]
    let open: HistoryEntry | undefined
    let groupKey: string | undefined
    let round = 1

    const close = () => {
        open = undefined
        groupKey = undefined
    }

    actions.forEach((action, index) => {
        const line = describeAction(action, name)
        if (line === undefined) {
            return
        }
        if (isFillMarket(action) && action.metadata) {
            close()
            round = action.metadata.round
            items.push({ kind: 'divider', key: `round-${round}`, label: `Round ${round}` })
        }
        const tileId = tileOf(action)
        const key = isPlaceBid(action)
            ? 'bidding'
            : tileId !== undefined
              ? `tile-${tileId}`
              : `${action.type}-${index}`
        if (open && groupKey === key) {
            open.lines.push(line)
            open.lastIndex = index
            return
        }
        const title = isPlaceBid(action)
            ? 'Bidding'
            : tileId !== undefined
              ? `The ${tileName(tileId)}`
              : isFillMarket(action)
                ? 'New market'
                : isPayRevenue(action)
                  ? 'Revenue'
                  : 'Infrastructure loss'
        open = { kind: 'entry', key: action.id, title, lines: [line], lastIndex: index }
        groupKey = key
        items.push(open)
        if (isLoseInfrastructure(action) && action.metadata?.roundEnded && round === Rounds) {
            close()
            items.push({ kind: 'divider', key: 'final-payouts', label: 'Final payouts' })
        }
    })
    return items
}
