import { describe, expect, it } from 'vitest'
import type { OffsetCoordinates } from '@tabletop/common'
import {
    BaseLetters,
    Side,
    StationLetter,
    stationTile,
    StationTiles,
    terminalAt,
    Terminal
} from '../components/tiles.js'
import { Grid, isPermanentCell, type PlacedStation } from './board.js'
import { revenueFor } from './gameState.js'

const LetterIndex: Record<StationLetter, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 }

// The printed tile of a letter whose listed sides are positive and the rest negative.
function tileId(letter: StationLetter, positive: Side[] = []): number {
    const bits: Record<Side, number> = { north: 8, east: 4, south: 2, west: 1 }
    const combination = positive.reduce((total, side) => total + bits[side], 0)
    return LetterIndex[letter] * 16 + combination + 1
}

function station(
    letter: StationLetter,
    cell: OffsetCoordinates,
    options: Partial<PlacedStation> & { positive?: Side[] } = {}
): PlacedStation {
    const { positive, ...rest } = options
    return {
        cell,
        tileId: tileId(letter, positive),
        rotation: 0,
        faceUp: true,
        cubes: 0,
        ...rest
    }
}

// The setup cross around the Central Station, every terminal negative.
function negativeCross(): PlacedStation[] {
    return [
        station(StationLetter.A, { col: 0, row: -1 }),
        station(StationLetter.B, { col: 1, row: 0 }),
        station(StationLetter.C, { col: 0, row: 1 }),
        station(StationLetter.D, { col: -1, row: 0 })
    ]
}

const cells = (placements: { cell: OffsetCoordinates }[]) =>
    placements.map(({ cell }) => `${cell.col},${cell.row}`).sort()

describe('station tiles', () => {
    it('prints every terminal combination once per letter', () => {
        for (const letter of [...BaseLetters, StationLetter.E]) {
            const combos = StationTiles.filter((tile) => tile.letter === letter).map((tile) =>
                [Side.North, Side.East, Side.South, Side.West]
                    .map((side) => tile.terminals[side])
                    .join()
            )
            expect(new Set(combos).size).toBe(16)
        }
    })

    it('numbers tiles as the art does', () => {
        expect(stationTile(1).terminals).toEqual({
            north: Terminal.Negative,
            east: Terminal.Negative,
            south: Terminal.Negative,
            west: Terminal.Negative
        })
        expect(stationTile(2).terminals.west).toBe(Terminal.Positive)
        expect(stationTile(9).terminals.north).toBe(Terminal.Positive)
        expect(stationTile(17).letter).toBe(StationLetter.B)
        expect(stationTile(64).letter).toBe(StationLetter.D)
    })

    it('turns terminals clockwise with the tile', () => {
        const westOnly = stationTile(2)
        expect(terminalAt(westOnly, 1, Side.North)).toBe(Terminal.Positive)
        expect(terminalAt(westOnly, 1, Side.West)).toBe(Terminal.Negative)
        expect(terminalAt(westOnly, 2, Side.East)).toBe(Terminal.Positive)
        expect(terminalAt(westOnly, 3, Side.South)).toBe(Terminal.Positive)
    })
})

describe('connections', () => {
    it('closes every edge of the Central Station', () => {
        const grid = new Grid({ stations: negativeCross() })
        expect(grid.closedConnections()).toHaveLength(4)
    })

    it('closes opposite terminals and opens matching ones or a face-down tile', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 1, row: -1 }, { positive: [Side.West] }),
            station(StationLetter.B, { col: -1, row: -1 }, { positive: [Side.East], faceUp: false })
        ]
        const closed = new Grid({ stations }).closedConnections()
        expect(closed).toContainEqual({ cell: { col: 0, row: -1 }, side: Side.East })
        expect(closed).not.toContainEqual({ cell: { col: -1, row: -1 }, side: Side.East })
        expect(closed).toHaveLength(5)
    })

    it('makes only the tiles beside the Central Station permanent', () => {
        expect(isPermanentCell({ col: 0, row: -1 })).toBe(true)
        expect(isPermanentCell({ col: 1, row: -1 })).toBe(false)
    })
})

describe('legal placements', () => {
    it('must touch two tiles when it can', () => {
        const grid = new Grid({ stations: negativeCross() })
        const placements = grid.legalPlacements(tileId(StationLetter.A), true)
        expect(cells(placements)).toEqual(['-1,-1', '-1,1', '1,-1', '1,1'])
        expect(placements[0].rotations).toEqual([0, 1, 2, 3])
    })

    it('must make an open connection when it can', () => {
        const grid = new Grid({ stations: negativeCross() })
        const threePositive = tileId(StationLetter.A, [Side.North, Side.East, Side.South])
        const placements = grid.legalPlacements(threePositive, true)
        expect(cells(placements)).toEqual(['-1,-1', '-1,1', '1,-1', '1,1'])
        // At the north-east corner the one negative terminal must face A to the west or B below.
        const northEast = placements.find(({ cell }) => cell.col === 1 && cell.row === -1)
        expect(northEast?.rotations).toEqual([0, 3])
    })

    it('puts touching two tiles before an open connection', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.B, { col: 0, row: -2 }, { positive: [Side.North] })
        ]
        const allPositive = tileId(StationLetter.C, [Side.North, Side.East, Side.South, Side.West])
        const placements = new Grid({ stations }).legalPlacements(allPositive, true)
        expect(cells(placements)).toEqual(['-1,-1', '-1,1', '1,-1', '1,1'])
        expect(placements.every((placement) => placement.rotations.length === 4)).toBe(true)
    })

    it('places a face-down tile in one orientation', () => {
        const grid = new Grid({ stations: negativeCross() })
        const placements = grid.legalPlacements(tileId(StationLetter.A), false)
        expect(placements.every((placement) => placement.rotations.length === 1)).toBe(true)
    })
})

describe('routes', () => {
    it('runs to an adjacent station of the next letter, counting both ends', () => {
        const stations = [...negativeCross(), station(StationLetter.A, { col: 1, row: -1 })]
        const route = new Grid({ stations }).bestRoute({ col: 1, row: -1 })
        expect(route?.cells).toEqual([
            { col: 1, row: -1 },
            { col: 1, row: 0 }
        ])
        expect(revenueFor(route)).toBe(3)
    })

    it('never passes through the Central Station', () => {
        const route = new Grid({ stations: negativeCross() }).bestRoute({ col: 0, row: -1 })
        expect(route).toBeUndefined()
        expect(revenueFor(route)).toBe(0)
    })

    it('runs from D back to A', () => {
        const stations = [...negativeCross(), station(StationLetter.D, { col: 1, row: -1 })]
        const route = new Grid({ stations }).bestRoute({ col: 1, row: -1 })
        expect(route?.cells.at(-1)).toEqual({ col: 0, row: -1 })
    })

    it('takes the better-paying of two equally short routes', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 10, row: 10 }),
            station(StationLetter.C, { col: 11, row: 10 }),
            station(StationLetter.C, { col: 10, row: 11 }, { faceUp: false }),
            station(StationLetter.B, { col: 11, row: 11 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells[1]).toEqual({ col: 11, row: 10 })
        expect(route?.stations).toBe(3)
    })

    it('takes the shortest route even when a longer one pays more', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 10, row: 10 }),
            station(StationLetter.C, { col: 11, row: 10 }, { faceUp: false }),
            station(StationLetter.B, { col: 12, row: 10 }),
            station(StationLetter.C, { col: 10, row: 11 }),
            station(StationLetter.C, { col: 10, row: 12 }),
            station(StationLetter.C, { col: 11, row: 12 }),
            station(StationLetter.C, { col: 12, row: 12 }),
            station(StationLetter.C, { col: 12, row: 11 })
        ]
        const route = new Grid({ stations }).bestRoute({ col: 10, row: 10 })
        expect(route?.cells).toHaveLength(3)
        expect(route?.stations).toBe(2)
    })

    it('stops at a closed connection', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 10, row: 10 }),
            station(StationLetter.B, { col: 11, row: 10 }, { positive: [Side.West] })
        ]
        expect(new Grid({ stations }).bestRoute({ col: 10, row: 10 })).toBeUndefined()
    })

    it('ends only at a face-up station', () => {
        const stations = [
            ...negativeCross(),
            station(StationLetter.A, { col: 10, row: 10 }),
            station(StationLetter.B, { col: 11, row: 10 }, { faceUp: false })
        ]
        expect(new Grid({ stations }).bestRoute({ col: 10, row: 10 })).toBeUndefined()
    })
})
