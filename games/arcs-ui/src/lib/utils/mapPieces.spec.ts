import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { ActionType, BuildingKind, type MoveShips, type SystemId } from '@tabletop/arcs'
import {
    inferredFlights,
    mapChanges,
    moveFlights,
    type BuildingPiece,
    type ShipsPiece
} from './mapPieces.js'

const at = { x: 0, y: 0 }
const ships = (system: SystemId, owner: string, fresh: number, damaged = 0): ShipsPiece => ({
    kind: 'ships',
    key: `ships:${system}:${owner}`,
    system,
    owner,
    fresh,
    damaged,
    at
})
const building = (system: SystemId, slot: number, damaged: boolean): BuildingPiece => ({
    kind: 'building',
    key: `building:${system}:${slot}:a:city:${damaged}`,
    system,
    slot,
    building: { owner: 'a', kind: BuildingKind.City, damaged },
    at
})

describe('mapChanges', () => {
    it('finds a building turned over in its slot', () => {
        const changes = mapChanges([building('1A', 0, false)], [building('1A', 0, true)])
        expect(changes.turned).toHaveLength(1)
        expect(changes.turned[0].to.building.damaged).toBe(true)
    })

    it('finds ship stacks whose ships changed, and stacks that moved', () => {
        const moved = { ...ships('1A', 'a', 2), at: { x: 10, y: 0 } }
        const changes = mapChanges([ships('1A', 'a', 3)], [moved])
        expect(changes.resized).toHaveLength(1)
        expect(changes.shifted).toEqual([{ piece: moved, from: at }])
    })
})

describe('inferredFlights', () => {
    it("pairs an owner's ships lost in one system with those gained in another", () => {
        const flights = inferredFlights(
            [ships('1A', 'a', 3), ships('1G', 'b', 1)],
            [ships('1A', 'a', 1), ships('1G', 'a', 2)]
        )
        expect(flights).toEqual([{ owner: 'a', ships: 2, route: ['1A', '1G'], leg: 0 }])
    })
})

describe('moveFlights', () => {
    const move = (extra: Partial<MoveShips> = {}): MoveShips => ({
        id: 'move',
        gameId: 'game',
        source: ActionSource.User,
        type: ActionType.MoveShips,
        playerId: 'a',
        from: '1A',
        path: ['1G', '2G', '2A'],
        fresh: 4,
        damaged: 0,
        dropOffs: [
            { fresh: 1, damaged: 0 },
            { fresh: 0, damaged: 0 }
        ],
        ...extra
    })

    it('peels drop-offs away where they were left, the rest going on', () => {
        expect(moveFlights(move())).toEqual([
            { owner: 'a', ships: 1, route: ['1A', '1G'], leg: 0 },
            { owner: 'a', ships: 3, route: ['1A', '1G', '2G', '2A'], leg: 0 }
        ])
    })

    it("flies Sprinter Drives' ships as a second leg", () => {
        const flights = moveFlights(
            move({ sprint: { from: '2A', path: ['2G'], fresh: 2, dropOffs: [] } })
        )
        expect(flights.at(-1)).toEqual({ owner: 'a', ships: 2, route: ['2A', '2G'], leg: 1 })
    })
})
