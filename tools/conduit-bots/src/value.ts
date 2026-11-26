import type { OffsetCoordinates } from '@tabletop/common'
import {
    extraCubesPrice,
    Grid,
    MaxExtraCubes,
    revenueFor,
    stationEarnings,
    type Board,
    type HydratedConduitGameState,
    type PlacedStation
} from '@tabletop/conduit'

// How a bot measures money on the board, ported from the bot studies (games/conduit/sim). It looks
// only at the board as it stands: what each station would earn if revenue were paid now.

// What every station would earn now, bonuses included, summed per owner.
export function earningsByOwner(board: Board): Map<string, number> {
    const totals = new Map<string, number>()
    const add = (playerId: string, amount: number) =>
        totals.set(playerId, (totals.get(playerId) ?? 0) + amount)
    for (const earning of stationEarnings(board)) {
        add(earning.ownerId, earning.amount)
        for (const bonus of earning.bonuses) add(bonus.playerId, bonus.amount)
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
    tileId: number,
    faceUp: boolean,
    ownerId: string | undefined
): SpotEffect[] {
    const before = earningsByOwner(state.board)
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
            const after = earningsByOwner(board)
            const gain = new Map(
                state.players.map((player) => [
                    player.playerId,
                    (after.get(player.playerId) ?? 0) - (before.get(player.playerId) ?? 0)
                ])
            )
            return { spot, gain }
        })
}

// What the new station itself pays its owner each payout at this spot, before bonuses to others.
export function stationPayout(
    state: HydratedConduitGameState,
    tileId: number,
    spot: Spot,
    ownerId: string
): number {
    const station: PlacedStation = { ...spot, tileId, faceUp: true, cubes: 1, ownerId }
    const grid = new Grid({ stations: [...state.board.stations, station] })
    return revenueFor(grid.bestRoute(spot.cell))
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
    tileId: number,
    playerId: string
): TileSpot {
    let best: SpotEffect | undefined
    for (const effect of spotEffects(state, tileId, true, playerId)) {
        if (!best || (effect.gain.get(playerId) ?? 0) > (best.gain.get(playerId) ?? 0)) {
            best = effect
        }
    }
    if (!best) return { gain: 0, payout: 0 }
    return {
        spot: best.spot,
        gain: Math.max(0, best.gain.get(playerId) ?? 0),
        payout: stationPayout(state, tileId, best.spot, playerId)
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
export function extrasWorthIt(payout: number, plan: ExtraPlan): number {
    const price = (count: number) => extraCubesPrice(count)
    const most = Math.max(0, Math.min(plan.room, MaxExtraCubes))
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
    tileId: number,
    playerId: string,
    plan: ExtraPlan
): number {
    const { gain, payout } = bestSpot(state, tileId, playerId)
    const extras = extrasWorthIt(payout, plan)
    return gain + extraPayoutsWorth(payout, extras) - extraCubesPrice(extras)
}
