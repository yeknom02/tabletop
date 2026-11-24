import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import type { Bot } from '../bots/bot.js'
import {
    BiddingEnd,
    ExtraCubeCost,
    MarketDeal,
    MarketSize,
    RouteTarget,
    StartPlayerRule
} from '../../../src/index.js'

// Logs every decision of rounds 1 and 2 with the market tracks, cash and supply.
// Usage: tsx sim/src/probe/traceD2.ts <seed> <players> <bot spec> [basePrice]
const seed = Number(process.argv[2] ?? 3)
const players = Number(process.argv[3] ?? 3)
const spec = process.argv[4] ?? 'stacker{margin=1,expectMargin=3,mirror=true}'
const basePrice = Number(process.argv[5] ?? 1)
const wrap = (bot: Bot, seat: number): Bot => ({
    name: bot.name,
    decide(context) {
        const out = bot.decide(context)
        const s = context.state
        if (s.round <= 2) {
            const tracks = s.market
                .map((slot) =>
                    slot.tileId === undefined
                        ? '-'
                        : slot.bids.map((id) => id.slice(1)).join('') || '.'
                )
                .join(' | ')
            const me = s.getPlayerState(context.playerId)
            const offer = s.currentOffer()
            console.log(
                `r${s.round} s${seat} ${s.machineState.padEnd(8)} [${tracks}] $${me.cash} sup${me.supply} ${
                    offer ? `offer ${offer.price}` : ''
                } -> ${JSON.stringify(out.decision)} best ${out.note?.best?.toFixed(1)} 2nd ${out.note?.second?.toFixed(1)}`
            )
        }
        return out
    }
})
const bots = Array.from({ length: players }, (_, seat) => wrap(makeBot(spec), seat))
const record = playGame({
    seed,
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
        basePrice,
        stationCubeCap: 3
    }
})
console.log(
    'values',
    JSON.stringify(record.roundMarkets.slice(0, 2).map((market) => market.values)),
    'unbought',
    record.unboughtByRound
)
