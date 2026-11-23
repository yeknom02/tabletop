import { makeBot } from './bots/catalog.js'
import { playGame } from './game.js'
import { RouteTarget, StartPlayerRule } from '../../src/index.js'

const lineup = (process.argv[2] ?? 'balanced,balanced,balanced,balanced').split(',')
const started = Date.now()
const record = playGame({
    seed: 1,
    bots: lineup.map(makeBot),
    variant: {
        cubesPerRound: 2,
        routeTarget: RouteTarget.NextLetter,
        startPlayer: StartPlayerRule.Clockwise
    }
})
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
