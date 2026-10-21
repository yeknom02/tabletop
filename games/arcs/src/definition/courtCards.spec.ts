import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Resource } from '../components/resources.js'
import { BuildingKind } from '../model/pieces.js'
import { PlayKind } from '../model/round.js'
import { ActionType } from './actions.js'
import {
    leadingOnEmptyBoard,
    playerIn,
    setBuilding,
    setShips,
    startTestGame
} from '../util/testHelper.js'

describe('Loyal cards', () => {
    it('spend any resource as their own', () => {
        const { session, players } = leadingOnEmptyBoard('construction-2', (state, [a]) => {
            setShips(state, '1H', a, 1)
            playerIn(state, a).resources = [Resource.Fuel, Resource.Fuel, null, null, null, null]
        })
        const [a] = players
        const build = {
            system: '1H',
            building: BuildingKind.Starport,
            via: Resource.Material,
            token: Resource.Fuel
        }
        expect(() => session.act(a, ActionType.BuildBuilding, build)).toThrow()
        session.edit((state) => {
            playerIn(state, a).guildCards = [Court.LoyalEngineers]
        })
        session.act(a, ActionType.BuildBuilding, build)
        expect(session.hydrated().getPlayerState(a).resourceCount(Resource.Fuel)).toBe(1)
    })

    it('ignore Outrage of their own resource', () => {
        const { session, players } = leadingOnEmptyBoard('construction-2', (state, [a]) => {
            setShips(state, '1H', a, 1)
            playerIn(state, a).resources = [Resource.Material, null, null, null, null, null]
            playerIn(state, a).outrage = [Resource.Material]
        })
        const [a] = players
        expect(session.hydrated().canSpendResource(a, Resource.Material)).toBe(false)
        session.edit((state) => {
            playerIn(state, a).guildCards = [Court.LoyalEngineers]
        })
        expect(session.hydrated().canSpendResource(a, Resource.Material)).toBe(true)
    })
})

describe('Cartels', () => {
    it('hold their supply: nobody gains it, and it adds to the holder’s Tycoon', () => {
        const { session, players } = leadingOnEmptyBoard('administration-2', (state, [a, b]) => {
            // 1H is a Material planet.
            setBuilding(state, '1H', 0, a, BuildingKind.City)
            playerIn(state, b).guildCards = [Court.MaterialCartel]
        })
        const [a, b] = players
        const [tax] = session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        expect(tax).not.toHaveProperty('metadata.resource')
        const state = session.hydrated()
        expect(state.getPlayerState(a).resourceCount(Resource.Material)).toBe(0)
        // The Cartel card counts as a Material icon too.
        expect(state.ambitionCount(b, Ambition.Tycoon)).toBe(state.supply[Resource.Material] + 1)
    })

    it('make the holder’s Rivals discard their resource after scoring', () => {
        const session = startTestGame(3)
        const [a, b] = session.state.turnManager.turnOrder
        session.edit((state) => {
            playerIn(state, a).guildCards = [Court.FuelCartel]
            playerIn(state, a).resources = [Resource.Fuel, null, null, null, null, null]
            playerIn(state, b).resources = [
                Resource.Fuel,
                Resource.Material,
                null,
                null,
                null,
                null
            ]
        })
        const state = session.hydrated()
        state.cartelsTakeTheirDue()
        expect(state.getPlayerState(a).resources[0]).toBe(Resource.Fuel)
        expect(state.getPlayerState(b).resources.slice(0, 2)).toEqual([null, Resource.Material])
    })
})

describe('gaining into full slots', () => {
    it('discards a resource, possibly the one taxed', () => {
        const { session, players } = leadingOnEmptyBoard('administration-2', (state, [a]) => {
            setBuilding(state, '1H', 0, a, BuildingKind.City)
            setBuilding(state, '1A', 0, a, BuildingKind.City)
            playerIn(state, a).citiesOnBoard = 5
            playerIn(state, a).resources = [Resource.Fuel, Resource.Relic, null, null, null, null]
        })
        const [a] = players
        expect(() => session.act(a, ActionType.Tax, { system: '1H', slot: 0 })).toThrow()
        const [tax] = session.act(a, ActionType.Tax, {
            system: '1H',
            slot: 0,
            discard: Resource.Relic
        })
        expect(tax).toMatchObject({
            metadata: { resource: Resource.Material, discarded: Resource.Relic }
        })
        expect(session.hydrated().getPlayerState(a).resources.slice(0, 2)).toEqual([
            Resource.Fuel,
            Resource.Material
        ])
    })
})

describe('declaring without the zero marker', () => {
    it('Secret Order declares Keeper or Empath without zeroing the lead card', () => {
        const session = startTestGame(3)
        const [a] = session.state.turnManager.turnOrder
        session.edit((state) => {
            playerIn(state, a).hand = ['construction-5']
            playerIn(state, a).handCount = 1
            playerIn(state, a).guildCards = [Court.SecretOrder]
        })
        session.act(a, ActionType.LeadCard, { cardId: 'construction-5', declare: Ambition.Keeper })
        const state = session.hydrated()
        expect(state.leadNumber()).toBe(5)
        expect(state.ambitionMarkers.some((marker) => marker.ambition === Ambition.Keeper)).toBe(
            true
        )
    })

    it('Galactic Bards declare a Surpass or Pivot card’s ambition, once per round', () => {
        const { session, players } = leadingOnEmptyBoard('construction-2', (state, [a, b]) => {
            setShips(state, '1H', a, 1)
            playerIn(state, b).hand = ['aggression-3']
            playerIn(state, b).handCount = 1
        })
        const [a, b] = players
        session.act(a, ActionType.EndTurn)
        const pivot = {
            cardId: 'aggression-3',
            playKind: PlayKind.Pivot,
            declare: Ambition.Tyrant
        }
        expect(() => session.act(b, ActionType.FollowCard, pivot)).toThrow()
        session.edit((state) => {
            playerIn(state, b).guildCards = [Court.GalacticBards]
        })
        session.act(b, ActionType.FollowCard, pivot)
        const state = session.hydrated()
        expect(state.round.declared).toBe(true)
        expect(state.ambitionMarkers.some((marker) => marker.ambition === Ambition.Tyrant)).toBe(
            true
        )
        // The lead card keeps its number.
        expect(state.leadNumber()).toBe(2)
    })
})
