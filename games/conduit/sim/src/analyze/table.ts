import { basename } from 'node:path'
import type { GameRecord } from '../game.js'
import { loadRun, meanCI, winShare } from './load.js'

// One row per run, for comparing variants side by side.
// Usage: tsx sim/src/analyze/table.ts <run dir>...
const mean = (values: number[]) => meanCI(values).mean
const half = (values: number[]) => meanCI(values).high - meanCI(values).mean

function leadersAfter(game: GameRecord, round: number): number[] {
    const cash = game.cashAfterRound[round - 1]
    if (!cash) return []
    const top = Math.max(...cash)
    return cash.flatMap((value, seat) => (value === top ? [seat] : []))
}

function margin(game: GameRecord): number {
    const sorted = [...game.finalCash].sort((a, b) => b - a)
    return sorted[0] - (sorted[1] ?? 0)
}

// Markets that miss at least one of the four letters, and the most copies of one letter.
function marketShape(markets: string[][]) {
    return markets.map((letters) => {
        const counts = ['A', 'B', 'C', 'D'].map((l) => letters.filter((x) => x === l).length)
        return { missing: counts.filter((c) => c === 0).length, most: Math.max(...counts) }
    })
}

console.log(
    [
        'run',
        'games',
        'seat wins (1st..last)',
        'spread',
        'r2 leader wins',
        'margin',
        'cash',
        'price',
        'unbought/g',
        'extra payouts',
        'mkts missing a letter',
        'mkts with 3+ of one'
    ].join(' | ')
)
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    if (games.length === 0) continue
    const players = games[0].players
    const seats = Array.from({ length: players }, (_, seat) =>
        mean(games.map((game) => winShare(game, seat)))
    )
    const seatHalf = half(games.map((game) => winShare(game, 0)))
    const r2 = games.flatMap((game) => {
        const leaders = leadersAfter(game, 2)
        return leaders.length === 1 ? [game.winners.includes(leaders[0]) ? 1 : 0] : []
    })
    const shapes = games.flatMap((game) => marketShape(game.markets ?? []))
    const row = [
        basename(dir),
        String(games.length),
        seats.map((share) => share.toFixed(2)).join('/') + ` ±${seatHalf.toFixed(2)}`,
        (Math.max(...seats) - Math.min(...seats)).toFixed(3),
        mean(r2).toFixed(2),
        mean(games.map(margin)).toFixed(1),
        mean(games.flatMap((game) => game.finalCash)).toFixed(1),
        mean(games.flatMap((game) => game.buys.map((buy) => buy.price))).toFixed(2),
        mean(games.map((game) => game.unboughtByRound.reduce((a, b) => a + (b ?? 0), 0))).toFixed(
            2
        ),
        mean(games.map((game) => game.payoutRoundsAfterLast)).toFixed(2),
        shapes.length
            ? `${((100 * shapes.filter((s) => s.missing > 0).length) / shapes.length).toFixed(0)}%`
            : '-',
        shapes.length
            ? `${((100 * shapes.filter((s) => s.most >= 3).length) / shapes.length).toFixed(0)}%`
            : '-'
    ]
    console.log(row.join(' | '))
}
