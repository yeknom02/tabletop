import { basename } from 'node:path'
import { loadRun, meanCI } from './load.js'

// Route-toll figures per run: how much income tolls make up, how many tolls a route pays, and how
// crowded new stations are when placed.
// Usage: tsx sim/src/analyze/toll.ts <run dir>...
const mean = (values: number[]) => (values.length ? meanCI(values).mean : 0)
console.log(
    'run | route income/player | toll income/player | toll share | winner toll share | tolls/route (0/1/2+) | stations/route | neighbours at placement'
)
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    const base: number[] = []
    const toll: number[] = []
    const winnerShare: number[] = []
    for (const game of games) {
        for (let seat = 0; seat < game.players; seat++) {
            const route = game.revenues
                .filter((revenue) => revenue.seat === seat)
                .reduce((total, revenue) => total + revenue.amount, 0)
            const tolls = game.tollIncome?.[seat] ?? 0
            base.push(route)
            toll.push(tolls)
            if (game.winners.includes(seat) && route + tolls > 0) {
                winnerShare.push(tolls / (route + tolls))
            }
        }
    }
    const routes = games.flatMap((game) => game.tollsPerRoute ?? [])
    const share = (keep: (n: number) => boolean) =>
        `${((100 * routes.filter(keep).length) / Math.max(routes.length, 1)).toFixed(0)}%`
    const totalBase = base.reduce((a, b) => a + b, 0)
    const totalToll = toll.reduce((a, b) => a + b, 0)
    console.log(
        [
            basename(dir),
            mean(base).toFixed(1),
            mean(toll).toFixed(1),
            `${((100 * totalToll) / (totalBase + totalToll)).toFixed(0)}%`,
            `${(100 * mean(winnerShare)).toFixed(0)}%`,
            `${mean(routes).toFixed(2)} (${share((n) => n === 0)}/${share((n) => n === 1)}/${share((n) => n >= 2)})`,
            mean(
                games.flatMap((game) =>
                    game.revenues.filter((r) => r.amount > 0).map((r) => r.stations)
                )
            ).toFixed(2),
            mean(games.flatMap((game) => game.placedNeighbors ?? [])).toFixed(2)
        ].join(' | ')
    )
}
