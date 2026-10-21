import { assert } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Die } from '../components/dice.js'
import { Leader } from '../components/personas.js'
import { Resource } from '../components/resources.js'
import { BattleStep, noRerolls } from '../model/battle.js'
import { ArcsGameStateValidator, DraftKind, type ArcsProjectedState } from '../model/gameState.js'
import { BuildingKind } from '../model/pieces.js'
import { PlayKind } from '../model/round.js'
import { ActionType } from './actions.js'
import { LeadersAndLore } from './config.js'
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
                rerolls: noRerolls(),
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
                rerolls: noRerolls(),
                trophiesTaken: false,
                ransacks: 0
            }
        })
        const state = session.hydrated()
        state.tallyRoll()
        expect(state.battle?.attackerHits).toBe(2)
    })
})

describe('declaring an ambition', () => {
    function declaring(
        leader: Leader,
        setup: (state: ArcsProjectedState, players: string[]) => void = () => {}
    ) {
        const session = startTestGame(3)
        const players = [...session.state.turnManager.turnOrder]
        const [a] = players
        session.edit((state) => {
            playerIn(state, a).leader = leader
            playerIn(state, a).hand = ['construction-5']
            playerIn(state, a).handCount = 1
            setup(state, players)
        })
        const declare = () =>
            session.act(a, ActionType.LeadCard, {
                cardId: 'construction-5',
                declare: Ambition.Keeper
            })
        return { session, players, declare }
    }

    it('Feastbringer must give a Guild card to the Rival with the least Power', () => {
        const without = declaring(Leader.Feastbringer)
        expect(() => without.declare()).toThrow()
        const { session, players, declare } = declaring(Leader.Feastbringer, (state, [a, b, c]) => {
            playerIn(state, a).guildCards = [Court.RelicFence]
            playerIn(state, b).power = 3
            playerIn(state, c).power = 1
        })
        const [a, b, c] = players
        declare()
        expect(session.state.machineState).toBe(MachineState.Declaring)
        expect(() =>
            session.act(a, ActionType.GiveGuildCard, { cardId: Court.RelicFence, to: b })
        ).toThrow()
        session.act(a, ActionType.GiveGuildCard, { cardId: Court.RelicFence, to: c })
        expect(session.hydrated().getPlayerState(c).guildCards).toEqual([Court.RelicFence])
        expect(session.state.machineState).toBe(MachineState.TakingActions)
    })

    it('Noble secures the top Court card for an undeclared ambition', () => {
        const { session, players, declare } = declaring(Leader.Noble, (state) => {
            assert(ArcsGameStateValidator.Check(state), 'The test game is canonical')
            state.courtDeck.items.push(Court.RelicFence)
            state.courtDeck.remaining += 1
        })
        const [a] = players
        const processed = declare()
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.LeadCard,
            ActionType.DrawCourtCard
        ])
        expect(session.hydrated().getPlayerState(a).guildCards).toEqual([Court.RelicFence])
        expect(session.state.turn?.securedInPrelude).toEqual([Court.RelicFence])
        expect(session.state.machineState).toBe(MachineState.TakingActions)
    })

    it('Noble resolves a drawn Vox card’s choices', () => {
        const { session, players, declare } = declaring(Leader.Noble, (state) => {
            assert(ArcsGameStateValidator.Check(state), 'The test game is canonical')
            state.courtDeck.items.push(Court.MassUprising)
            state.courtDeck.remaining += 1
        })
        const [a] = players
        declare()
        expect(session.state.declaration?.drawn).toBe(Court.MassUprising)
        const before = session.hydrated().getPlayerState(a).ships
        session.act(a, ActionType.ResolveConnected, { vox: { cluster: 3 } })
        // A ship in each of cluster 3's four systems.
        expect(session.hydrated().getPlayerState(a).ships).toBe(before - 4)
        expect(session.state.machineState).toBe(MachineState.TakingActions)
    })

    it('Upstart gains any resource, and the Demagogue influences Court cards', () => {
        const upstart = declaring(Leader.Upstart)
        const [a] = upstart.players
        upstart.declare()
        upstart.session.act(a, ActionType.GainOnDeclaring, { resource: Resource.Relic })
        expect(upstart.session.hydrated().getPlayerState(a).resourceCount(Resource.Relic)).toBe(2)
        const demagogue = declaring(Leader.Demagogue)
        demagogue.declare()
        const court = demagogue.session.state.court.map((slot) => slot.cardId)
        demagogue.session.act(a, ActionType.BoldInfluence, { cardIds: court.slice(0, 2) })
        expect(demagogue.session.state.court[0].agents).toEqual({ [a]: 1 })
        expect(demagogue.session.state.court[1].agents).toEqual({ [a]: 1 })
        expect(demagogue.session.state.machineState).toBe(MachineState.TakingActions)
    })
})

describe('leaders’ extra actions on a Copy or Pivot', () => {
    function following(
        leader: Leader,
        card: string,
        setup: (state: ArcsProjectedState, players: string[]) => void = () => {}
    ) {
        const result = leadingOnEmptyBoard('construction-2', (state, players) => {
            const [a, b] = players
            setShips(state, '6H', a, 1)
            playerIn(state, b).leader = leader
            playerIn(state, b).hand = [card]
            setup(state, players)
        })
        const [a, b] = result.players
        result.session.act(a, ActionType.EndTurn)
        result.session.act(b, ActionType.FollowCard, { cardId: card, playKind: PlayKind.Pivot })
        return result
    }

    it('Warrior moves before battling, and must then battle', () => {
        const { session, players } = following(Leader.Warrior, 'aggression-3', (state, [a, b]) => {
            setShips(state, '1H', b, 2)
            setShips(state, '1G', a, 1)
        })
        const [, b] = players
        session.act(b, ActionType.MoveShips, {
            from: '1H',
            path: ['1G'],
            fresh: 2,
            damaged: 0,
            dropOffs: [],
            bonus: true
        })
        expect(session.state.turn?.owed).toBe('battle')
        expect(() => session.act(b, ActionType.EndTurn)).toThrow()
        expect(() =>
            session.act(b, ActionType.Influence, { cardId: session.state.court[0].cardId })
        ).toThrow()
    })

    it('Noble influences twice', () => {
        const { session, players } = following(Leader.Noble, 'administration-3')
        const [, b] = players
        const cardId = session.state.court[0].cardId
        session.act(b, ActionType.Influence, { cardId })
        expect(() => session.act(b, ActionType.Influence, { cardId })).toThrow()
        session.act(b, ActionType.Influence, { cardId, bonus: true })
        expect(session.state.court[0].agents).toEqual({ [b]: 2 })
        expect(() => session.act(b, ActionType.Influence, { cardId, bonus: true })).toThrow()
    })
})

describe('Overseer and Shaper', () => {
    it('Ruthless destroys a damaged Rival city to tax it again: Outrage, Trophy and Ransack', () => {
        const { session, players } = leadingOnEmptyBoard('administration-2', (state, [a, b]) => {
            playerIn(state, a).leader = Leader.Overseer
            setShips(state, '1H', a, 2)
            setBuilding(state, '1H', 0, b, BuildingKind.City, true)
            state.court[0].agents = { [b]: 1 }
        })
        const [a, b] = players
        session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        const cardId = session.state.court[0].cardId
        expect(() => session.act(a, ActionType.Ruthless, {})).toThrow()
        const [ruthless] = session.act(a, ActionType.Ruthless, { ransack: cardId })
        expect(ruthless).toMatchObject({
            metadata: { destroyed: true, gained: [Resource.Material] }
        })
        const state = session.hydrated()
        const overseer = state.getPlayerState(a)
        // The first Material went to Outrage; the second came after it.
        expect(overseer.resourceCount(Resource.Material)).toBe(1)
        expect(overseer.outrage).toEqual([Resource.Material])
        expect(overseer.trophies).toContainEqual({ owner: b, kind: 'city' })
        expect(overseer.trophies).toContainEqual({ owner: b, kind: 'agent' })
        expect(() => session.act(a, ActionType.Ruthless, {})).toThrow()
    })

    it('Mythic changes a planet’s type for good', () => {
        const { session, players } = leadingOnEmptyBoard('administration-2', (state, [a]) => {
            playerIn(state, a).leader = Leader.Shaper
            setBuilding(state, '1H', 0, a, BuildingKind.City)
            playerIn(state, a).resources = [Resource.Relic, null, null, null, null, null]
        })
        const [a] = players
        session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        session.act(a, ActionType.Mythic, { resource: Resource.Relic })
        const state = session.hydrated()
        expect(state.planetType('1H')).toBe(Resource.Relic)
        expect(state.getPlayerState(a).resources.slice(0, 2)).toEqual([null, Resource.Material])
    })
})

describe('the Archivist', () => {
    it('draws 5 lore after setup and keeps 2', () => {
        const session = startTestGame(3, { leadersAndLore: LeadersAndLore.OneLore })
        session.edit((state) => {
            if (state.draft) {
                state.draft.leaders[0] = Leader.Archivist
            }
        })
        while (session.state.machineState === MachineState.Drafting) {
            const playerId = session.currentPlayerId()
            const state = session.hydrated()
            const leader = state.needsFromDraft(playerId, DraftKind.Leader)
            session.act(playerId, ActionType.DraftCard, {
                cardId: leader ? state.draft?.leaders[0] : state.draft?.lore[0],
                kind: leader ? DraftKind.Leader : DraftKind.Lore
            })
        }
        expect(session.state.machineState).toBe(MachineState.Archiving)
        const archive = session.state.archive
        expect(archive?.cards).toHaveLength(5)
        const archivist = archive?.playerId ?? ''
        expect(session.state.activePlayerIds).toEqual([archivist])
        session.act(archivist, ActionType.KeepLore, { cardIds: archive?.cards.slice(0, 2) })
        expect(session.hydrated().getPlayerState(archivist).lore).toHaveLength(3)
        expect(session.state.machineState).toBe(MachineState.PlayingCard)
    })
})
