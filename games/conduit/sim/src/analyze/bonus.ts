import { basename } from 'node:path'
import { loadRun, meanCI } from './load.js'

// Route-bonus figures per run: how much income bonuses make up, how many bonuses a route pays, and how
// crowded new stations are when placed.
// Usage: tsx sim/src/analyze/bonus.ts <run dir>...
const mean = (values: number[]) => (values.length ? meanCI(values).mean : 0)
console.log(
    'run | route income/player | bonus income/player | bonus share | winner bonus share | bonuses/route (0/1/2+) | stations/route | neighbours at placement'
)
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    const base: number[] = []
    const bonus: number[] = []
    const winnerShare: number[] = []
    for (const game of games) {
        for (let seat = 0; seat < game.players; seat++) {
            const route = game.revenues
                .filter((revenue) => revenue.seat === seat)
                .reduce((total, revenue) => total + revenue.amount, 0)
            const bonuses = game.bonusIncome?.[seat] ?? 0
            base.push(route)
            bonus.push(bonuses)
            if (game.winners.includes(seat) && route + bonuses > 0) {
                winnerShare.push(bonuses / (route + bonuses))
            }
        }
    }
    const routes = games.flatMap((game) => game.bonusesPerRoute ?? [])
    const share = (keep: (n: number) => boolean) =>
        `${((100 * routes.filter(keep).length) / Math.max(routes.length, 1)).toFixed(0)}%`
    const totalBase = base.reduce((a, b) => a + b, 0)
    const totalBonus = bonus.reduce((a, b) => a + b, 0)
    console.log(
        [
            basename(dir),
            mean(base).toFixed(1),
            mean(bonus).toFixed(1),
            `${((100 * totalBonus) / (totalBase + totalBonus)).toFixed(0)}%`,
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
