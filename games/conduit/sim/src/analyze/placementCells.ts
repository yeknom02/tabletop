// Counts the legal cells at each placement, and the final grid's shape.
// Usage: tsx sim/src/analyze/placementCells.ts <players> <games>
import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import type { Bot } from '../bots/bot.js'
import {
    MachineState,
    MarketDeal,
    RouteTarget,
    StartPlayerRule,
    type HydratedConduitGameState
} from '../../../src/index.js'

const players = Number(process.argv[2] ?? 4)
const games = Number(process.argv[3] ?? 200)
const cellCounts: number[][] = []
const shapes: string[] = []
let lastState: HydratedConduitGameState | undefined

function counting(bot: Bot): Bot {
    return {
        name: bot.name,
        decide(context) {
            const { state } = context
            lastState = state
            const pending = state.pendingPlacement()
            if (state.machineState === MachineState.Placing && pending) {
                const cells = state.grid().legalPlacements(pending.tileId, pending.faceUp).length
                ;(cellCounts[state.board.stations.length - 4] ??= []).push(cells)
            }
            return bot.decide(context)
        }
    }
}

for (let seed = 1; seed <= games; seed++) {
    playGame({
        seed,
        bots: Array.from({ length: players }, () => counting(makeBot('stacker{margin=3}'))),
        variant: {
            cubesPerRound: 2,
            routeTarget: RouteTarget.SameLetter,
            startPlayer: StartPlayerRule.Clockwise,
            minimumBids: 2,
            marketDeal: MarketDeal.Cycle
        }
    })
    const stations = lastState?.board.stations ?? []
    const span = (values: number[]) => Math.max(...values, 0) - Math.min(...values, 0) + 1
    const w = span(stations.map((station) => station.cell.col))
    const h = span(stations.map((station) => station.cell.row))
    shapes.push(`${Math.min(w, h)}x${Math.max(w, h)}`)
}

const all = cellCounts.flat()
const share = (keep: (count: number) => boolean) =>
    `${((100 * all.filter(keep).length) / all.length).toFixed(0)}%`
console.log(`${players}p, ${games} games, ${all.length} placements`)
console.log(
    `cells offered: 1 = ${share((c) => c === 1)}, 2 = ${share((c) => c === 2)},`,
    `3-4 = ${share((c) => c >= 3 && c <= 4)}, 5+ = ${share((c) => c >= 5)}`
)
console.log(
    'by placement (average cells / share with one):',
    cellCounts
        .map((counts, index) => {
            const average = counts.reduce((a, b) => a + b, 0) / counts.length
            const single = Math.round((100 * counts.filter((c) => c === 1).length) / counts.length)
            return `${index + 1}:${average.toFixed(1)}/${single}%`
        })
        .join(' ')
)
const tally = new Map<string, number>()
for (const shape of shapes) tally.set(shape, (tally.get(shape) ?? 0) + 1)
console.log(
    'final grid:',
    [...tally]
        .sort((a, b) => b[1] - a[1])
        .map(([shape, count]) => `${shape} ${count}`)
        .join(', ')
)
