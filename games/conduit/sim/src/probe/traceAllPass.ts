import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import {
    BiddingEnd,
    MarketDeal,
    MarketSize,
    RouteTarget,
    StartPlayerRule,
    ExtraCubeCost
} from '../../../src/index.js'
const bots = [0, 1, 2].map(() => makeBot('stacker{margin=3,expectMargin=3}'))
const rec = playGame({
    seed: 3,
    bots,
    variant: {
        cubesPerRound: 3,
        routeTarget: RouteTarget.NextLetter,
        startPlayer: StartPlayerRule.Clockwise,
        minimumBids: 2,
        marketDeal: MarketDeal.Shuffled,
        extraCubeCost: ExtraCubeCost.Free,
        startingCashStep: 0,
        marketSize: MarketSize.SmallFirst,
        biddingEnd: BiddingEnd.AllPass,
        stationCubeCap: 3
    }
})
console.log('markets', JSON.stringify(rec.markets.slice(0, 2)))
console.log('round1 values', JSON.stringify(rec.roundMarkets.slice(0, 2)))
console.log('offers r1', JSON.stringify(rec.offers.filter((o) => o.round === 1)))
console.log('bidnotes r1', JSON.stringify(rec.bidNotes.filter((o) => o.round === 1)))
console.log('buys', JSON.stringify(rec.buys))
