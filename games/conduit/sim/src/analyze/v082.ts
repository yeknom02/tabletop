import { basename } from 'node:path'
import type { GameRecord } from '../game.js'
import { loadRun, meanCI, winShare } from './load.js'

// The designer's three measures for rules v0.8.2, one row per run.
// 1. Trivial decisions (bids are recorded from batch 8 on): forced choices, and choices whose best option beats the next by $3 or more
//    by the bot's own estimate. Extra cubes: how often every spare cube goes on.
// 2. Seats: win share by seat, seat 0 being the first Start Player.
// 3. Lopsided markets: rounds whose best tile is worth far more than the rest. Who gets it, what it
//    costs, and whether its buyer goes on to win.
// Usage: tsx sim/src/analyze/v082.ts [--lopsided <gap>] <run dir>...
const args = process.argv.slice(2)
const gapAt = args.indexOf('--lopsided')
const LopsidedGap = gapAt >= 0 ? Number(args[gapAt + 1]) : 3
const dirs = args.filter((_, index) => gapAt < 0 || (index !== gapAt && index !== gapAt + 1))

const Obvious = 3
const sum = (values: (number | null | undefined)[]) =>
    values.reduce<number>((total, value) => total + (value ?? 0), 0)
const mean = (values: number[]) => (values.length ? meanCI(values).mean : NaN)
const pct = (part: number, whole: number) => (whole ? `${((100 * part) / whole).toFixed(0)}%` : '-')
const share = <T>(items: T[], keep: (item: T) => boolean) =>
    pct(items.filter(keep).length, items.length)

function leaderAfterRound2(game: GameRecord): number | undefined {
    const cash = game.cashAfterRound[1]
    if (!cash) return undefined
    const top = Math.max(...cash)
    const leaders = cash.flatMap((value, seat) => (value === top ? [seat] : []))
    return leaders.length === 1 ? leaders[0] : undefined
}

type Lopsided = { startOffset: number; bought: boolean; price: number; buyerWon: boolean }

// Rounds whose best tile is worth at least LopsidedGap more per payout than the next best.
function lopsidedRounds(game: GameRecord): {
    rounds: number
    lopsided: Lopsided[]
    others: number[]
} {
    const lopsided: Lopsided[] = []
    const others: number[] = []
    for (const market of game.roundMarkets ?? []) {
        const order = market.values.map((value, index) => ({ value, index }))
        order.sort((a, b) => b.value - a.value)
        if (order.length < 2 || order[0].value - order[1].value < LopsidedGap) continue
        const topTile = market.tileIds[order[0].index]
        const buy = game.buys.find(
            (entry) => entry.round === market.round && entry.tileId === topTile
        )
        for (const entry of game.buys) {
            if (entry.round === market.round && entry.tileId !== topTile) others.push(entry.price)
        }
        lopsided.push({
            startOffset: buy ? (buy.seat - market.startSeat + game.players) % game.players : -1,
            bought: buy !== undefined,
            price: buy?.price ?? 0,
            buyerWon: buy ? game.winners.includes(buy.seat) : false
        })
    }
    return { rounds: game.roundMarkets?.length ?? 0, lopsided, others }
}

console.log(
    [
        'run',
        'seat wins',
        'spread',
        'r2 leader',
        'bid forced/obvious',
        'offer forced/obvious',
        'place forced/obvious/tied',
        'extras all/none',
        `lopsided rounds (gap>=${LopsidedGap})`,
        'top tile to SP / by seat from SP',
        'top price vs other',
        'top buyer wins',
        'late bids/round',
        'mean price',
        'unbought/round'
    ].join(' | ')
)
for (const dir of dirs) {
    const { games } = loadRun(dir)
    if (games.length === 0) continue
    const players = games[0].players
    const seats = Array.from({ length: players }, (_, seat) =>
        mean(games.map((game) => winShare(game, seat)))
    )
    const r2 = games.flatMap((game) => {
        const leader = leaderAfterRound2(game)
        return leader === undefined ? [] : [game.winners.includes(leader) ? 1 : 0]
    })
    const bids = games.flatMap((game) => game.bidNotes ?? [])
    const offers = games.flatMap((game) => game.offers)
    const placements = games.flatMap((game) => game.placements.filter((entry) => entry.faceUp))
    const allowed = (entry: { supply: number; allowed?: number }) => entry.allowed ?? entry.supply
    const withSpare = placements.filter((entry) => allowed(entry) > 0)
    const gap = (entry: { best?: number; second?: number }) =>
        (entry.best ?? 0) - (entry.second ?? entry.best ?? 0)
    const lop = games.map(lopsidedRounds)
    const rounds = lop.reduce((total, entry) => total + entry.rounds, 0)
    const lopsided = lop.flatMap((entry) => entry.lopsided)
    const bought = lopsided.filter((entry) => entry.bought)
    const bySeat = Array.from({ length: players }, (_, offset) =>
        share(bought, (entry) => entry.startOffset === offset)
    )
    console.log(
        [
            basename(dir),
            seats.map((value) => value.toFixed(2)).join('/'),
            (Math.max(...seats) - Math.min(...seats)).toFixed(2),
            mean(r2).toFixed(2),
            bids.length
                ? `${share(bids, (entry) => entry.options <= 1)}/${share(
                      bids,
                      (entry) => entry.options > 1 && gap(entry) >= Obvious
                  )}`
                : '-',
            `${share(offers, (entry) => !entry.canPay)}/${share(
                offers,
                (entry) => entry.canPay && Math.abs(gap(entry)) >= Obvious
            )}`,
            `${share(placements, (entry) => entry.options <= 1)}/${share(
                placements,
                (entry) => entry.options > 1 && gap(entry) >= Obvious
            )}/${share(placements, (entry) => entry.options > 1 && gap(entry) === 0)}`,
            `${share(withSpare, (entry) => entry.extraCubes >= allowed(entry))}/${share(
                withSpare,
                (entry) => entry.extraCubes === 0
            )}`,
            pct(lopsided.length, rounds),
            `${bySeat[0]} / ${bySeat.join(' ')}`,
            `$${mean(bought.map((entry) => entry.price)).toFixed(2)} vs $${mean(
                lop.flatMap((entry) => entry.others)
            ).toFixed(2)}`,
            share(bought, (entry) => entry.buyerWon),
            mean(games.map((game) => sum(game.lateBids ?? []) / 5)).toFixed(1),
            `$${mean(games.flatMap((game) => game.buys.map((entry) => entry.price))).toFixed(2)}`,
            mean(games.map((game) => sum(game.unboughtByRound) / 5)).toFixed(2)
        ].join(' | ')
    )
}
