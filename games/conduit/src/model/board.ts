import { OffsetCoordinates, sameCoordinates } from '@tabletop/common'
import * as Type from 'typebox'
import { RouteTarget } from '../definition/gameConfig.js'
import {
    nextLetter,
    oppositeSide,
    Side,
    SidesClockwise,
    stationTile,
    terminalAt,
    type Terminal
} from '../components/tiles.js'

export type PlacedStation = Type.Static<typeof PlacedStation>
export const PlacedStation = Type.Object({
    cell: OffsetCoordinates,
    tileId: Type.Integer(),
    // Quarter turns clockwise from the printed orientation.
    rotation: Type.Integer({ minimum: 0, maximum: 3 }),
    faceUp: Type.Boolean(),
    ownerId: Type.Optional(Type.String()),
    cubes: Type.Integer({ minimum: 0 })
})

export type Board = Type.Static<typeof Board>
export const Board = Type.Object({
    stations: Type.Array(PlacedStation)
})

export const CentralCell: OffsetCoordinates = { col: 0, row: 0 }

export interface TileFace {
    tileId: number
    rotation: number
    faceUp: boolean
}

export interface Placement {
    cell: OffsetCoordinates
    rotations: number[]
}

export interface Route {
    cells: OffsetCoordinates[]
    stations: number
}

export interface ClosedConnection {
    cell: OffsetCoordinates
    side: Side
}

type Occupant = { kind: 'central' } | { kind: 'tile'; face: TileFace }

const Central: Occupant = { kind: 'central' }

export function neighborCell(cell: OffsetCoordinates, side: Side): OffsetCoordinates {
    switch (side) {
        case Side.North:
            return { col: cell.col, row: cell.row - 1 }
        case Side.East:
            return { col: cell.col + 1, row: cell.row }
        case Side.South:
            return { col: cell.col, row: cell.row + 1 }
        case Side.West:
            return { col: cell.col - 1, row: cell.row }
    }
}

function cellKey(cell: OffsetCoordinates): string {
    return `${cell.col},${cell.row}`
}

// The tiles beside the Central Station are placed at setup and never flip (designer ruling), so a
// route always has somewhere to end.
export function isPermanentCell(cell: OffsetCoordinates): boolean {
    return SidesClockwise.some((side) => sameCoordinates(neighborCell(CentralCell, side), cell))
}

export function terminalOf(face: TileFace, side: Side): Terminal | undefined {
    return face.faceUp ? terminalAt(stationTile(face.tileId), face.rotation, side) : undefined
}

// Matching terminals, or a face-down tile on either side, make an open connection. Opposite
// terminals, and every edge of the Central Station, are closed.
function isOpen(from: Occupant, to: Occupant, side: Side): boolean {
    if (from.kind === 'central' || to.kind === 'central') {
        return false
    }
    const near = terminalOf(from.face, side)
    const far = terminalOf(to.face, oppositeSide(side))
    return near === undefined || far === undefined || near === far
}

export class Grid {
    private readonly byCell: Map<string, PlacedStation>

    constructor(readonly board: Board) {
        this.byCell = new Map(board.stations.map((station) => [cellKey(station.cell), station]))
    }

    stationAt(cell: OffsetCoordinates): PlacedStation | undefined {
        return this.byCell.get(cellKey(cell))
    }

    isOccupied(cell: OffsetCoordinates): boolean {
        return sameCoordinates(cell, CentralCell) || this.byCell.has(cellKey(cell))
    }

    closedConnections(): ClosedConnection[] {
        const closed: ClosedConnection[] = []
        for (const cell of [CentralCell, ...this.board.stations.map((station) => station.cell)]) {
            for (const side of [Side.East, Side.South]) {
                const neighbor = neighborCell(cell, side)
                const from = this.occupant(cell)
                const to = this.occupant(neighbor)
                if (from && to && !isOpen(from, to, side)) {
                    closed.push({ cell, side })
                }
            }
        }
        return closed
    }

    // A tile must share an edge with two or more tiles when it can, and among those spots must make
    // an open connection when it can (designer rulings: touching two comes first).
    legalPlacements(tileId: number, faceUp: boolean): Placement[] {
        const candidates = this.emptyCellsTouchingBoard()
        const mostTouching = candidates.some((cell) => this.touchCount(cell) >= 2)
        const allowed = candidates.filter((cell) => !mostTouching || this.touchCount(cell) >= 2)
        const rotations = faceUp ? [0, 1, 2, 3] : [0]
        const options = allowed.map((cell) => ({
            cell,
            open: rotations.filter((rotation) =>
                this.makesOpenConnection(cell, { tileId, rotation, faceUp })
            )
        }))
        if (options.some((option) => option.open.length > 0)) {
            return options
                .filter((option) => option.open.length > 0)
                .map((option) => ({ cell: option.cell, rotations: option.open }))
        }
        return allowed.map((cell) => ({ cell, rotations }))
    }

    isLegalPlacement(face: TileFace, cell: OffsetCoordinates): boolean {
        return this.legalPlacements(face.tileId, face.faceUp).some(
            (placement) =>
                sameCoordinates(placement.cell, cell) && placement.rotations.includes(face.rotation)
        )
    }

    // The shortest route through open connections to another face-up station of the next letter
    // (or of the same letter, in the variant being tested). Among
    // equally short routes the one through the most face-up stations pays best (designer ruling).
    bestRoute(
        from: OffsetCoordinates,
        routeTarget: RouteTarget = RouteTarget.NextLetter
    ): Route | undefined {
        const start = this.stationAt(from)
        if (!start || !start.faceUp) {
            return undefined
        }
        const letter = stationTile(start.tileId).letter
        const target = routeTarget === RouteTarget.SameLetter ? letter : nextLetter(letter)
        const best = new Map<string, { stations: number; previous?: OffsetCoordinates }>([
            [cellKey(from), { stations: 1 }]
        ])
        let layer: OffsetCoordinates[] = [from]
        while (layer.length > 0) {
            const next = this.nextLayer(layer, best)
            const ends = next.filter((cell) => this.isStationOf(cell, target))
            if (ends.length > 0) {
                const end = ends.reduce((leader, cell) =>
                    this.stationsTo(cell, best) > this.stationsTo(leader, best) ? cell : leader
                )
                return this.traceRoute(end, best)
            }
            layer = next.filter((cell) => !this.isStationOf(cell, target))
        }
        return undefined
    }

    private nextLayer(
        layer: OffsetCoordinates[],
        best: Map<string, { stations: number; previous?: OffsetCoordinates }>
    ): OffsetCoordinates[] {
        const reached = new Map<string, OffsetCoordinates>()
        for (const cell of layer) {
            const from = this.occupant(cell)
            for (const side of SidesClockwise) {
                const neighbor = neighborCell(cell, side)
                const key = cellKey(neighbor)
                const to = this.occupant(neighbor)
                if (!from || !to || !isOpen(from, to, side)) {
                    continue
                }
                if (best.has(key) && !reached.has(key)) {
                    continue
                }
                const stations = this.stationsTo(cell, best) + (this.isFaceUp(neighbor) ? 1 : 0)
                const known = best.get(key)
                if (!known || stations > known.stations) {
                    best.set(key, { stations, previous: cell })
                }
                reached.set(key, neighbor)
            }
        }
        return [...reached.values()]
    }

    private stationsTo(
        cell: OffsetCoordinates,
        best: Map<string, { stations: number; previous?: OffsetCoordinates }>
    ): number {
        return best.get(cellKey(cell))?.stations ?? 0
    }

    private traceRoute(
        end: OffsetCoordinates,
        best: Map<string, { stations: number; previous?: OffsetCoordinates }>
    ): Route {
        const cells: OffsetCoordinates[] = []
        let cell: OffsetCoordinates | undefined = end
        while (cell) {
            cells.unshift(cell)
            cell = best.get(cellKey(cell))?.previous
        }
        return { cells, stations: this.stationsTo(end, best) }
    }

    private isFaceUp(cell: OffsetCoordinates): boolean {
        return this.stationAt(cell)?.faceUp === true
    }

    private isStationOf(cell: OffsetCoordinates, letter: string): boolean {
        const station = this.stationAt(cell)
        return (
            station !== undefined && station.faceUp && stationTile(station.tileId).letter === letter
        )
    }

    private occupant(cell: OffsetCoordinates): Occupant | undefined {
        if (sameCoordinates(cell, CentralCell)) {
            return Central
        }
        const station = this.stationAt(cell)
        return station ? { kind: 'tile', face: station } : undefined
    }

    private emptyCellsTouchingBoard(): OffsetCoordinates[] {
        const empty = new Map<string, OffsetCoordinates>()
        for (const cell of [CentralCell, ...this.board.stations.map((station) => station.cell)]) {
            for (const side of SidesClockwise) {
                const neighbor = neighborCell(cell, side)
                if (!this.isOccupied(neighbor)) {
                    empty.set(cellKey(neighbor), neighbor)
                }
            }
        }
        return [...empty.values()]
    }

    private touchCount(cell: OffsetCoordinates): number {
        return SidesClockwise.filter((side) => this.isOccupied(neighborCell(cell, side))).length
    }

    private makesOpenConnection(cell: OffsetCoordinates, face: TileFace): boolean {
        const placed: Occupant = { kind: 'tile', face }
        return SidesClockwise.some((side) => {
            const neighbor = this.occupant(neighborCell(cell, side))
            return neighbor !== undefined && isOpen(placed, neighbor, side)
        })
    }
}
