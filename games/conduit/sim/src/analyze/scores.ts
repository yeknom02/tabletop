import { basename } from 'node:path'
import type { GameRecord } from '../game.js'
import { loadRun, meanCI, winShare } from './load.js'

// End-game scores: final cash of the winner, runner-up and last place, the winner's margin, how
// many games are close or tied, plus seat win shares. Runs joined with "+" are pooled
// (e.g. v13-flat-cap4-5p+v13-flat-cap4-5p-more).
// Usage: tsx sim/src/analyze/scores.ts <run dir>[+<run dir>]...
const mean = (values: number[]) => meanCI(values).mean
const pct = (part: number, whole: number) => `${Math.round((100 * part) / whole)}%`
const quantile = (values: number[], q: number) => {
    const sorted = values.toSorted((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}

console.log(
    [
        'run',
        'games',
        'winner $ mean (p10–p90)',
        '2nd $',
        'last $',
        'player $ mean',
        'winner margin (median)',
        'margin ≤ $2',
        'tied on cash',
        'seat wins ±95%',
        'spread'
    ].join(' | ')
)
for (const arg of process.argv.slice(2)) {
    const dirs = arg.split('+')
    const games: GameRecord[] = dirs.flatMap((dir) => loadRun(dir).games)
    if (games.length === 0) continue
    const players = games[0].players
    const ranked = games.map((game) => game.finalCash.toSorted((a, b) => b - a))
    const winners = ranked.map((cash) => cash[0])
    const margins = ranked.map((cash) => cash[0] - cash[1])
    const seats = Array.from({ length: players }, (_, seat) =>
        meanCI(games.map((game) => winShare(game, seat)))
    )
    const seatMeans = seats.map((ci) => ci.mean)
    console.log(
        [
            basename(dirs[0]) + (dirs.length > 1 ? ` (+${dirs.length - 1})` : ''),
            String(games.length),
            `$${mean(winners).toFixed(1)} ($${quantile(winners, 0.1)}–$${quantile(winners, 0.9)})`,
            `$${mean(ranked.map((cash) => cash[1])).toFixed(1)}`,
            `$${mean(ranked.map((cash) => cash[players - 1])).toFixed(1)}`,
            `$${mean(ranked.flat()).toFixed(1)}`,
            `$${mean(margins).toFixed(1)} ($${quantile(margins, 0.5)})`,
            pct(margins.filter((margin) => margin <= 2).length, games.length),
            pct(margins.filter((margin) => margin === 0).length, games.length),
            `${seatMeans.map((value) => value.toFixed(2)).join('/')} ±${(
                (seats[0].high - seats[0].low) /
                2
            ).toFixed(2)}`,
            (Math.max(...seatMeans) - Math.min(...seatMeans)).toFixed(2)
        ].join(' | ')
    )
}
