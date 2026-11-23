import { basename } from 'node:path'
import { fmt, loadRun, meanCI, winShare } from './load.js'

// One line per run, for studies that vary one thing. Usage: compare.ts <focus bot|-> <run dirs...>
// With a focus bot, also reports that bot's win share against the equal-seat share.
const [focus, ...dirs] = process.argv.slice(2)
const header = [
    'run',
    'focus win share',
    'cash',
    'margin 1st-2nd',
    'R2 leader wins',
    'bought',
    'unbought',
    'price',
    'payout rounds after R5',
    '<3 cubes at round start',
    '0 cubes at round start'
]
console.log(`| ${header.join(' | ')} |`)
console.log(`|${header.map(() => '---').join('|')}|`)
for (const dir of dirs) {
    const { games } = loadRun(dir)
    const focusShares =
        focus === '-'
            ? []
            : games.flatMap((game) =>
                  game.bots.flatMap((name, seat) => (name === focus ? [winShare(game, seat)] : []))
              )
    const focusCash =
        focus === '-'
            ? []
            : games.flatMap((game) =>
                  game.bots.flatMap((name, seat) => (name === focus ? [game.finalCash[seat]] : []))
              )
    const allCash = games.flatMap((game) => game.finalCash)
    const margin = games.map((game) => {
        const sorted = [...game.finalCash].sort((a, b) => b - a)
        return sorted[0] - sorted[1]
    })
    const r2 = games.map((game) => {
        const cash = game.cashAfterRound[1]
        const top = Math.max(...cash)
        return cash.some((value, seat) => value === top && game.winners.includes(seat)) ? 1 : 0
    })
    const later = games.flatMap((game) => game.supplyAtRoundStart.slice(1).flat())
    console.log(
        `| ${[
            basename(dir),
            focusShares.length ? fmt(meanCI(focusShares), 3) : '',
            fmt(meanCI(focusCash.length ? focusCash : allCash), 1),
            fmt(meanCI(margin), 1),
            fmt(meanCI(r2), 2),
            meanCI(games.map((game) => game.buys.length)).mean.toFixed(1),
            meanCI(
                games.map((game) => game.unboughtByRound.reduce((t, v) => t + (v ?? 0), 0))
            ).mean.toFixed(1),
            meanCI(games.flatMap((game) => game.buys.map((buy) => buy.price))).mean.toFixed(2),
            meanCI(games.map((game) => game.payoutRoundsAfterLast)).mean.toFixed(1),
            meanCI(later.map((supply) => (supply < 3 ? 1 : 0))).mean.toFixed(3),
            meanCI(later.map((supply) => (supply === 0 ? 1 : 0))).mean.toFixed(3)
        ].join(' | ')} |`
    )
}
