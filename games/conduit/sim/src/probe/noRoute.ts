// How often a tile on offer has no route for its offeree at the best spot (the only case where
// the prospect habit matters), by round. Usage: tsx sim/src/probe/noRoute.ts <deal> <games>
import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'
import type { Bot } from '../bots/bot.js'
import { placementEffects } from '../bots/evaluate.js'
import {
    ExtraCubeCost,
    MachineState,
    marketDealOf,
    RouteTarget,
    StartPlayerRule
} from '../../../src/index.js'

const deal = marketDealOf({ marketDeal: process.argv[2] })
const games = Number(process.argv[3] ?? 50)
const offered: number[] = []
const noRoute: number[] = []
function probing(bot: Bot): Bot {
    return {
        name: bot.name,
        decide(context) {
            const { state, playerId } = context
            const offer = state.currentOffer()
            if (state.machineState === MachineState.Offering && offer) {
                const effects = placementEffects(
                    state,
                    offer.tileId,
                    true,
                    playerId,
                    RouteTarget.SameLetter
                )
                const best = Math.max(0, ...effects.map((effect) => effect.stationPayout))
                offered[state.round] = (offered[state.round] ?? 0) + 1
                if (best === 0) noRoute[state.round] = (noRoute[state.round] ?? 0) + 1
            }
            return bot.decide(context)
        }
    }
}
for (let seed = 1; seed <= games; seed++) {
    playGame({
        seed,
        bots: Array.from({ length: 4 }, () => probing(makeBot('stacker{margin=3}'))),
        variant: {
            cubesPerRound: 2,
            routeTarget: RouteTarget.SameLetter,
            startPlayer: StartPlayerRule.Clockwise,
            minimumBids: 2,
            marketDeal: deal,
            extraCubeCost: ExtraCubeCost.Free
        }
    })
}
console.log(
    deal,
    offered
        .map((n, round) => `r${round}: ${noRoute[round] ?? 0}/${n} no route`)
        .filter(Boolean)
        .join(', ')
)
