import { describe, expect, it } from 'vitest'
import {
    actionCard,
    actionDeckFor,
    ActionCards,
    declarableAmbitions,
    Suits
} from './actionCards.js'
import { CourtCards, LeaderCards, LoreCards } from './cardData.js'
import {
    adjacentSystems,
    clusterOf,
    Clusters,
    isGate,
    planetOf,
    PlanetKinds,
    Planets,
    SystemIds,
    type SystemId
} from './map.js'
import { openResourceSlots, ResourceSlotRaidCosts, wonAmbitionBonus } from './playerBoard.js'
import { Resource, Resources } from './resources.js'
import { clustersInPlay, SetupCards, setupCardsFor } from './setupCards.js'

describe('the map', () => {
    it('has six clusters of a gate and three planets', () => {
        expect(SystemIds).toHaveLength(24)
        expect(SystemIds.filter(isGate)).toHaveLength(6)
    })

    it('has 26 building slots and the printed count of each planet type', () => {
        const planets = Clusters.flatMap((cluster) =>
            PlanetKinds.map((kind) => Planets[cluster][kind])
        )
        expect(planets.reduce((slots, planet) => slots + planet.slots, 0)).toBe(26)
        const ofType = (resource: Resource) =>
            planets.filter((planet) => planet.resource === resource).length
        expect(Resources.map(ofType)).toEqual([4, 4, 4, 3, 3])
    })

    it('joins every gate to its planets and its neighbouring gates', () => {
        const all = [...Clusters]
        expect(adjacentSystems('1G', all).sort()).toEqual(['1A', '1C', '1H', '2G', '6G'])
        expect(adjacentSystems('1C', all).sort()).toEqual(['1A', '1G', '1H'])
        expect(adjacentSystems('1A', all).sort()).toEqual(['1C', '1G'])
    })

    it('crosses between clusters only at 2H–3A and 5H–6A', () => {
        const all = [...Clusters]
        expect(adjacentSystems('2H', all)).toContain('3A')
        expect(adjacentSystems('6A', all)).toContain('5H')
        const crossings = SystemIds.filter((system) => !isGate(system)).flatMap((system) =>
            adjacentSystems(system, all)
                .filter((other) => !isGate(other) && clusterOf(other) !== clusterOf(system))
                .map((other) => [system, other].sort().join('–'))
        )
        expect([...new Set(crossings)].sort()).toEqual(['2H–3A', '5H–6A'])
    })

    it('is symmetric in every setup', () => {
        for (const card of Object.values(SetupCards)) {
            const inPlay = clustersInPlay(card)
            for (const system of SystemIds) {
                for (const other of adjacentSystems(system, inPlay)) {
                    expect(adjacentSystems(other, inPlay)).toContain(system)
                }
            }
        }
    })

    it('carries a path across an out-of-play cluster', () => {
        expect(adjacentSystems('2G', [1, 2, 4, 5, 6])).toContain('4G')
        expect(adjacentSystems('2H', [1, 2, 4, 5, 6])).not.toContain('3A')
        expect(adjacentSystems('3A', [1, 2, 4, 5, 6])).toEqual([])
    })
})

describe('the setup cards', () => {
    it.each([2, 3, 4])('has four cards for %i players', (players) => {
        expect(setupCardsFor(players)).toHaveLength(4)
    })

    it.each(Object.values(SetupCards))(
        '$players players, $name: seats on planets in play',
        (card) => {
            expect(card.outOfPlay).toHaveLength(card.players === 4 ? 1 : 2)
            expect(card.seats).toHaveLength(card.players)
            const inPlay = clustersInPlay(card)
            const used: SystemId[] = []
            for (const seat of card.seats) {
                expect(planetOf(seat.A)).toBeDefined()
                expect(planetOf(seat.B)).toBeDefined()
                expect(seat.C).toHaveLength(card.players === 2 ? 2 : 1)
                for (const system of [seat.A, seat.B, ...seat.C]) {
                    expect(inPlay).toContain(clusterOf(system))
                }
                used.push(seat.A, seat.B)
            }
            // A and B systems each take a building, so no two seats share one.
            expect(new Set(used).size).toBe(used.length)
        }
    )
})

describe('the action cards', () => {
    it('has seven cards in each of four suits', () => {
        expect(ActionCards).toHaveLength(28)
        for (const suit of Suits) {
            expect(ActionCards.filter((card) => card.suit === suit)).toHaveLength(7)
        }
    })

    it('leaves out the 1s and 7s with fewer than 4 players', () => {
        expect(actionDeckFor(2)).toHaveLength(20)
        expect(actionDeckFor(3)).toHaveLength(20)
        expect(actionDeckFor(4)).toHaveLength(28)
    })

    it('gives the printed pips and ambitions', () => {
        expect(actionCard('construction-4').pips).toBe(3)
        expect(actionCard('aggression-1').pips).toBe(3)
        expect(declarableAmbitions(actionCard('construction-4'))).toEqual(['warlord'])
        expect(declarableAmbitions(actionCard('mobilization-1'))).toEqual([])
        expect(declarableAmbitions(actionCard('mobilization-7'))).toHaveLength(5)
    })
})

describe('the player board', () => {
    it('opens resource slots as cities leave it', () => {
        expect(ResourceSlotRaidCosts).toHaveLength(6)
        expect([5, 4, 3, 2, 1, 0].map(openResourceSlots)).toEqual([2, 3, 4, 6, 6, 6])
        expect([5, 4, 3, 2, 1, 0].map(wonAmbitionBonus)).toEqual([0, 0, 0, 0, 2, 5])
    })
})

describe('the Court, lore and leaders', () => {
    it('has the base Court and both sets of lore and leaders', () => {
        expect(CourtCards.filter((card) => card.kind === 'guild')).toHaveLength(25)
        expect(CourtCards.filter((card) => card.kind === 'vox')).toHaveLength(6)
        expect(LoreCards).toHaveLength(28)
        expect(LoreCards.filter((card) => card.pack)).toHaveLength(14)
        expect(LeaderCards).toHaveLength(16)
        expect(LeaderCards.filter((card) => card.pack)).toHaveLength(8)
    })

    it('gives every Guild card a suit and raid cost', () => {
        for (const card of CourtCards.filter((card) => card.kind === 'guild')) {
            expect(card.suit).toBeDefined()
            expect(card.raidCost).toBeGreaterThan(0)
        }
    })
})
