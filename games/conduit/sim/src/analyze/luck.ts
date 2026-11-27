import { basename } from 'node:path'
import type { GameRecord } from '../game.js'
import { fmt, loadRun, meanCI, winShare } from './load.js'

// How much skill decides the winner, against luck. For each run where one bot plays against a
// field of another, every seat in turn on the same deals (--rotate):
// - win: the lone bot's win share (fair = 1 / players);
// - margin: the lone bot's final cash minus the field's average, per game;
// - edge: the margin's mean over its standard deviation, the skill signal per game against the
//   game-to-game noise; "games" is how many games the lone bot needs before its total margin is
//   ahead with 95% confidence, (1.645 / edge)²;
// - the margin's variance split by seed (the deal: stack order and cross), seat (where the lone
//   bot sits) and the rest (how the deal and seat combine, and the bots' own random choices), as
//   two-way ANOVA variance components with one game per seed and seat.
// - deal→seat: how much of a seat's margin the deal itself hands that seat, whoever sits there.
//   Every seat's margin, less its occupant's average, grouped by seed and seat: the variance
//   between those groups beyond what the within-group noise explains, as a share of the whole.
// For mirror runs (every seat the same bot) it reports the luck alone: each seat's margin spread
// and win share by seat.
// Usage: tsx sim/src/analyze/luck.ts <run dir>...
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const sd = (values: number[]) => {
    const m = mean(values)
    return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1))
}
const short = (bot: string) => (bot.startsWith('stacker{margin=1,expectMargin=1') ? 'F' : bot)

function margin(game: GameRecord, seat: number): number {
    const others = game.finalCash.filter((_, index) => index !== seat)
    return game.finalCash[seat] - mean(others)
}

// Variance components for a seeds × seats table with one value per cell.
function components(table: number[][]): { seed: number; seat: number; rest: number } {
    const seeds = table.length
    const seats = table[0].length
    const grand = mean(table.flat())
    const seedMeans = table.map(mean)
    const seatMeans = Array.from({ length: seats }, (_, s) => mean(table.map((row) => row[s])))
    let ssSeed = 0
    let ssSeat = 0
    let ssRest = 0
    for (let r = 0; r < seeds; r++) {
        ssSeed += seats * (seedMeans[r] - grand) ** 2
        for (let s = 0; s < seats; s++) {
            ssRest += (table[r][s] - seedMeans[r] - seatMeans[s] + grand) ** 2
        }
    }
    for (let s = 0; s < seats; s++) ssSeat += seeds * (seatMeans[s] - grand) ** 2
    const msRest = ssRest / ((seeds - 1) * (seats - 1))
    return {
        seed: Math.max(0, (ssSeed / (seeds - 1) - msRest) / seats),
        seat: Math.max(0, (ssSeat / (seats - 1) - msRest) / seeds),
        rest: msRest
    }
}

// The share of a seat's margin that the deal gives the seat, whoever plays it (see above).
function dealToSeat(games: GameRecord[]): number {
    const byBot = new Map<string, number[]>()
    for (const game of games) {
        game.bots.forEach((bot, seat) =>
            byBot.set(bot, [...(byBot.get(bot) ?? []), margin(game, seat)])
        )
    }
    const botMean = new Map([...byBot].map(([bot, values]) => [bot, mean(values)]))
    const groups = new Map<string, number[]>()
    for (const game of games) {
        game.bots.forEach((bot, seat) => {
            const key = `${game.seed}:${seat}`
            groups.set(key, [
                ...(groups.get(key) ?? []),
                margin(game, seat) - (botMean.get(bot) ?? 0)
            ])
        })
    }
    const cells = [...groups.values()].filter((values) => values.length > 1)
    if (cells.length < 2) return NaN
    const size = mean(cells.map((values) => values.length))
    const grand = mean(cells.flat())
    const between = cells.reduce((a, values) => a + values.length * (mean(values) - grand) ** 2, 0)
    const within = cells.reduce(
        (a, values) => a + values.reduce((b, value) => b + (value - mean(values)) ** 2, 0),
        0
    )
    const msBetween = between / (cells.length - 1)
    const msWithin = within / (cells.flat().length - cells.length)
    const luck = Math.max(0, (msBetween - msWithin) / size)
    return luck / (luck + msWithin)
}

const header = [
    'run',
    'players',
    'lone bot',
    'field',
    'games',
    'win (fair)',
    'margin $',
    'sd $',
    'edge',
    'games to show',
    'deal %',
    'seat %',
    'rest %',
    'deal→seat %'
]
console.log(header.join(' | '))
console.log(header.map(() => '---').join(' | '))
const mirrors: string[] = []
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    const players = games[0].players
    const names = games[0].bots
    const counts = new Map<string, number>()
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
    if (counts.size === 1) {
        const margins = games.flatMap((game) => game.finalCash.map((_, seat) => margin(game, seat)))
        const seats = Array.from({ length: players }, (_, seat) =>
            meanCI(games.map((game) => winShare(game, seat))).mean.toFixed(3)
        )
        const winnerMargin = games.map((game) => {
            const sorted = [...game.finalCash].sort((a, b) => b - a)
            return sorted[0] - sorted[1]
        })
        mirrors.push(
            `- ${basename(dir)} (${games.length} games, all ${short(names[0])}): seat margin sd ` +
                `$${sd(margins).toFixed(1)}; win by seat ${seats.join('/')}; winner's lead ` +
                `median $${[...winnerMargin].sort((a, b) => a - b)[Math.floor(winnerMargin.length / 2)]}, ` +
                `within $2 ${((100 * winnerMargin.filter((value) => value <= 2).length) / games.length).toFixed(0)}%`
        )
        continue
    }
    const lone = [...counts].find(([, count]) => count === 1)?.[0]
    const fieldBot = [...counts].find(([, count]) => count > 1)?.[0]
    if (!lone || !fieldBot) throw Error(`${dir}: not one bot against a field`)
    const loneSeat = (game: GameRecord) => game.bots.indexOf(lone)
    const margins = games.map((game) => margin(game, loneSeat(game)))
    const bySeed = new Map<number, number[]>()
    for (const game of games) {
        const row = bySeed.get(game.seed) ?? Array.from({ length: players }, () => NaN)
        row[loneSeat(game)] = margin(game, loneSeat(game))
        bySeed.set(game.seed, row)
    }
    const table = [...bySeed.values()].filter((row) => row.every((value) => !Number.isNaN(value)))
    const parts = components(table)
    const total = parts.seed + parts.seat + parts.rest
    const edge = mean(margins) / sd(margins)
    const toShow = Math.abs(edge) > 0.01 ? Math.ceil((1.645 / edge) ** 2) : Infinity
    console.log(
        [
            basename(dir),
            players,
            short(lone),
            short(fieldBot),
            games.length,
            `${fmt(meanCI(games.map((game) => winShare(game, loneSeat(game)))), 3)} (${(1 / players).toFixed(3)})`,
            fmt(meanCI(margins), 1),
            sd(margins).toFixed(1),
            edge.toFixed(2),
            toShow,
            ((100 * parts.seed) / total).toFixed(0),
            ((100 * parts.seat) / total).toFixed(0),
            ((100 * parts.rest) / total).toFixed(0),
            (100 * dealToSeat(games)).toFixed(0)
        ].join(' | ')
    )
}
if (mirrors.length) {
    console.log('\nLuck alone (mirror runs):')
    for (const line of mirrors) console.log(line)
}
