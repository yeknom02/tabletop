// Counts the legal cells at each placement under the printed rule, and the final board shape.
import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import type { Bot } from '../bots/bot.js'
import { MachineState } from '../../../src/index.js'

const players = Number(process.argv[2] ?? 4)
const games = Number(process.argv[3] ?? 200)
const cellCounts: number[][] = []
const shapes: string[] = []
let lastState: any
function wrap(bot: Bot): Bot {
    return {
        name: bot.name,
        decide(context) {
            const { state } = context
            lastState = state
            if (state.machineState === MachineState.Placing) {
                const pending = state.pendingPlacement()
                if (pending) {
                    const cells = state
                        .grid()
                        .legalPlacements(pending.tileId, pending.faceUp).length
                    const index = state.board.stations.length - 4
                    ;(cellCounts[index] ??= []).push(cells)
                }
            }
            return bot.decide(context)
        }
    }
}
for (let seed = 1; seed <= games; seed++) {
    const bots = Array.from({ length: players }, () => wrap(makeBot('stacker{margin=3}')))
    playGame({
        seed,
        bots,
        variant: { cubesPerRound: 2, routeTarget: 'next' as any, startPlayer: 'clockwise' as any }
    })
    const cols = lastState.board.stations.map((s: any) => s.cell.col)
    const rows = lastState.board.stations.map((s: any) => s.cell.row)
    const w = Math.max(...cols, 0) - Math.min(...cols, 0) + 1
    const h = Math.max(...rows, 0) - Math.min(...rows, 0) + 1
    shapes.push(`${Math.min(w, h)}x${Math.max(w, h)}`)
}
const all = cellCounts.flat()
const pct = (n: number) => ((100 * n) / all.length).toFixed(0) + '%'
console.log(`${players}p, ${games} games, ${all.length} placements`)
console.log(
    'cells offered: 1 =',
    pct(all.filter((c) => c === 1).length),
    ' 2 =',
    pct(all.filter((c) => c === 2).length),
    ' 3-4 =',
    pct(all.filter((c) => c >= 3 && c <= 4).length),
    ' 5+ =',
    pct(all.filter((c) => c >= 5).length)
)
console.log(
    'by placement #:',
    cellCounts
        .map(
            (c, i) =>
                `${i + 1}:${(c.reduce((a, b) => a + b, 0) / c.length).toFixed(1)}/${Math.round((100 * c.filter((x) => x === 1).length) / c.length)}%`
        )
        .join(' ')
)
const tally = new Map<string, number>()
for (const s of shapes) tally.set(s, (tally.get(s) ?? 0) + 1)
console.log(
    'final board:',
    [...tally]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([s, n]) => `${s} ${n}`)
        .join(', ')
)
