import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Die } from '../components/dice.js'
import { Leader } from '../components/personas.js'
import { Resource } from '../components/resources.js'
import { BattleStep } from '../model/battle.js'
import { BuildingKind } from '../model/pieces.js'
import { PlayKind } from '../model/round.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import {
    leadingOnEmptyBoard,
    playerIn,
    setBuilding,
    setShips,
    startTestGame
} from '../util/testHelper.js'

describe('leaders scoring', () => {
    it('Elder scores Tyrant a place lower, without the city bonus; the Noble scores no second', () => {
        const session = startTestGame(3)
        const [a, b, c] = session.state.turnManager.turnOrder
        session.edit((state) => {
            state.ambitionMarkers[0].ambition = Ambition.Tyrant
            playerIn(state, a).leader = Leader.Elder
            playerIn(state, a).captives = { [b]: 2 }
            playerIn(state, a).citiesOnBoard = 0
            playerIn(state, b).leader = Leader.Noble
            playerIn(state, b).captives = { [c]: 1 }
        })
        expect(
            session
                .hydrated()
                .scoreAmbition(Ambition.Tyrant)
                .map((award) => [award.playerId, award.power])
        ).toEqual([
            [a, 3],
            [b, 0]
        ])
    })

    it('Fuel-Drinker loses all Fuel after scoring if Tycoon was scored', () => {
        const session = startTestGame(3)
        const [a] = session.state.turnManager.turnOrder
        session.edit((state) => {
            state.ambitionMarkers[0].ambition = Ambition.Tycoon
            playerIn(state, a).leader = Leader.FuelDrinker
            playerIn(state, a).resources = [
                Resource.Fuel,
                Resource.Material,
                null,
                null,
                null,
                null
            ]
        })
        const state = session.hydrated()
        state.lavishSpending()
        expect(state.getPlayerState(a).resources.slice(0, 2)).toEqual([null, Resource.Material])
    })
})

describe('leaders taxing', () => {
    it('Upstart, Callow: cannot tax a Loyal city they do not control', () => {
        const { session, players } = leadingOnEmptyBoard('administration-2', (state, [a, b]) => {
            playerIn(state, a).leader = Leader.Upstart
            setBuilding(state, '1H', 0, a, BuildingKind.City)
            setShips(state, '1H', b, 1)
        })
        expect(session.hydrated().canTaxSlot(players[0], '1H', 0)).toBe(false)
    })

    it('Anarchist taxes empty slots and Rival cities where they have ships, never Loyal cities', () => {
        const { session, players } = leadingOnEmptyBoard('administration-2', (state, [a, b]) => {
            playerIn(state, a).leader = Leader.Anarchist
            setShips(state, '1H', a, 1)
            setShips(state, '1H', b, 2)
            setBuilding(state, '1H', 1, b, BuildingKind.City)
            setBuilding(state, '2H', 0, a, BuildingKind.City)
        })
        const [a, b] = players
        const state = session.hydrated()
        expect(state.canTaxSlot(a, '1H', 0)).toBe(true)
        expect(state.canTaxSlot(a, '1H', 1)).toBe(true)
        expect(state.canTaxSlot(a, '2H', 0)).toBe(false)
        const [tax] = session.act(a, ActionType.Tax, { system: '1H', slot: 1 })
        expect(tax).toMatchObject({ metadata: { captured: b } })
    })

    it('Mystic gains a Psionic too when taxing with a Copy or Pivot pip', () => {
        const { session, players } = leadingOnEmptyBoard('construction-2', (state, [a, b]) => {
            setShips(state, '6H', a, 1)
            playerIn(state, b).leader = Leader.Mystic
            playerIn(state, b).hand = ['administration-3']
            setBuilding(state, '1H', 0, b, BuildingKind.City)
        })
        const [a, b] = players
        session.act(a, ActionType.EndTurn)
        session.act(b, ActionType.FollowCard, {
            cardId: 'administration-3',
            playKind: PlayKind.Pivot
        })
        const [tax] = session.act(b, ActionType.Tax, { system: '1H', slot: 0 })
        expect(tax).toMatchObject({
            metadata: { gained: [Resource.Material, Resource.Psionic] }
        })
    })
})

describe('leaders in battle and moving', () => {
    it('Rebel must collect 2 extra dice and moves at most 2 ships', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            playerIn(state, a).leader = Leader.Rebel
            setShips(state, '1H', a, 3)
            setShips(state, '1H', b, 1)
        })
        const [a, b] = players
        const state = session.hydrated()
        const dice = (assault: number) => ({
            [Die.Assault]: assault,
            [Die.Skirmish]: 0,
            [Die.Raid]: 0
        })
        expect(state.canBattle(a, '1H', b, dice(5))).toBe(true)
        expect(state.canBattle(a, '1H', b, dice(6))).toBe(false)
        expect(state.canBattle(a, '1H', b, dice(1))).toBe(false)
        expect(state.canMove(a, '1H', ['1G'], { fresh: 3, damaged: 0 }, [])).toBe(false)
        expect(state.canMove(a, '1H', ['1G'], { fresh: 2, damaged: 0 }, [])).toBe(true)
    })

    it('Corsair, Wary: no more assault dice than skirmish dice', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            playerIn(state, a).leader = Leader.Corsair
            setShips(state, '1H', a, 3)
            setShips(state, '1H', b, 1)
        })
        const [a, b] = players
        const state = session.hydrated()
        expect(
            state.canBattle(a, '1H', b, { [Die.Assault]: 2, [Die.Skirmish]: 1, [Die.Raid]: 0 })
        ).toBe(false)
        expect(
            state.canBattle(a, '1H', b, { [Die.Assault]: 1, [Die.Skirmish]: 1, [Die.Raid]: 0 })
        ).toBe(true)
    })

    it('Shaper, Ancient: Catapults from gates, not starports', () => {
        const { session, players } = leadingOnEmptyBoard('mobilization-2', (state, [a]) => {
            playerIn(state, a).leader = Leader.Shaper
            setShips(state, '1H', a, 2)
            setBuilding(state, '1H', 0, a, BuildingKind.Starport)
            setShips(state, '1G', a, 2)
        })
        const [a] = players
        const state = session.hydrated()
        const one = { fresh: 1, damaged: 0 }
        const none = { fresh: 0, damaged: 0 }
        expect(state.canMove(a, '1H', ['1G', '2G'], one, [none])).toBe(false)
        expect(state.canMove(a, '1G', ['2G', '2A'], one, [none])).toBe(true)
    })

    it('Demagogue, Paranoid: cannot secure a Guild card with only 1 agent', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a]) => {
            playerIn(state, a).leader = Leader.Demagogue
            state.court[0] = { cardId: Court.RelicFence, agents: { [a]: 1 } }
            state.court[1] = { cardId: Court.CallToAction, agents: { [a]: 1 } }
        })
        const [a] = players
        expect(session.hydrated().canSecure(a, Court.RelicFence)).toBe(false)
        expect(session.hydrated().canSecure(a, Court.CallToAction)).toBe(true)
    })
})

describe('after battle', () => {
    function battling(setup: Parameters<typeof leadingOnEmptyBoard>[1]) {
        const result = leadingOnEmptyBoard('aggression-2', setup)
        const [a, b] = result.players
        result.session.edit((state) => {
            state.machineState = MachineState.Battling
            state.battle = {
                attacker: a,
                defender: b,
                system: '1H',
                rolled: [],
                attackerHits: 0,
                hits: 2,
                buildingHits: 0,
                keys: 0,
                step: BattleStep.Hits,
                rerolls: 0,
                trophiesTaken: false,
                ransacks: 0
            }
        })
        return result
    }

    it('the Elder is not Ransacked, and may influence once the attacker took Trophies', () => {
        const { session, players } = battling((state, [a, b]) => {
            playerIn(state, b).leader = Leader.Elder
            setShips(state, '1H', a, 1)
            setShips(state, '1H', b, 0, 1)
            setBuilding(state, '1H', 0, b, BuildingKind.City, true)
            state.court[0].agents = { [b]: 1 }
        })
        const [a, b] = players
        session.act(a, ActionType.AssignHits, {
            attacking: { damage: 0, destroy: 0 },
            defending: { damage: 0, destroy: 1 },
            buildings: [{ slot: 0, hits: 1 }]
        })
        expect(session.state.battle?.step).toBe(BattleStep.Beloved)
        expect(session.state.activePlayerIds).toEqual([b])
        const cardId = session.state.court[1].cardId
        session.act(b, ActionType.BelovedInfluence, { cardId })
        expect(session.state.court[1].agents).toEqual({ [b]: 1 })
        expect(session.state.battle).toBeUndefined()
        expect(session.state.activePlayerIds).toEqual([a])
    })

    it('the Quartermaster repairs a ship per starport they control', () => {
        const { session, players } = battling((state, [a, b]) => {
            playerIn(state, b).leader = Leader.Quartermaster
            setShips(state, '1H', a, 1)
            setShips(state, '1H', b, 3)
            setShips(state, '2H', b, 1)
            setBuilding(state, '2H', 0, b, BuildingKind.Starport)
            setBuilding(state, '3H', 0, b, BuildingKind.Starport)
        })
        const [a, b] = players
        session.act(a, ActionType.AssignHits, {
            attacking: { damage: 0, destroy: 0 },
            defending: { damage: 2, destroy: 0 },
            buildings: []
        })
        // 3H has no ships of theirs, so only the starport in 2H counts.
        expect(session.hydrated().system('1H').ships[b]).toEqual({ fresh: 2, damaged: 1 })
    })

    it('the Agitator intercepts with Weapon icons, then discards a Weapon', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            playerIn(state, b).leader = Leader.Agitator
            playerIn(state, b).resources = [
                Resource.Weapon,
                Resource.Weapon,
                null,
                null,
                null,
                null
            ]
            setShips(state, '1H', a, 1)
            setShips(state, '1H', b, 1)
        })
        const [a, b] = players
        session.edit((state) => {
            state.machineState = MachineState.Battling
            state.battle = {
                attacker: a,
                defender: b,
                system: '1H',
                rolled: [{ die: Die.Raid, face: 2 }],
                attackerHits: 0,
                hits: 0,
                buildingHits: 0,
                keys: 0,
                step: BattleStep.Hits,
                rerolls: 0,
                trophiesTaken: false,
                ransacks: 0
            }
        })
        const state = session.hydrated()
        state.tallyRoll()
        expect(state.battle?.attackerHits).toBe(2)
    })
})
