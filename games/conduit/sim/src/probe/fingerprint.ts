import { createHash } from 'node:crypto'
import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import {
    BiddingEnd,
    ExtraCubeCost,
    MarketDeal,
    MarketSize,
    RouteTarget,
    RouteToll,
    StartPlayerRule
} from '../../../src/index.js'

// A hash of whole game records, to check that a bot change leaves play unchanged.
const hash = createHash('sha256')
for (const players of [3, 4, 5]) {
    for (let seed = 1; seed <= 4; seed++) {
        const record = playGame({
            seed,
            bots: Array.from({ length: players }, () =>
                makeBot('stacker{margin=1,expectMargin=1,mirror=true}')
            ),
            variant: {
                cubesPerRound: 3,
                routeTarget: RouteTarget.NextLetter,
                startPlayer: StartPlayerRule.Clockwise,
                minimumBids: 2,
                marketDeal: MarketDeal.Shuffled,
                extraCubeCost: seed % 2 ? ExtraCubeCost.Flat : ExtraCubeCost.Free,
                startingCashStep: 0,
                routeToll: RouteToll.Flat,
                marketSize: MarketSize.SmallFirst,
                biddingEnd: BiddingEnd.AllPass,
                basePrice: 1,
                stationCubeCap: 3
            }
        })
        hash.update(JSON.stringify(record))
    }
}
console.log(hash.digest('hex'))
