import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import type { Bot } from '../bots/bot.js'
import { placementEffects } from '../bots/evaluate.js'
import {
    BiddingEnd,
    ExtraCubeCost,
    MachineState,
    MarketDeal,
    MarketSize,
    RouteTarget,
    RouteToll,
    StartPlayerRule
} from '../../../src/index.js'

// Why a placement under paid cubes stops short of the cap: no route yet, no cash, or no supply.
// Usage: tsx sim/src/probe/extrasWhy.ts <players> <cap> <games>
const players = Number(process.argv[2] ?? 4)
const cap = Number(process.argv[3] ?? 4)
const games = Number(process.argv[4] ?? 40)
const counts = { placements: 0, short: 0, noRoute: 0, cash: 0, supply: 0, chose: 0 }
const payouts: Record<string, number> = {}
for (let seed = 1; seed <= games; seed++) {
    const bots = Array.from({ length: players }, (): Bot => {
        const bot = makeBot('stacker{margin=1,expectMargin=1,mirror=true}')
        return {
            name: bot.name,
            decide(context) {
                const out = bot.decide(context)
                const { state, playerId } = context
                const pending = state.pendingPlacement()
                if (
                    state.machineState === MachineState.Placing &&
                    pending?.faceUp &&
                    out.decision.type === 'placeTile'
                ) {
                    const me = state.getPlayerState(playerId)
                    const allowed = Math.min(me.supply, cap - 1)
                    if (allowed > 0) {
                        counts.placements++
                        const { cell, rotation } = out.decision
                        const effect = placementEffects(
                            state,
                            pending.tileId,
                            true,
                            playerId,
                            context.routeTarget,
                            context.routeToll
                        ).find(
                            (e) =>
                                e.choice.cell.col === cell.col &&
                                e.choice.cell.row === cell.row &&
                                e.choice.rotation === rotation
                        )
                        const pay = effect?.stationPayout ?? 0
                        payouts[pay] = (payouts[pay] ?? 0) + 1
                        if (out.decision.extraCubes < allowed) {
                            counts.short++
                            if (pay === 0) counts.noRoute++
                            else if (me.cash < out.decision.extraCubes + 1) counts.cash++
                            else counts.chose++
                        }
                    }
                }
                return out
            }
        }
    })
    playGame({
        seed,
        bots,
        variant: {
            cubesPerRound: 3,
            routeTarget: RouteTarget.NextLetter,
            startPlayer: StartPlayerRule.Clockwise,
            minimumBids: 2,
            marketDeal: MarketDeal.Shuffled,
            extraCubeCost: ExtraCubeCost.Flat,
            startingCashStep: 0,
            routeToll: RouteToll.Flat,
            marketSize: MarketSize.SmallFirst,
            biddingEnd: BiddingEnd.AllPass,
            basePrice: 1,
            stationCubeCap: cap
        }
    })
}
console.log(JSON.stringify(counts), 'station payout when placed', JSON.stringify(payouts))
