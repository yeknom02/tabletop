import * as Type from 'typebox'
import { SystemIdSchema } from '../components/map.js'
import { ResourceSchema } from '../components/resources.js'
import { ShipCount } from './pieces.js'

// New actions that cards offer in place of a standard action (rule 8.2).
export enum NewActionName {
    // Court cards
    Manufacture = 'manufacture',
    Synthesize = 'synthesize',
    Pressgang = 'pressgang',
    Execute = 'execute',
    Abduct = 'abduct',
    Trade = 'trade',
    // Lore
    Summon = 'summon',
    Nurture = 'nurture',
    Prune = 'prune',
    Guide = 'guide',
    Martyr = 'martyr',
    Annex = 'annex'
}

// The choices a new action takes: `discard` for what can't be held; `captives` (by owner) for
// Pressgang and Execute; `gains` for Pressgang; `courtCardId` for Abduct; the building at `system`
// and `slot` for Trade, Summon, Nurture, Prune and Annex; `give` for Trade; `cityType` for a Gate
// Station city Nurtured; `to` and `ships` (by owner) for Guide; and for Martyr, the `target`
// owner whose ship is destroyed, damaged or not.
export type NewActionChoice = Type.Static<typeof NewActionChoice>
export const NewActionChoice = Type.Object({
    name: Type.Enum(NewActionName),
    discard: Type.Optional(Type.Array(ResourceSchema)),
    captives: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 1 }))),
    gains: Type.Optional(Type.Array(ResourceSchema)),
    courtCardId: Type.Optional(Type.String()),
    system: Type.Optional(SystemIdSchema),
    slot: Type.Optional(Type.Integer({ minimum: 0 })),
    give: Type.Optional(ResourceSchema),
    cityType: Type.Optional(ResourceSchema),
    to: Type.Optional(SystemIdSchema),
    ships: Type.Optional(Type.Record(Type.String(), ShipCount)),
    target: Type.Optional(Type.String()),
    targetDamaged: Type.Optional(Type.Boolean())
})

export type NewActionResult = Type.Static<typeof NewActionResult>
export const NewActionResult = Type.Object({
    gained: Type.Array(ResourceSchema),
    discarded: Type.Array(ResourceSchema),
    captured: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
})
