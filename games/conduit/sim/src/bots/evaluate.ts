import type { OffsetCoordinates } from '@tabletop/common'
import {
    Grid,
    revenueFor,
    stationTile,
    type Board,
    type RouteTarget,
    type HydratedConduitGameState,
    type PlacedStation
} from '../../../src/index.js'

export type PlacementChoice = { cell: OffsetCoordinates; rotation: number }

// What every Power Station would earn if revenue were paid now, summed per owner.
export function revenueByOwner(board: Board, routeTarget: RouteTarget): Map<string, number> {
    const grid = new Grid(board)
    const totals = new Map<string, number>()
    for (const station of board.stations) {
        if (!station.ownerId) continue
        const amount = revenueFor(grid.bestRoute(station.cell, routeTarget))
        totals.set(station.ownerId, (totals.get(station.ownerId) ?? 0) + amount)
    }
    return totals
}

export function placementChoices(
    state: HydratedConduitGameState,
    tileId: number,
    faceUp: boolean
): PlacementChoice[] {
    return state
        .grid()
        .legalPlacements(tileId, faceUp)
        .flatMap((option) => option.rotations.map((rotation) => ({ cell: option.cell, rotation })))
}

export type PlacementEffect = {
    choice: PlacementChoice
    // Change in what each player's stations would earn now, the new station included.
    gain: Map<string, number>
    // What the new station alone would earn per payout, for a face-up tile.
    stationPayout: number
}

export function placementEffects(
    state: HydratedConduitGameState,
    tileId: number,
    faceUp: boolean,
    ownerId: string | undefined,
    routeTarget: RouteTarget
): PlacementEffect[] {
    const before = revenueByOwner(state.board, routeTarget)
    return placementChoices(state, tileId, faceUp).map((choice) => {
        const station: PlacedStation = {
            cell: choice.cell,
            tileId,
            rotation: choice.rotation,
            faceUp,
            cubes: faceUp ? 1 : 0,
            ...(faceUp && ownerId ? { ownerId } : {})
        }
        const board: Board = { stations: [...state.board.stations, station] }
        const after = revenueByOwner(board, routeTarget)
        const gain = new Map<string, number>()
        for (const player of state.players) {
            const id = player.playerId
            gain.set(id, (after.get(id) ?? 0) - (before.get(id) ?? 0))
        }
        const stationPayout = faceUp
            ? revenueFor(new Grid(board).bestRoute(choice.cell, routeTarget))
            : 0
        return { choice, gain, stationPayout }
    })
}

export function letterOf(tileId: number): string {
    return stationTile(tileId).letter
}
