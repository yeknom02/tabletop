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

// Times a few setup-(d) games. Usage: tsx sim/src/probe/timeGame.ts [players] [games]
const players = Number(process.argv[2] ?? 4)
const games = Number(process.argv[3] ?? 3)
const spec = 'stacker{margin=1,expectMargin=1,mirror=true}'
const started = Date.now()
for (let seed = 1; seed <= games; seed++) {
    playGame({
        seed,
        bots: Array.from({ length: players }, () => makeBot(spec)),
        variant: {
            cubesPerRound: 3,
            routeTarget: RouteTarget.NextLetter,
            startPlayer: StartPlayerRule.Clockwise,
            minimumBids: 2,
            marketDeal: MarketDeal.Shuffled,
            extraCubeCost: ExtraCubeCost.Free,
            startingCashStep: 0,
            routeToll: RouteToll.Flat,
            marketSize: MarketSize.SmallFirst,
            biddingEnd: BiddingEnd.AllPass,
            basePrice: 1,
            stationCubeCap: 3
        }
    })
}
console.log(`${games} games, ${((Date.now() - started) / games).toFixed(0)} ms each`)
