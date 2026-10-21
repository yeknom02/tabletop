import type { ShipCount, ShipHits } from '@tabletop/arcs'

// A first allocation of hits for the attacker to adjust: on their own ships, damage fresh ones
// before destroying any; on the defender's, destroy damaged ships, then fresh ones two hits apiece,
// and damage with a last odd hit.
export function ownShipHits(ships: ShipCount, hits: number): ShipHits {
    const damage = Math.min(hits, ships.fresh)
    const destroy = Math.min(hits - damage, ships.fresh + ships.damaged)
    return { damage: damage - Math.max(0, destroy - ships.damaged), destroy }
}

export function rivalShipHits(ships: ShipCount, hits: number): ShipHits {
    const destroyDamaged = Math.min(hits, ships.damaged)
    const left = hits - destroyDamaged
    const destroyFresh = Math.min(Math.floor(left / 2), ships.fresh)
    const damage = Math.min(left - destroyFresh * 2, ships.fresh - destroyFresh)
    return { damage, destroy: destroyDamaged + destroyFresh }
}

// Building hits go to damaged buildings first, then fresh ones, two apiece.
export function buildingHits(
    buildings: { slot: number; damaged: boolean }[],
    hits: number
): Record<number, number> {
    const allocation: Record<number, number> = {}
    let left = hits
    for (const building of [...buildings].sort((a, b) => Number(b.damaged) - Number(a.damaged))) {
        const take = Math.min(left, building.damaged ? 1 : 2)
        if (take > 0) allocation[building.slot] = take
        left -= take
    }
    return allocation
}
