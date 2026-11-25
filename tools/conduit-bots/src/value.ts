import type { GameConfig, OffsetCoordinates } from '@tabletop/common'
import {
    extraCubeCostOf,
    extraCubesPrice,
    Grid,
    revenueFor,
    routeTargetOf,
    routeTollOf,
    stationCubeCapOf,
    stationEarnings,
    type Board,
    type ExtraCubeCost,
    type HydratedConduitGameState,
    type PlacedStation,
    type RouteTarget,
    type RouteToll
} from '@tabletop/conduit'

// How a bot measures money on the board, ported from the bot studies (games/conduit/sim). It looks
// only at the board as it stands: what each station would earn if revenue were paid now.

export type Rules = {
    routeTarget: RouteTarget
    routeToll: RouteToll
    extraCubeCost: ExtraCubeCost
    // Most cubes a new station may hold, the winning cube included.
    stationCubeCap: number
}

export function rulesOf(config: GameConfig): Rules {
    return {
        routeTarget: routeTargetOf(config),
        routeToll: routeTollOf(config),
        extraCubeCost: extraCubeCostOf(config),
        stationCubeCap: stationCubeCapOf(config)
    }
}

// What every station would earn now, tolls included, summed per owner.
export function earningsByOwner(board: Board, rules: Rules): Map<string, number> {
    const totals = new Map<string, number>()
    const add = (playerId: string, amount: number) =>
        totals.set(playerId, (totals.get(playerId) ?? 0) + amount)
    for (const earning of stationEarnings(board, rules.routeTarget, rules.routeToll)) {
        add(earning.ownerId, earning.amount)
        for (const toll of earning.tolls) add(toll.playerId, toll.amount)
    }
    return totals
}

export type Spot = { cell: OffsetCoordinates; rotation: number }

export type SpotEffect = {
    spot: Spot
    // Change in what each player's stations would earn per payout, the new station included.
    gain: Map<string, number>
}

// The effect of each legal spot for a tile. A face-up tile is the owner's new station, holding its
// winning cube; a face-down tile only opens connections.
export function spotEffects(
    state: HydratedConduitGameState,
    rules: Rules,
    tileId: number,
    faceUp: boolean,
    ownerId: string | undefined
): SpotEffect[] {
    const before = earningsByOwner(state.board, rules)
    return state
        .grid()
        .legalPlacements(tileId, faceUp)
        .flatMap((option) => option.rotations.map((rotation) => ({ cell: option.cell, rotation })))
        .map((spot) => {
            const station: PlacedStation = {
                ...spot,
                tileId,
                faceUp,
                cubes: faceUp ? 1 : 0,
                ...(faceUp && ownerId ? { ownerId } : {})
            }
            const board: Board = { stations: [...state.board.stations, station] }
            const after = earningsByOwner(board, rules)
            const gain = new Map(
                state.players.map((player) => [
                    player.playerId,
                    (after.get(player.playerId) ?? 0) - (before.get(player.playerId) ?? 0)
                ])
            )
            return { spot, gain }
        })
}

// What the new station itself pays its owner each payout at this spot, before tolls to others.
export function stationPayout(
    state: HydratedConduitGameState,
    rules: Rules,
    tileId: number,
    spot: Spot,
    ownerId: string
): number {
    const station: PlacedStation = { ...spot, tileId, faceUp: true, cubes: 1, ownerId }
    const grid = new Grid({ stations: [...state.board.stations, station] })
    return revenueFor(grid.bestRoute(spot.cell, rules.routeTarget))
}

export type TileSpot = {
    spot?: Spot
    // What one payout adds to the player's earnings at this spot, the new station's own route and
    // what it changes for their other stations together.
    gain: number
    // What the new station itself pays each payout: the part each extra cube repeats.
    payout: number
}

// A tile's best spot for a player now, by what one payout would add to their earnings.
export function bestSpot(
    state: HydratedConduitGameState,
    rules: Rules,
    tileId: number,
    playerId: string
): TileSpot {
    let best: SpotEffect | undefined
    for (const effect of spotEffects(state, rules, tileId, true, playerId)) {
        if (!best || (effect.gain.get(playerId) ?? 0) > (best.gain.get(playerId) ?? 0)) {
            best = effect
        }
    }
    if (!best) return { gain: 0, payout: 0 }
    return {
        spot: best.spot,
        gain: Math.max(0, best.gain.get(playerId) ?? 0),
        payout: stationPayout(state, rules, tileId, best.spot, playerId)
    }
}

// Each payout after the first is less certain, since routes change.
export const Discount = 0.9

// A station pays once per cube on it: one cube leaves it after each payout. The extra cubes repeat
// the station's own payout, each less certain than the one before.
export function extraPayoutsWorth(payout: number, extras: number): number {
    let total = 0
    for (let extra = 1; extra <= extras; extra++) total += payout * Discount ** extra
    return total
}

export type ExtraPlan = {
    // Cubes the player could still add: their supply, less cubes kept back, within the cap.
    room: number
    cash: number
}

// Extra cubes worth adding to a station paying `payout` each time: one more while that cube's own
// payout (the last, least certain one) is worth at least its price, and the player can pay it.
export function extrasWorthIt(payout: number, plan: ExtraPlan, rules: Rules): number {
    const price = (count: number) => extraCubesPrice(count, rules.extraCubeCost)
    const most = Math.max(0, Math.min(plan.room, rules.stationCubeCap - 1))
    let extras = 0
    while (extras < most && price(extras + 1) <= plan.cash) {
        const cubePrice = price(extras + 1) - price(extras)
        if (payout * Discount ** (extras + 1) < cubePrice) break
        extras++
    }
    return extras
}

// What a tile is worth to a player before its price: its first payout at their best spot, and the
// extra cubes they would add, less what those cubes cost.
export function tileWorth(
    state: HydratedConduitGameState,
    rules: Rules,
    tileId: number,
    playerId: string,
    plan: ExtraPlan
): number {
    const { gain, payout } = bestSpot(state, rules, tileId, playerId)
    const extras = extrasWorthIt(payout, plan, rules)
    return gain + extraPayoutsWorth(payout, extras) - extraCubesPrice(extras, rules.extraCubeCost)
}
