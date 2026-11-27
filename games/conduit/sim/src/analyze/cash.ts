import { basename } from 'node:path'
import { extraCubesPrice, MaxExtraCubes } from '../../../src/index.js'
import { loadRun } from './load.js'

// Does cash still constrain decisions as the game goes on? Per round, over every player:
// - cash at the start of the round;
// - offers: how often the player could not afford the tile, and how often cash was no object
//   (the price plus every extra cube, $6, with cash to spare);
// - face-up placements: how often cash held back the extra cubes (fewer placed than supply and
//   the cap allowed, and the next one unaffordable), and how often cash covered all the extras
//   supply allowed.
// Needs runs recorded with cash at each decision (game.ts from batch 19 on).
// Usage: tsx sim/src/analyze/cash.ts <run dir>...
const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN
const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : '-')
const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN
}
const AllExtras = extraCubesPrice(MaxExtraCubes)

for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    const players = games[0].players
    const startingCash = 5
    console.log(`\n${basename(dir)}: ${games.length} games, ${players} players`)
    console.log(
        '| round | cash at start | offers unaffordable | cash left after price (median) | cash no object | extras held back by cash | all allowed extras affordable |'
    )
    console.log('|---|---|---|---|---|---|---|')
    for (let round = 1; round <= 5; round++) {
        const cashAtStart = games.flatMap((game) =>
            round === 1
                ? Array.from({ length: players }, () => startingCash)
                : (game.cashAfterRound[round - 2] ?? [])
        )
        const offers = games.flatMap((game) =>
            game.offers.filter((offer) => offer.round === round && offer.cash !== undefined)
        )
        const unaffordable = offers.filter((offer) => !offer.canPay).length
        const left = offers
            .filter((offer) => offer.canPay)
            .map((offer) => (offer.cash ?? 0) - offer.price)
        const noObject = offers.filter(
            (offer) => (offer.cash ?? 0) >= offer.price + AllExtras
        ).length
        const placements = games.flatMap((game) =>
            game.placements.filter(
                (placement) =>
                    placement.round === round && placement.faceUp && placement.cash !== undefined
            )
        )
        const heldBack = placements.filter((placement) => {
            const allowed = placement.allowed ?? Math.min(placement.supply, MaxExtraCubes)
            return (
                placement.extraCubes < allowed &&
                extraCubesPrice(placement.extraCubes + 1) > (placement.cash ?? 0)
            )
        }).length
        const covered = placements.filter((placement) => {
            const allowed = placement.allowed ?? Math.min(placement.supply, MaxExtraCubes)
            return extraCubesPrice(allowed) <= (placement.cash ?? 0)
        }).length
        console.log(
            `| ${round} | $${mean(cashAtStart).toFixed(1)} | ${pct(unaffordable, offers.length)} | $${median(left)} | ${pct(noObject, offers.length)} | ${pct(heldBack, placements.length)} | ${pct(covered, placements.length)} |`
        )
    }
    const finals = games.flatMap((game) => game.finalCash)
    const winners = games.map((game) => Math.max(...game.finalCash))
    const margins = games.map((game) => {
        const sorted = [...game.finalCash].sort((a, b) => b - a)
        return sorted[0] - sorted[1]
    })
    const bonus = games.reduce((t, g) => t + g.bonusIncome.reduce((a, b) => a + b, 0), 0)
    const stationPay = games.reduce((t, g) => t + g.revenues.reduce((a, r) => a + r.amount, 0), 0)
    console.log(
        `Final cash: mean $${mean(finals).toFixed(1)}, winner $${mean(winners).toFixed(1)}, winning margin median $${median(margins)}; bonuses are ${pct(bonus, bonus + stationPay)} of income.`
    )
}
