import type { Point } from '@tabletop/common'
import { isGate, type SystemId, type SystemState, type Building } from '@tabletop/arcs'

// The map art's own pixel size; everything on the board is laid out in these units.
export const MapSize = { width: 2528, height: 1776 }

// The column beside the map for the ambitions and the Court.
export const SideColumnWidth = 820

const MapCentre: Point = { x: 1264, y: 888 }

// Where HRF lays each system's pieces, on the inner end of its wedge or on its gate.
const SystemAnchors: Readonly<Record<SystemId, Point>> = {
    '1G': { x: 1300, y: 550 },
    '1A': { x: 1050, y: 360 },
    '1C': { x: 1320, y: 130 },
    '1H': { x: 1630, y: 400 },
    '2G': { x: 1630, y: 780 },
    '2A': { x: 1810, y: 580 },
    '2C': { x: 1920, y: 730 },
    '2H': { x: 1900, y: 900 },
    '3G': { x: 1590, y: 1110 },
    '3A': { x: 1860, y: 1060 },
    '3C': { x: 2110, y: 1420 },
    '3H': { x: 1670, y: 1370 },
    '4G': { x: 1170, y: 1260 },
    '4A': { x: 1350, y: 1660 },
    '4C': { x: 940, y: 1700 },
    '4H': { x: 570, y: 1630 },
    '5G': { x: 870, y: 990 },
    '5A': { x: 640, y: 1230 },
    '5C': { x: 240, y: 1160 },
    '5H': { x: 530, y: 900 },
    '6G': { x: 910, y: 690 },
    '6A': { x: 630, y: 730 },
    '6C': { x: 630, y: 520 },
    '6H': { x: 830, y: 450 }
}

export const BuildingSize = 88
export const ShipWidth = 96
const ShipRowGap = 70
const BuildingGap = 8

export type PlacedBuilding = {
    slot: number
    building: Building | null
    at: Point
}

export type PlacedShips = {
    owner: string
    fresh: number
    damaged: number
    at: Point
}

export type SystemLayout = {
    id: SystemId
    anchor: Point
    buildings: PlacedBuilding[]
    ships: PlacedShips[]
}

export function systemAnchor(id: SystemId): Point {
    return SystemAnchors[id]
}

// Buildings sit in a row across the wedge at its anchor; each owner's ships stack in rows beyond
// them, towards the rim, or around the gate for a gate.
export function systemLayout(system: SystemState): SystemLayout {
    const anchor = SystemAnchors[system.id]
    const out = direction(MapCentre, anchor)
    const across = { x: -out.y, y: out.x }
    const slots = [...system.slots, ...system.extraBuildings]
    const rowWidth = slots.length * BuildingSize + Math.max(0, slots.length - 1) * BuildingGap
    const buildings = slots.map((building, slot) => ({
        slot,
        building,
        at: offset(
            anchor,
            across,
            -rowWidth / 2 + BuildingSize / 2 + slot * (BuildingSize + BuildingGap)
        )
    }))
    const shipStart = slots.length > 0 && !isGate(system.id) ? BuildingSize * 0.9 : 0
    const ships = Object.entries(system.ships).map(([owner, count], index) => ({
        owner,
        fresh: count.fresh,
        damaged: count.damaged,
        at: offset(anchor, out, shipStart + index * ShipRowGap)
    }))
    return { id: system.id, anchor, buildings, ships }
}

function direction(from: Point, to: Point): Point {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy) || 1
    return { x: dx / length, y: dy / length }
}

function offset(point: Point, along: Point, distance: number): Point {
    return { x: point.x + along.x * distance, y: point.y + along.y * distance }
}
