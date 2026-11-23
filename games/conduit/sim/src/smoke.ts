import { makeBot } from './bots/catalog.js'
import { playGame } from './game.js'
import { extraCubeCostOf, marketDealOf, routeTargetOf, StartPlayerRule } from '../../src/index.js'

const lineup =
    (process.argv[2] ?? 'balanced,balanced,balanced,balanced').match(/[^,{]+(?:\{[^}]*\})?/g) ?? []
const started = Date.now()
const record = playGame({
    seed: 1,
    bots: lineup.map(makeBot),
    variant: {
        cubesPerRound: 2,
        routeTarget: routeTargetOf({ routeTarget: process.argv[3] }),
        startPlayer: StartPlayerRule.Clockwise,
        minimumBids: 2,
        marketDeal: marketDealOf({ marketDeal: process.argv[4] }),
        extraCubeCost: extraCubeCostOf({ extraCubeCost: process.argv[5] })
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
