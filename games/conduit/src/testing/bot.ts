import { assert, assertExists, type RandomFunction } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import {
    biddingEndOf,
    extraCubeCostOf,
    extraCubesPrice,
    minimumBidsOf,
    stationCubeCapOf
} from '../definition/gameConfig.js'
import type { TestSession } from './table.js'

// Takes one random legal decision for the active player.
export function playRandomDecision(session: TestSession, random: RandomFunction) {
    const state = session.hydrated()
    const pick = <T>(items: readonly T[]): T => {
        assert(items.length > 0, 'There is something to choose from')
        return items[Math.floor(random() * items.length)]
    }
    switch (state.machineState) {
        case MachineState.Bidding: {
            const config = session.game.config
            const playerId = session.activePlayerId()
            const mayPass = state.canPassBid(playerId, minimumBidsOf(config), biddingEndOf(config))
            if (mayPass && random() < 0.4) {
                session.passBid()
            } else {
                session.bid(pick(state.biddableSlots()))
            }
            return
        }
        case MachineState.Offering: {
            const playerId = session.activePlayerId()
            if (state.canAfford(playerId) && random() < 0.6) {
                session.buy()
            } else {
                session.pass()
            }
            return
        }
        case MachineState.Placing: {
            const placement = state.pendingPlacement()
            assertExists(placement, 'A tile is waiting to be placed')
            const option = pick(state.grid().legalPlacements(placement.tileId, placement.faceUp))
            // Any number of extra cubes the supply, the cap and the player's cash allow.
            const config = session.game.config
            const player = state.getPlayerState(placement.playerId)
            let most = Math.min(player.supply, stationCubeCapOf(config) - 1)
            while (most > 0 && extraCubesPrice(most, extraCubeCostOf(config)) > player.cash) {
                most -= 1
            }
            const extraCubes = placement.faceUp ? Math.floor(random() * (most + 1)) : 0
            session.place(option.cell, pick(option.rotations), extraCubes)
            return
        }
        default:
            throw Error(`No player decision in ${state.machineState}`)
    }
}
