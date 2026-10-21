import * as Type from 'typebox'
import { DieSchema, DieFaces, DieSymbol, type Die } from '../components/dice.js'
import { SystemIdSchema } from '../components/map.js'
import type { ShipCount } from './pieces.js'

// Where a battle is: the attacker assigns hits, then Ransacks the Court once per city destroyed,
// then raids with the keys rolled (rule 7.7.1.4).
export enum BattleStep {
    Hits = 'hits',
    Ransack = 'ransack',
    Raid = 'raid'
}

export type RolledDie = Type.Static<typeof RolledDie>
export const RolledDie = Type.Object({
    die: DieSchema,
    face: Type.Integer({ minimum: 0, maximum: 5 })
})

export type BattleState = Type.Static<typeof BattleState>
export const BattleState = Type.Object({
    attacker: Type.String(),
    defender: Type.String(),
    system: SystemIdSchema,
    rolled: Type.Array(RolledDie),
    // Hits on the attacking ships: one per self-hit, plus one per fresh defending ship if any die
    // intercepted.
    attackerHits: Type.Integer({ minimum: 0 }),
    hits: Type.Integer({ minimum: 0 }),
    buildingHits: Type.Integer({ minimum: 0 }),
    keys: Type.Integer({ minimum: 0 }),
    step: Type.Enum(BattleStep),
    // Cities destroyed whose Ransack is still to choose.
    ransacks: Type.Integer({ minimum: 0 })
})

// Hits on one owner's ships in the battle system: how many end up destroyed, and how many fresh
// ships end up damaged. Destroying a damaged ship takes one hit, a fresh ship two.
export type ShipHits = Type.Static<typeof ShipHits>
export const ShipHits = Type.Object({
    damage: Type.Integer({ minimum: 0 }),
    destroy: Type.Integer({ minimum: 0 })
})

export type BuildingHits = Type.Static<typeof BuildingHits>
export const BuildingHits = Type.Object({
    slot: Type.Integer({ minimum: 0 }),
    hits: Type.Integer({ minimum: 1, maximum: 2 })
})

export function symbolsRolled(rolled: readonly RolledDie[], symbol: DieSymbol): number {
    return rolled
        .flatMap(({ die, face }) => DieFaces[die][face])
        .filter((rolledSymbol) => rolledSymbol === symbol).length
}

export function rollDie(die: Die, random: () => number): RolledDie {
    return { die, face: Math.floor(random() * DieFaces[die].length) }
}

// The most hits some ships can take before all are destroyed.
export function shipHitCapacity(ships: ShipCount): number {
    return 2 * ships.fresh + ships.damaged
}

// The ships left after the hits, and how many hits they took; undefined if the allocation can't
// happen. Damaged ships are destroyed before fresh ones, since that takes fewer hits.
export function hitShips(
    ships: ShipCount,
    hits: ShipHits
): { left: ShipCount; used: number } | undefined {
    const destroyedFresh = Math.max(0, hits.destroy - ships.damaged)
    const destroyedDamaged = hits.destroy - destroyedFresh
    const left = {
        fresh: ships.fresh - destroyedFresh - hits.damage,
        damaged: ships.damaged - destroyedDamaged + hits.damage
    }
    if (left.fresh < 0) {
        return undefined
    }
    return { left, used: hits.damage + destroyedDamaged + 2 * destroyedFresh }
}
