import { basename } from 'node:path'
import { loadRun } from './load.js'

// The cube and cash economy, one row per run: revenue the board pays per game (route income plus
// bonuses), payout rounds after the fifth, stations paying nothing, bids per player per round, cubes in supply at
// the start of rounds 2–5, extras per new station, tile prices and unbought tiles.
// Usage: tsx sim/src/analyze/economy.ts <run dir>...
const mean = (values: number[]) =>
    values.length ? values.reduce((total, value) => total + value, 0) / values.length : NaN

console.log(
    [
        'run',
        'payouts after r5',
        'revenue/game',
        'dead payouts',
        'bids/player/round',
        'supply at round start (r2–5)',
        'extras/station (0/1/2/3)',
        'mean price',
        'unbought/round'
    ].join(' | ')
)
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    if (games.length === 0) continue
    const players = games[0].players
    const bonuses = mean(games.map((game) => game.bonusIncome.reduce((a, b) => a + b, 0)))
    const routeIncome = mean(
        games.map((game) => game.revenues.reduce((total, entry) => total + entry.amount, 0))
    )
    const revenues = games.flatMap((game) => game.revenues)
    const placements = games.flatMap((game) => game.placements.filter((entry) => entry.faceUp))
    const extras = [0, 1, 2, 3].map(
        (count) => placements.filter((entry) => entry.extraCubes === count).length
    )
    const supply = mean(
        games.flatMap((game) => game.supplyAtRoundStart.slice(1).flatMap((seats) => seats))
    )
    console.log(
        [
            basename(dir),
            mean(games.map((game) => game.payoutRoundsAfterLast)).toFixed(1),
            `$${(routeIncome + bonuses).toFixed(0)} (bonuses $${bonuses.toFixed(0)})`,
            `${Math.round((100 * revenues.filter((entry) => entry.amount === 0).length) / revenues.length)}%`,
            mean(games.map((game) => game.bids.reduce((a, b) => a + b, 0) / players / 5)).toFixed(
                1
            ),
            supply.toFixed(1),
            `${mean(placements.map((entry) => entry.extraCubes)).toFixed(2)} (${extras
                .map((count) => `${Math.round((100 * count) / placements.length)}%`)
                .join('/')})`,
            `$${mean(games.flatMap((game) => game.buys.map((entry) => entry.price))).toFixed(2)}`,
            mean(
                games.map((game) => game.unboughtByRound.reduce((a, b) => a + (b ?? 0), 0) / 5)
            ).toFixed(2)
        ].join(' | ')
    )
}
