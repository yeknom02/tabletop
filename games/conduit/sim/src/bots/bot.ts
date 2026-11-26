import type { OffsetCoordinates, RandomFunction } from '@tabletop/common'
import { ActionType, type HydratedConduitGameState, type RouteChoice } from '../../../src/index.js'

export type Decision =
    | { type: ActionType.PlaceBid; spot: number }
    | { type: ActionType.BuyTile }
    | { type: ActionType.PassTile }
    | { type: ActionType.PassBid }
    | { type: ActionType.PlaceTile; cell: OffsetCoordinates; rotation: number; extraCubes: number }
    | { type: ActionType.ChooseRoute; tileId: number; route: OffsetCoordinates[] }

// What a bot saw when it chose, for the studies: how many options it had and how far apart the
// best and next best were by its own measure.
export type DecisionNote = {
    options: number
    best?: number
    second?: number
    median?: number
    worst?: number
}

export interface BotContext {
    state: HydratedConduitGameState
    playerId: string
    random: RandomFunction
    // Whether the bot may pass instead of bidding: once it has placed two cubes.
    canPassBid: boolean
}

export interface Bot {
    readonly name: string
    decide(context: BotContext): { decision: Decision; note?: DecisionNote }
    // Which of a station's tied routes to take when they pay tolls to different players, by its
    // position among the choice's options.
    chooseRoute?(context: BotContext, choice: RouteChoice): number
}

export function noteOf(values: number[]): DecisionNote {
    const sorted = [...values].sort((a, b) => b - a)
    return {
        options: sorted.length,
        best: sorted[0],
        second: sorted[1],
        median: sorted[Math.floor(sorted.length / 2)],
        worst: sorted.at(-1)
    }
}
