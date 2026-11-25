import type { OffsetCoordinates, RandomFunction } from '@tabletop/common'
import {
    ActionType,
    type HydratedConduitGameState,
    type ExtraCubeCost,
    type MarketDeal,
    type MarketSize,
    type RouteTarget,
    type RouteToll
} from '../../../src/index.js'

export type Decision =
    | { type: ActionType.PlaceBid; slot: number }
    | { type: ActionType.BuyTile }
    | { type: ActionType.PassTile }
    | { type: ActionType.PassBid }
    | { type: ActionType.PlaceTile; cell: OffsetCoordinates; rotation: number; extraCubes: number }
    | { type: ActionType.ChooseRoute; tileId: number; option: number }

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
    cubesPerRound: number
    routeTarget: RouteTarget
    marketDeal: MarketDeal
    extraCubeCost: ExtraCubeCost
    routeToll: RouteToll
    marketSize: MarketSize
    // Whether the bot may pass instead of bidding (the bid-until-all-pass variant).
    canPassBid: boolean
    // Most cubes a new station may hold, the winning cube included.
    stationCubeCap?: number
}

export interface Bot {
    readonly name: string
    decide(context: BotContext): { decision: Decision; note?: DecisionNote }
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
