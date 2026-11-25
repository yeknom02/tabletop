import { makeBot } from './bots/catalog.js'
import { playGame } from './game.js'

const lineup =
    (process.argv[2] ?? 'balanced,balanced,balanced,balanced').match(/[^,{]+(?:\{[^}]*\})?/g) ?? []
const started = Date.now()
const record = playGame({ seed: 1, bots: lineup.map(makeBot) })
console.log(
    JSON.stringify({
        ms: Date.now() - started,
        finalCash: record.finalCash,
        winners: record.winners,
        buys: record.buys.length,
        passes: record.passes,
        bids: record.bids,
        unbought: record.unboughtByRound,
        payoutRoundsAfterLast: record.payoutRoundsAfterLast,
        steps: record.steps
    })
)
