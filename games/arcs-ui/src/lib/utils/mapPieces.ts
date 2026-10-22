import type { Point } from '@tabletop/common'
import type { Building, HydratedArcsGameState, MoveShips, SystemId } from '@tabletop/arcs'
import { systemLayout } from './mapLayout.js'

// What the map draws, one keyed piece each: an owner's ships in a system, a building in a slot
// (keyed by its face, so a damaged or changed building is a new piece), or an empty slot.
export type ShipsPiece = {
    kind: 'ships'
    key: string
    system: SystemId
    owner: string
    fresh: number
    damaged: number
    at: Point
}
export type BuildingPiece = {
    kind: 'building'
    key: string
    system: SystemId
    slot: number
    building: Building
    at: Point
}
export type EmptySlotPiece = { kind: 'slot'; key: string; system: SystemId; at: Point }
export type MapPiece = ShipsPiece | BuildingPiece | EmptySlotPiece

const slotKey = (system: SystemId, slot: number) => `${system}:${slot}`

export function mapPieces(state: HydratedArcsGameState): MapPiece[] {
    return state.systems
        .filter((system) => state.inPlay(system.id))
        .flatMap((system) => {
            const layout = systemLayout(system)
            const buildings = layout.buildings.map(({ slot, building, at }): MapPiece => {
                const place = slotKey(system.id, slot)
                return building
                    ? {
                          kind: 'building',
                          key: `building:${place}:${building.owner}:${building.kind}:${building.damaged}`,
                          system: system.id,
                          slot,
                          building,
                          at
                      }
                    : { kind: 'slot', key: `slot:${place}`, system: system.id, at }
            })
            const ships = layout.ships.map(({ owner, fresh, damaged, at }): MapPiece => ({
                kind: 'ships',
                key: `ships:${system.id}:${owner}`,
                system: system.id,
                owner,
                fresh,
                damaged,
                at
            }))
            return [...buildings, ...ships]
        })
}

// Ships of one owner moving from one system to another, by the systems passed through. Flights of
// a later `leg` start once the earlier have landed.
export type Flight = { owner: string; ships: number; route: SystemId[]; leg: number }

export type MapChanges = {
    arriving: MapPiece[]
    leaving: MapPiece[]
    // Pieces in both states whose place moved, as when a stack shifts for another owner's.
    shifted: { piece: MapPiece; from: Point }[]
    // A building that changed face in its slot.
    turned: { from: BuildingPiece; to: BuildingPiece }[]
    // Ship stacks in both states whose ships changed.
    resized: { from: ShipsPiece; to: ShipsPiece }[]
}

export function mapChanges(from: readonly MapPiece[], to: readonly MapPiece[]): MapChanges {
    const before = new Map(from.map((piece) => [piece.key, piece]))
    const after = new Map(to.map((piece) => [piece.key, piece]))
    const arriving = to.filter((piece) => !before.has(piece.key))
    const leaving = from.filter((piece) => !after.has(piece.key))
    const turned = arriving.flatMap((piece) => {
        if (piece.kind !== 'building') return []
        const old = leaving.find(
            (candidate): candidate is BuildingPiece =>
                candidate.kind === 'building' &&
                candidate.system === piece.system &&
                candidate.slot === piece.slot
        )
        return old ? [{ from: old, to: piece }] : []
    })
    const shifted: MapChanges['shifted'] = []
    const resized: MapChanges['resized'] = []
    for (const piece of to) {
        const old = before.get(piece.key)
        if (!old) continue
        if (old.at.x !== piece.at.x || old.at.y !== piece.at.y) {
            shifted.push({ piece, from: old.at })
        }
        if (
            old.kind === 'ships' &&
            piece.kind === 'ships' &&
            (old.fresh !== piece.fresh || old.damaged !== piece.damaged)
        ) {
            resized.push({ from: old, to: piece })
        }
    }
    return { arriving, leaving, shifted, turned, resized }
}

// Each owner's ships in each system.
function shipCounts(pieces: readonly MapPiece[]): Map<string, Map<SystemId, number>> {
    const counts = new Map<string, Map<SystemId, number>>()
    for (const piece of pieces) {
        if (piece.kind !== 'ships') continue
        const owned = counts.get(piece.owner) ?? new Map<SystemId, number>()
        owned.set(piece.system, piece.fresh + piece.damaged)
        counts.set(piece.owner, owned)
    }
    return counts
}

// Ships that left one system and turned up in another, paired by owner in map order, flying
// straight there. Ships lost without turning up anywhere, or gained from nowhere, don't fly.
export function inferredFlights(from: readonly MapPiece[], to: readonly MapPiece[]): Flight[] {
    const before = shipCounts(from)
    const after = shipCounts(to)
    const owners = new Set([...before.keys(), ...after.keys()])
    const flights: Flight[] = []
    for (const owner of owners) {
        const was = before.get(owner) ?? new Map<SystemId, number>()
        const is = after.get(owner) ?? new Map<SystemId, number>()
        const systems = [...new Set([...was.keys(), ...is.keys()])]
        const losses = systems
            .map((system) => ({ system, count: (was.get(system) ?? 0) - (is.get(system) ?? 0) }))
            .filter(({ count }) => count > 0)
        const gains = systems
            .map((system) => ({ system, count: (is.get(system) ?? 0) - (was.get(system) ?? 0) }))
            .filter(({ count }) => count > 0)
        for (const gain of gains) {
            for (const loss of losses) {
                const ships = Math.min(gain.count, loss.count)
                if (ships === 0) continue
                flights.push({ owner, ships, route: [loss.system, gain.system], leg: 0 })
                gain.count -= ships
                loss.count -= ships
            }
        }
    }
    return flights
}

// A move's ships along its path, each drop-off peeling away where it was left, then Sprinter Drives'
// ships moving on.
export function moveFlights(move: MoveShips): Flight[] {
    const owner = move.playerId
    const route = [move.from, ...move.path]
    let left = move.fresh + move.damaged
    const flights: Flight[] = []
    for (const [step, drop] of move.dropOffs.entries()) {
        const dropped = drop.fresh + drop.damaged
        if (dropped === 0) continue
        flights.push({ owner, ships: dropped, route: route.slice(0, step + 2), leg: 0 })
        left -= dropped
    }
    flights.push({ owner, ships: left, route, leg: 0 })
    const sprint = move.sprint
    if (sprint) {
        const sprintRoute = [sprint.from, ...sprint.path]
        let sprinting = sprint.fresh
        for (const [step, drop] of sprint.dropOffs.entries()) {
            if (drop.fresh === 0) continue
            flights.push({
                owner,
                ships: drop.fresh,
                route: sprintRoute.slice(0, step + 2),
                leg: 1
            })
            sprinting -= drop.fresh
        }
        flights.push({ owner, ships: sprinting, route: sprintRoute, leg: 1 })
    }
    return flights
}
