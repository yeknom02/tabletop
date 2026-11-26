import { basename } from 'node:path'
import type { GameRecord } from '../game.js'
import { loadRun, meanCI, winShare } from './load.js'

// Who tied routes pay (designer ruling, 2026-11-25): how often owners choose, and what their
// toll habit does to the race. Catch-up is the round-3 cash leader's win share (games with a
// clear leader); margin is first place over second, spread first over last; toll income is the
// mean a player collected in tolls by where they finished. With a mixed lineup (--rotate),
// "challenger" is the win share of the bot whose spec differs from the rest.
// Usage: tsx sim/src/analyze/tolls.ts <run dir>...
const mean = (values: number[]) => (values.length ? meanCI(values).mean : NaN)
const ci = (values: number[]) => {
    const { mean: m, low, high } = meanCI(values)
    return `${m.toFixed(3)} (${low.toFixed(3)}–${high.toFixed(3)})`
}

function leaderAfter(game: GameRecord, round: number): number | undefined {
    const cash = game.cashAfterRound[round - 1]
    if (!cash) return undefined
    const top = Math.max(...cash)
    const leaders = cash.flatMap((amount, seat) => (amount === top ? [seat] : []))
    return leaders.length === 1 ? leaders[0] : undefined
}

console.log(
    [
        'run',
        'games',
        'choices/game',
        'R3 leader wins',
        'winner $',
        'margin',
        'spread',
        'close (≤$2)',
        'toll $ by place (1st…last)',
        'challenger'
    ].join(' | ')
)
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    const players = games[0].players
    const ranked = games.map((game) =>
        game.finalCash.map((cash, seat) => ({ cash, seat })).toSorted((a, b) => b.cash - a.cash)
    )
    const leaders = games.flatMap((game) => {
        const leader = leaderAfter(game, 3)
        return leader === undefined ? [] : [winShare(game, leader)]
    })
    const margins = ranked.map((order) => order[0].cash - order[1].cash)
    const tollByPlace = Array.from({ length: players }, (_, place) =>
        mean(games.map((game, index) => game.tollIncome[ranked[index][place].seat]))
    )
    const specs = games[0].bots
    const odd = specs.find((spec) => specs.filter((other) => other === spec).length === 1)
    const challenger =
        odd && specs.length > 2
            ? ci(
                  games.flatMap((game) =>
                      game.bots.flatMap((spec, seat) =>
                          spec === odd ? [winShare(game, seat)] : []
                      )
                  )
              )
            : '-'
    console.log(
        [
            basename(dir),
            games.length,
            mean(games.map((game) => game.routeChoices ?? 0)).toFixed(2),
            ci(leaders),
            mean(ranked.map((order) => order[0].cash)).toFixed(1),
            mean(margins).toFixed(2),
            mean(ranked.map((order) => order[0].cash - order[order.length - 1].cash)).toFixed(1),
            `${Math.round((100 * margins.filter((margin) => margin <= 2).length) / games.length)}%`,
            tollByPlace.map((amount) => amount.toFixed(1)).join(' / '),
            challenger
        ].join(' | ')
    )
}
