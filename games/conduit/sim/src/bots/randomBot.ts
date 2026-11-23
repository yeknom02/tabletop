import { assertExists } from '@tabletop/common'
import { ActionType, MachineState } from '../../../src/index.js'
import type { Bot, BotContext } from './bot.js'
import { placementChoices } from './evaluate.js'

// Random legal moves: the floor any real strategy should beat.
export class RandomBot implements Bot {
    readonly name = 'random'

    decide({ state, playerId, random }: BotContext) {
        const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]
        switch (state.machineState) {
            case MachineState.Bidding:
                return {
                    decision: {
                        type: ActionType.PlaceBid,
                        slot: pick(state.biddableSlots())
                    } as const
                }
            case MachineState.Offering:
                return {
                    decision:
                        state.canAfford(playerId) && random() < 0.5
                            ? ({ type: ActionType.BuyTile } as const)
                            : ({ type: ActionType.PassTile } as const)
                }
            case MachineState.Placing: {
                const placement = state.pendingPlacement()
                assertExists(placement, 'A tile is waiting to be placed')
                const choice = pick(placementChoices(state, placement.tileId, placement.faceUp))
                const supply = state.getPlayerState(playerId).supply
                return {
                    decision: {
                        type: ActionType.PlaceTile,
                        cell: choice.cell,
                        rotation: choice.rotation,
                        extraCubes: placement.faceUp ? Math.floor(random() * (supply + 1)) : 0
                    } as const
                }
            }
            default:
                throw Error(`No decision in ${state.machineState}`)
        }
    }
}
