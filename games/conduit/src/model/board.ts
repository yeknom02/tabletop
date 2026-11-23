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

// The whole grid, Central Station included, must fit within this many tiles each way (rules v0.8.1).
export const MaxGridSize = 6

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

// The best way found to reach a cell: stations passed (both ends included) and how many of them the
// route's owner owns.
interface RouteStep {
    stations: number
    own: number
    previous?: OffsetCoordinates
}

function isBetterStep(a: RouteStep, b: RouteStep): boolean {
    return a.stations > b.stations || (a.stations === b.stations && a.own < b.own)
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

    // A tile must border another tile and keep the grid within 6x6 (rules v0.8.1). Among those spots
    // it must make an open connection when it can.
    legalPlacements(tileId: number, faceUp: boolean): Placement[] {
        const allowed = this.emptyCellsTouchingBoard().filter((cell) => this.fitsWithLimit(cell))
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

    // The shortest route through open connections to another face-up station of the next letter,
    // D back to A (rules v0.8.2; the same letter in v0.8.1, kept for bot studies). Among equally
    // short routes the owner must take the one through the most face-up stations, then the one
    // through the fewest of their own (rules v0.8.2).
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
        const best = new Map<string, RouteStep>([[cellKey(from), { stations: 1, own: 1 }]])
        let layer: OffsetCoordinates[] = [from]
        while (layer.length > 0) {
            const next = this.nextLayer(layer, best, start.ownerId)
            const ends = next.filter((cell) => this.isStationOf(cell, target))
            if (ends.length > 0) {
                const end = ends.reduce((leader, cell) =>
                    isBetterStep(this.stepTo(cell, best), this.stepTo(leader, best)) ? cell : leader
                )
                return this.traceRoute(end, best)
            }
            layer = next.filter((cell) => !this.isStationOf(cell, target))
        }
        return undefined
    }

    private nextLayer(
        layer: OffsetCoordinates[],
        best: Map<string, RouteStep>,
        ownerId: string | undefined
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
                const here = this.stepTo(cell, best)
                const station = this.stationAt(neighbor)
                const faceUp = station?.faceUp === true
                const step: RouteStep = {
                    stations: here.stations + (faceUp ? 1 : 0),
                    own:
                        here.own +
                        (faceUp && ownerId !== undefined && station?.ownerId === ownerId ? 1 : 0),
                    previous: cell
                }
                const known = best.get(key)
                if (!known || isBetterStep(step, known)) {
                    best.set(key, step)
                }
                reached.set(key, neighbor)
            }
        }
        return [...reached.values()]
    }

    private stepTo(cell: OffsetCoordinates, best: Map<string, RouteStep>): RouteStep {
        return best.get(cellKey(cell)) ?? { stations: 0, own: 0 }
    }

    private traceRoute(end: OffsetCoordinates, best: Map<string, RouteStep>): Route {
        const cells: OffsetCoordinates[] = []
        let cell: OffsetCoordinates | undefined = end
        while (cell) {
            cells.unshift(cell)
            cell = best.get(cellKey(cell))?.previous
        }
        return { cells, stations: this.stepTo(end, best).stations }
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

    private fitsWithLimit(added: OffsetCoordinates): boolean {
        const cells = [CentralCell, added, ...this.board.stations.map((station) => station.cell)]
        const span = (values: number[]) => Math.max(...values) - Math.min(...values) + 1
        return (
            span(cells.map((cell) => cell.col)) <= MaxGridSize &&
            span(cells.map((cell) => cell.row)) <= MaxGridSize
        )
    }

    private makesOpenConnection(cell: OffsetCoordinates, face: TileFace): boolean {
        const placed: Occupant = { kind: 'tile', face }
        return SidesClockwise.some((side) => {
            const neighbor = this.occupant(neighborCell(cell, side))
            return neighbor !== undefined && isOpen(placed, neighbor, side)
        })
    }
}
