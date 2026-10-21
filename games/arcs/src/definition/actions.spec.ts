import { describe, expect, it } from 'vitest'
import { Resource } from '../components/resources.js'
import type { SystemId } from '../components/map.js'
import type { ArcsProjectedState } from '../model/gameState.js'
import { BuildingKind } from '../model/pieces.js'
import { ActionType } from './actions.js'
import { startTestGame, type TestSession } from '../util/testHelper.js'

type Setup = (state: ArcsProjectedState, players: string[]) => void

// A 3-player game with an empty map: the first player leads `cardId` and is taking actions.
function leading(
    cardId: string,
    setup: Setup = () => {}
): { session: TestSession; players: string[] } {
    const session = startTestGame(3)
    const players = [...session.state.turnManager.turnOrder]
    session.edit((state) => {
        for (const system of state.systems) {
            system.ships = {}
            system.slots = system.slots.map(() => null)
        }
        for (const player of state.players) {
            player.hand = player.playerId === players[0] ? [cardId] : ['mobilization-2']
            player.handCount = player.hand.length
            player.resources = player.resources.map(() => null)
        }
        state.outOfPlay = []
        setup(state, players)
    })
    session.act(players[0], ActionType.LeadCard, { cardId })
    return { session, players }
}

function ships(state: ArcsProjectedState, id: SystemId, owner: string, fresh: number, damaged = 0) {
    const system = state.systems.find((candidate) => candidate.id === id)
    if (system) {
        system.ships[owner] = { fresh, damaged }
    }
}

function building(
    state: ArcsProjectedState,
    id: SystemId,
    slot: number,
    owner: string,
    kind: BuildingKind,
    damaged = false
) {
    const system = state.systems.find((candidate) => candidate.id === id)
    if (system) {
        system.slots[slot] = { owner, kind, damaged }
    }
}

describe('tax', () => {
    it('gains the planet’s resource from a Loyal city, once per turn', () => {
        const { session, players } = leading('administration-2', (state, [a]) => {
            building(state, '1H', 0, a, BuildingKind.City)
        })
        const [a] = players
        session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        const player = session.hydrated().getPlayerState(a)
        expect(player.resources[0]).toBe(Resource.Material)
        expect(() => session.act(a, ActionType.Tax, { system: '1H', slot: 0 })).toThrow()
    })

    it('captures an agent when taxing a Rival city the player controls', () => {
        const { session, players } = leading('administration-2', (state, [a, b]) => {
            building(state, '1H', 0, b, BuildingKind.City)
            ships(state, '1H', a, 2)
            ships(state, '1H', b, 1)
        })
        const [a, b] = players
        const [tax] = session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        expect(tax).toMatchObject({ metadata: { resource: Resource.Material, captured: b } })
        const state = session.hydrated()
        expect(state.getPlayerState(a).captives).toEqual({ [b]: 1 })
        expect(state.getPlayerState(b).agents).toBe(9)
    })

    it('refuses a Rival city without control', () => {
        const { session, players } = leading('administration-2', (state, [a, b]) => {
            building(state, '1H', 0, b, BuildingKind.City)
            ships(state, '1H', a, 1)
            ships(state, '1H', b, 1)
        })
        expect(() => session.act(players[0], ActionType.Tax, { system: '1H', slot: 0 })).toThrow()
    })
})

describe('build', () => {
    it('builds damaged where someone else controls the system', () => {
        const { session, players } = leading('construction-2', (state, [a, b]) => {
            ships(state, '1H', a, 1)
            ships(state, '1H', b, 2)
        })
        const [a] = players
        const [build] = session.act(a, ActionType.BuildBuilding, { system: '1H', building: 'city' })
        expect(build).toMatchObject({ metadata: { damaged: true } })
        // One city went to the map at setup; this is the second.
        expect(session.hydrated().getPlayerState(a).citiesOnBoard).toBe(3)
    })

    it('builds one ship per starport per turn', () => {
        const { session, players } = leading('construction-2', (state, [a]) => {
            building(state, '1H', 0, a, BuildingKind.Starport)
        })
        const [a] = players
        session.act(a, ActionType.BuildShip, { system: '1H', slot: 0 })
        expect(session.hydrated().system('1H').ships[a]).toEqual({ fresh: 1, damaged: 0 })
        expect(() => session.act(a, ActionType.BuildShip, { system: '1H', slot: 0 })).toThrow()
    })

    it('needs a Loyal piece to build a building', () => {
        const { session, players } = leading('construction-2')
        expect(() =>
            session.act(players[0], ActionType.BuildBuilding, { system: '1H', building: 'city' })
        ).toThrow()
    })
})

describe('move', () => {
    it('moves to an adjacent system', () => {
        const { session, players } = leading('mobilization-2', (state, [a]) => {
            ships(state, '1H', a, 3)
        })
        const [a] = players
        session.act(a, ActionType.MoveShips, {
            from: '1H',
            path: ['1G'],
            fresh: 2,
            damaged: 0,
            dropOffs: []
        })
        const state = session.hydrated()
        expect(state.system('1H').ships[a]).toEqual({ fresh: 1, damaged: 0 })
        expect(state.system('1G').ships[a]).toEqual({ fresh: 2, damaged: 0 })
    })

    it('Catapults from a Loyal starport through open gates to a planet, dropping ships off', () => {
        const { session, players } = leading('mobilization-2', (state, [a]) => {
            ships(state, '1H', a, 3)
            building(state, '1H', 0, a, BuildingKind.Starport)
        })
        const [a] = players
        session.act(a, ActionType.MoveShips, {
            from: '1H',
            path: ['1G', '2G', '2A'],
            fresh: 3,
            damaged: 0,
            dropOffs: [
                { fresh: 1, damaged: 0 },
                { fresh: 0, damaged: 0 }
            ]
        })
        const state = session.hydrated()
        expect(state.system('1G').ships[a]).toEqual({ fresh: 1, damaged: 0 })
        expect(state.system('2G').ships[a]).toBeUndefined()
        expect(state.system('2A').ships[a]).toEqual({ fresh: 2, damaged: 0 })
    })

    it('stops a Catapult at a gate someone else controls, and without a starport', () => {
        const blocked = leading('mobilization-2', (state, [a, b]) => {
            ships(state, '1H', a, 3)
            building(state, '1H', 0, a, BuildingKind.Starport)
            ships(state, '1G', b, 1)
        })
        const move = {
            from: '1H',
            path: ['1G', '2G'],
            fresh: 1,
            damaged: 0,
            dropOffs: [{ fresh: 0, damaged: 0 }]
        }
        expect(() => blocked.session.act(blocked.players[0], ActionType.MoveShips, move)).toThrow()
        const plain = leading('mobilization-2', (state, [a]) => ships(state, '1H', a, 3))
        expect(() => plain.session.act(plain.players[0], ActionType.MoveShips, move)).toThrow()
    })
})

describe('repair, influence and secure', () => {
    it('repairs a damaged ship anywhere', () => {
        const { session, players } = leading('administration-2', (state, [a]) => {
            ships(state, '4C', a, 0, 2)
        })
        const [a] = players
        session.act(a, ActionType.Repair, { system: '4C' })
        expect(session.hydrated().system('4C').ships[a]).toEqual({ fresh: 1, damaged: 1 })
    })

    it('secures a Court card with more agents than each Rival, capturing theirs', () => {
        const { session, players } = leading('aggression-2', (state, [a, b]) => {
            state.court[0].agents = { [a]: 2, [b]: 1 }
            for (const player of state.players) {
                player.agents -= state.court[0].agents[player.playerId] ?? 0
            }
        })
        const [a, b] = players
        const cardId = session.state.court[0].cardId
        const before = session.state.court.length
        session.act(a, ActionType.Secure, { cardId })
        const state = session.hydrated()
        expect(state.getPlayerState(a).captives).toEqual({ [b]: 1 })
        expect(state.getPlayerState(a).agents).toBe(10)
        expect(state.court.map((slot) => slot.cardId)).not.toContain(cardId)
        expect(state.court).toHaveLength(before)
    })

    it('needs a strict majority to secure', () => {
        const { session, players } = leading('aggression-2', (state, [a, b]) => {
            state.court[0].agents = { [a]: 1, [b]: 1 }
        })
        expect(() =>
            session.act(players[0], ActionType.Secure, { cardId: session.state.court[0].cardId })
        ).toThrow()
    })

    it('influences by placing an agent', () => {
        const { session, players } = leading('mobilization-2')
        const [a] = players
        const cardId = session.state.court[1].cardId
        session.act(a, ActionType.Influence, { cardId })
        expect(session.state.court[1].agents).toEqual({ [a]: 1 })
    })
})

describe('the Prelude', () => {
    it('spends resources for extra actions, returning them when the Prelude ends', () => {
        const { session, players } = leading('administration-2', (state, [a]) => {
            ships(state, '1H', a, 2)
            const player = state.players.find((candidate) => candidate.playerId === a)
            if (player) {
                player.resources = [Resource.Fuel, Resource.Material, null, null, null, null]
            }
        })
        const [a] = players
        // Fuel moves even though Administration can't.
        session.act(a, ActionType.MoveShips, {
            from: '1H',
            path: ['1G'],
            fresh: 1,
            damaged: 0,
            dropOffs: [],
            via: Resource.Fuel
        })
        expect(session.hydrated().turn?.pips).toBe(4)
        const supplyBefore = session.state.supply[Resource.Fuel]
        // Spending a pip ends the Prelude: resources can no longer be spent, and the spent Fuel
        // goes back to the supply.
        session.act(a, ActionType.Influence, { cardId: session.state.court[0].cardId })
        expect(session.state.supply[Resource.Fuel]).toBe(supplyBefore + 1)
        expect(() =>
            session.act(a, ActionType.BuildBuilding, {
                system: '1G',
                building: 'starport',
                via: Resource.Material
            })
        ).toThrow()
    })

    it('lets a spent Weapon make pips battle, and refuses Outraged resources', () => {
        const { session, players } = leading('construction-2', (state, [a]) => {
            const player = state.players.find((candidate) => candidate.playerId === a)
            if (player) {
                player.resources = [Resource.Weapon, Resource.Fuel, null, null, null, null]
                player.outrage = [Resource.Fuel]
            }
        })
        const [a] = players
        expect(session.hydrated().pipActions()).not.toContain('battle')
        session.act(a, ActionType.SpendWeapon)
        expect(session.hydrated().pipActions()).toContain('battle')
        expect(session.hydrated().canSpendResource(a, Resource.Fuel)).toBe(false)
    })
})
