import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { Resource } from './resources.js'

// The Reach: six clusters around the map's centre, each a gate and three planets. Planets are
// named by their ID symbol, printed beside each on the map: arrow, crescent (moon) and hex.
export const Clusters = [1, 2, 3, 4, 5, 6] as const
export type Cluster = (typeof Clusters)[number]

export enum SystemKind {
    Gate = 'G',
    Arrow = 'A',
    Crescent = 'C',
    Hex = 'H'
}

export const PlanetKinds = [SystemKind.Arrow, SystemKind.Crescent, SystemKind.Hex] as const
export type PlanetKind = (typeof PlanetKinds)[number]

// A system's id is its cluster then its kind, as in '3G' or '5H'.
export type SystemId = `${Cluster}${SystemKind}`
export const SystemIds: readonly SystemId[] = Clusters.flatMap((cluster) =>
    [SystemKind.Gate, ...PlanetKinds].map((kind): SystemId => `${cluster}${kind}`)
)
// The default is only a placeholder for building an Action, which its data replaces.
export const SystemIdSchema = Type.Unsafe<SystemId>(
    Type.String({ pattern: '^[1-6][GACH]$', default: '1G' })
)

export type Planet = {
    resource: Resource
    // Building slots for cities and starports.
    slots: 1 | 2
}

// Transcribed from the map (docs/map.md): each planet's type and its building slots.
export const Planets: Readonly<Record<Cluster, Readonly<Record<PlanetKind, Planet>>>> = {
    1: {
        A: { resource: Resource.Weapon, slots: 2 },
        C: { resource: Resource.Fuel, slots: 1 },
        H: { resource: Resource.Material, slots: 2 }
    },
    2: {
        A: { resource: Resource.Psionic, slots: 1 },
        C: { resource: Resource.Weapon, slots: 1 },
        H: { resource: Resource.Relic, slots: 2 }
    },
    3: {
        A: { resource: Resource.Material, slots: 1 },
        C: { resource: Resource.Fuel, slots: 1 },
        H: { resource: Resource.Weapon, slots: 2 }
    },
    4: {
        A: { resource: Resource.Relic, slots: 2 },
        C: { resource: Resource.Fuel, slots: 2 },
        H: { resource: Resource.Material, slots: 1 }
    },
    5: {
        A: { resource: Resource.Weapon, slots: 1 },
        C: { resource: Resource.Relic, slots: 1 },
        H: { resource: Resource.Psionic, slots: 2 }
    },
    6: {
        A: { resource: Resource.Material, slots: 1 },
        C: { resource: Resource.Fuel, slots: 2 },
        H: { resource: Resource.Psionic, slots: 1 }
    }
}

// Planets in neighbouring clusters that share a thin border. Every other pair of planets in
// different clusters is split by a thick, irregular border.
const CrossClusterPlanets: readonly (readonly [SystemId, SystemId])[] = [
    ['2H', '3A'],
    ['5H', '6A']
]

const SystemKinds: readonly SystemKind[] = Object.values(SystemKind)

export function clusterOf(system: SystemId): Cluster {
    const cluster = Clusters.find((candidate) => system[0] === String(candidate))
    assertExists(cluster, `${system} has no cluster`)
    return cluster
}

export function kindOf(system: SystemId): SystemKind {
    const kind = SystemKinds.find((candidate) => system[1] === candidate)
    assertExists(kind, `${system} has no kind`)
    return kind
}

export function systemId(cluster: Cluster, kind: SystemKind): SystemId {
    return `${cluster}${kind}`
}

export function isGate(system: SystemId): boolean {
    return kindOf(system) === SystemKind.Gate
}

export function planetOf(system: SystemId): Planet | undefined {
    const kind = kindOf(system)
    return kind === SystemKind.Gate ? undefined : Planets[clusterOf(system)][kind]
}

// The next cluster in play going clockwise (+1) or counterclockwise (-1). Out-of-play clusters
// are skipped: their path marker joins the gates either side.
function neighbouringCluster(cluster: Cluster, step: 1 | -1, inPlay: readonly Cluster[]): Cluster {
    const start = Clusters.indexOf(cluster)
    for (let offset = 1; offset < Clusters.length; offset++) {
        const next = Clusters[(start + step * offset + Clusters.length) % Clusters.length]
        if (inPlay.includes(next)) {
            return next
        }
    }
    return cluster
}

// The systems a move can reach in one step, given the clusters in play.
export function adjacentSystems(system: SystemId, inPlay: readonly Cluster[]): SystemId[] {
    const cluster = clusterOf(system)
    if (!inPlay.includes(cluster)) {
        return []
    }
    const kind = kindOf(system)
    const adjacent: SystemId[] = []
    if (kind === SystemKind.Gate) {
        for (const step of [1, -1] as const) {
            const neighbour = neighbouringCluster(cluster, step, inPlay)
            if (neighbour !== cluster) {
                adjacent.push(systemId(neighbour, SystemKind.Gate))
            }
        }
        adjacent.push(...PlanetKinds.map((planet) => systemId(cluster, planet)))
    } else {
        adjacent.push(systemId(cluster, SystemKind.Gate))
        if (kind === SystemKind.Crescent) {
            adjacent.push(systemId(cluster, SystemKind.Arrow), systemId(cluster, SystemKind.Hex))
        } else {
            adjacent.push(systemId(cluster, SystemKind.Crescent))
        }
        for (const [a, b] of CrossClusterPlanets) {
            const other = a === system ? b : b === system ? a : undefined
            if (other !== undefined && inPlay.includes(clusterOf(other))) {
                adjacent.push(other)
            }
        }
    }
    return [...new Set(adjacent)]
}

export function areAdjacent(a: SystemId, b: SystemId, inPlay: readonly Cluster[]): boolean {
    return adjacentSystems(a, inPlay).includes(b)
}
