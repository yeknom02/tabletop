import { basename } from 'node:path'
import type { GameRecord } from '../game.js'
import { loadRun, meanCI, winShare } from './load.js'

// Letter skew: how unevenly the shuffle dealt the letters, and whether play stays meaningful when it
// is uneven. A game's skew is the most-dealt letter's count minus the least-dealt one's, over every
// tile dealt to a market. Games are split into thirds by skew within each run (ties kept together),
// and each third gets the designer's measures.
// With a mixed lineup (--rotate), "challenger" is the win share of the bot whose spec differs from
// the rest, which shows whether skill still pays.
// Usage: tsx sim/src/analyze/skew.ts <run dir>...
const Obvious = 3
const mean = (values: number[]) => (values.length ? meanCI(values).mean : NaN)
const pct = (part: number, whole: number) => (whole ? `${((100 * part) / whole).toFixed(0)}%` : '-')
const share = <T>(items: T[], keep: (item: T) => boolean) =>
    pct(items.filter(keep).length, items.length)
const gap = (entry: { best?: number; second?: number }) =>
    (entry.best ?? 0) - (entry.second ?? entry.best ?? 0)

export function letterCounts(game: GameRecord): Record<string, number> {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
    for (const letter of game.markets.flat()) counts[letter] = (counts[letter] ?? 0) + 1
    return counts
}

export function skewOf(game: GameRecord): number {
    const counts = Object.values(letterCounts(game))
    return Math.max(...counts) - Math.min(...counts)
}

// Rounds whose market lacks a letter entirely.
function roundsMissingLetter(game: GameRecord): number {
    return game.markets.filter((market) => new Set(market).size < Math.min(4, market.length)).length
}

function challengerSeat(game: GameRecord): number | undefined {
    const counts = new Map<string, number>()
    for (const bot of game.bots) counts.set(bot, (counts.get(bot) ?? 0) + 1)
    const seat = game.bots.findIndex((bot) => counts.get(bot) === 1)
    return seat >= 0 && counts.size === 2 ? seat : undefined
}

function leaderAfterRound2(game: GameRecord): number | undefined {
    const cash = game.cashAfterRound[1]
    if (!cash) return undefined
    const top = Math.max(...cash)
    const leaders = cash.flatMap((value, seat) => (value === top ? [seat] : []))
    return leaders.length === 1 ? leaders[0] : undefined
}

function lopsidedShare(games: GameRecord[]): string {
    let rounds = 0
    let lopsided = 0
    for (const game of games) {
        for (const market of game.roundMarkets ?? []) {
            rounds += 1
            const values = market.values.toSorted((a, b) => b - a)
            if (values.length > 1 && values[0] - values[1] >= Obvious) lopsided += 1
        }
    }
    return pct(lopsided, rounds)
}

function row(label: string, games: GameRecord[]): string {
    const players = games[0].players
    const seats = Array.from({ length: players }, (_, seat) =>
        mean(games.map((game) => winShare(game, seat)))
    )
    const r2 = games.flatMap((game) => {
        const leader = leaderAfterRound2(game)
        return leader === undefined ? [] : [game.winners.includes(leader) ? 1 : 0]
    })
    const margins = games.map((game) => {
        const cash = game.finalCash.toSorted((a, b) => b - a)
        return cash[0] - cash[1]
    })
    const bids = games.flatMap((game) => game.bidNotes ?? [])
    const offers = games.flatMap((game) => game.offers)
    const placements = games.flatMap((game) => game.placements.filter((entry) => entry.faceUp))
    const withSpare = placements.filter((entry) => entry.supply > 0)
    const revenues = games.flatMap((game) => game.revenues)
    const challenger = games.flatMap((game) => {
        const seat = challengerSeat(game)
        return seat === undefined ? [] : [winShare(game, seat)]
    })
    const skews = games.map(skewOf)
    return [
        label,
        String(games.length),
        `${Math.min(...skews)}–${Math.max(...skews)}`,
        (mean(games.map(roundsMissingLetter)) / 5).toFixed(2),
        share(revenues, (entry) => entry.amount === 0),
        seats.map((value) => value.toFixed(2)).join('/'),
        (Math.max(...seats) - Math.min(...seats)).toFixed(2),
        mean(r2).toFixed(2),
        mean(margins).toFixed(1),
        bids.length ? share(bids, (entry) => entry.options > 1 && gap(entry) >= Obvious) : '-',
        share(offers, (entry) => entry.canPay && Math.abs(gap(entry)) >= Obvious),
        share(placements, (entry) => entry.options > 1 && gap(entry) >= Obvious),
        share(placements, (entry) => entry.options > 1 && gap(entry) === 0),
        share(withSpare, (entry) => entry.extraCubes >= entry.supply),
        lopsidedShare(games),
        challenger.length ? mean(challenger).toFixed(3) : '-'
    ].join(' | ')
}

// Splits games into low, middle and high skew thirds, keeping equal skews in one third.
function thirds(games: GameRecord[]): [string, GameRecord[]][] {
    const sorted = games.toSorted((a, b) => skewOf(a) - skewOf(b))
    const cut = (fraction: number) => skewOf(sorted[Math.floor(fraction * (sorted.length - 1))])
    const low = cut(1 / 3)
    const high = Math.max(cut(2 / 3), low + 1)
    return [
        ['low', sorted.filter((game) => skewOf(game) <= low)],
        ['mid', sorted.filter((game) => skewOf(game) > low && skewOf(game) < high)],
        ['high', sorted.filter((game) => skewOf(game) >= high)]
    ].filter(([, part]) => part.length > 0) as [string, GameRecord[]][]
}

if (process.argv[1]?.endsWith('skew.ts')) {
    console.log(
        [
            'run / skew third',
            'games',
            'skew',
            'rounds missing a letter',
            'dead payouts',
            'seat wins',
            'spread',
            'r2 leader wins',
            'winner margin',
            'bid obvious',
            'offer obvious',
            'place obvious',
            'place tied',
            'extras all-in',
            'lopsided rounds',
            'challenger'
        ].join(' | ')
    )
    for (const dir of process.argv.slice(2)) {
        const { games } = loadRun(dir)
        if (games.length === 0) continue
        console.log(row(`${basename(dir)} all`, games))
        for (const [label, part] of thirds(games)) console.log(row(`  ${label}`, part))
    }
}
