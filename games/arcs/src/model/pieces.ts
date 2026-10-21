import * as Type from 'typebox'
import { SystemIdSchema } from '../components/map.js'

// Who a piece belongs to: a player id. Kept a plain string so the campaign can add owners that
// aren't players, such as the Empire, Free cities and the Blight.
export const Owner = Type.String()

export enum BuildingKind {
    City = 'city',
    Starport = 'starport'
}

export enum TrophyKind {
    Ship = 'ship',
    City = 'city',
    Starport = 'starport',
    Agent = 'agent'
}

export type Building = Type.Static<typeof Building>
export const Building = Type.Object({
    owner: Owner,
    kind: Type.Enum(BuildingKind),
    damaged: Type.Boolean()
})

export type ShipCount = Type.Static<typeof ShipCount>
export const ShipCount = Type.Object({
    fresh: Type.Integer({ minimum: 0 }),
    damaged: Type.Integer({ minimum: 0 })
})

// A system's pieces: ships by owner, and a building or nothing in each building slot. Gates have no
// slots. `extraBuildings` holds buildings outside slots, which some lore allows (a starport or city
// on a gate, a city beside a planet's slots); a destroyed one leaves null, so the indexes of the
// others don't move.
export type SystemState = Type.Static<typeof SystemState>
export const SystemState = Type.Object({
    id: SystemIdSchema,
    ships: Type.Record(Type.String(), ShipCount),
    slots: Type.Array(Type.Union([Building, Type.Null()])),
    extraBuildings: Type.Array(Type.Union([Building, Type.Null()]))
})

export type Trophy = Type.Static<typeof Trophy>
export const Trophy = Type.Object({
    owner: Owner,
    kind: Type.Enum(TrophyKind)
})

export function shipsOf(system: SystemState, owner: string): ShipCount {
    return system.ships[owner] ?? { fresh: 0, damaged: 0 }
}

export function buildingsIn(system: SystemState): Building[] {
    return [...system.slots, ...system.extraBuildings].filter(
        (building): building is Building => building !== null
    )
}

// Something to steal from a Rival: the resource in one of their slots, or one of their Guild cards.
export type StealTarget = Type.Static<typeof StealTarget>
export const StealTarget = Type.Object({
    playerId: Type.String(),
    slot: Type.Optional(Type.Integer({ minimum: 0 })),
    cardId: Type.Optional(Type.String())
})
