// Extra cubes placed per seat in one game. Usage: tsx sim/src/probe/extras.ts <lineup> <free|rising> [seed]
import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import { extraCubeCostOf, MarketDeal, RouteTarget, StartPlayerRule } from '../../../src/index.js'

const lineup = process.argv[2].match(/[^,{]+(?:\{[^}]*\})?/g) ?? []
const record = playGame({
    seed: Number(process.argv[4] ?? 1),
    bots: lineup.map(makeBot),
    variant: {
        cubesPerRound: 2,
        routeTarget: RouteTarget.SameLetter,
        startPlayer: StartPlayerRule.Clockwise,
        minimumBids: 2,
        marketDeal: MarketDeal.Cycle,
        extraCubeCost: extraCubeCostOf({ extraCubeCost: process.argv[3] })
    }
})
for (let seat = 0; seat < lineup.length; seat++) {
    const mine = record.placements.filter((p) => p.seat === seat && p.faceUp)
    console.log(
        lineup[seat],
        'extras per station:',
        mine.map((p) => p.extraCubes).join(' '),
        'cash',
        record.finalCash[seat]
    )
}
