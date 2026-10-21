import { assert } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isBattle } from '../actions/battle.js'
import { Court } from '../components/courtCards.js'
import { Die, DieSymbol } from '../components/dice.js'
import { Resource } from '../components/resources.js'
import { BattleStep, symbolsRolled, type BattleState, noRerolls } from '../model/battle.js'
import { BuildingKind, TrophyKind } from '../model/pieces.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import {
    leadingOnEmptyBoard,
    playerIn as player,
    setBuilding as building,
    setShips as ships,
    battleFixture,
    type BoardSetup,
    type TestSession
} from '../util/testHelper.js'

function leading(setup: BoardSetup = () => {}) {
    return leadingOnEmptyBoard('aggression-2', setup)
}

// The same, part way through a battle in 1H against the second player.
function battling(
    battle: Partial<BattleState>,
    setup: BoardSetup = () => {}
): { session: TestSession; players: string[] } {
    const result = leading(setup)
    const [a, b] = result.players
    result.session.edit((state) => {
        state.machineState = MachineState.Battling
        state.battle = battleFixture(a, b, battle)
    })
    return result
}

const noHits = { damage: 0, destroy: 0 }

describe('starting a battle', () => {
    it('rolls up to one die per attacking ship, as a reveal', () => {
        const { session, players } = leading((state, [a, b]) => {
            ships(state, '1H', a, 2, 1)
            ships(state, '1H', b, 1)
        })
        const [a, b] = players
        const tooMany = { [Die.Assault]: 2, [Die.Skirmish]: 2, [Die.Raid]: 0 }
        expect(() =>
            session.act(a, ActionType.Battle, {
                system: '1H',
                defender: b,
                dice: tooMany,
                revealsInfo: true
            })
        ).toThrow()
        const [battle] = session.act(a, ActionType.Battle, {
            system: '1H',
            defender: b,
            dice: { [Die.Assault]: 2, [Die.Skirmish]: 1, [Die.Raid]: 0 },
            revealsInfo: true
        })
        assert(isBattle(battle), 'The first processed Action is the battle')
        const rolled = battle.metadata?.rolled ?? []
        expect(rolled.map((die) => die.die)).toEqual([Die.Assault, Die.Assault, Die.Skirmish])
        const state = session.state.battle
        if (state) {
            const intercepts = symbolsRolled(rolled, DieSymbol.Intercept) > 0 ? 1 : 0
            expect(state.attackerHits).toBe(symbolsRolled(rolled, DieSymbol.SelfHit) + intercepts)
            expect(state.hits).toBe(symbolsRolled(rolled, DieSymbol.Hit))
            expect(session.state.machineState).toBe(MachineState.Battling)
        } else {
            // Nothing to resolve: blank dice end the battle at once.
            expect(session.state.machineState).toBe(MachineState.TakingActions)
        }
        // Aggression 2 has 3 pips.
        expect(session.state.turn?.pips).toBe(2)
    })

    it('needs a Rival with pieces there, and Loyal ships', () => {
        const { session, players } = leading((state, [a, b]) => {
            ships(state, '1H', a, 2)
            ships(state, '1G', b, 1)
        })
        const dice = { [Die.Assault]: 1, [Die.Skirmish]: 0, [Die.Raid]: 0 }
        const [a, b] = players
        expect(session.hydrated().canBattle(a, '1H', b, dice)).toBe(false)
        expect(session.hydrated().canBattle(a, '1G', b, dice)).toBe(false)
    })

    it('allows raid dice only against defending buildings, or a defender with none', () => {
        const raid = { [Die.Assault]: 0, [Die.Skirmish]: 0, [Die.Raid]: 1 }
        const elsewhere = leading((state, [a, b]) => {
            ships(state, '1H', a, 2)
            ships(state, '1H', b, 1)
            building(state, '2A', 0, b, BuildingKind.City)
        })
        const [a, b] = elsewhere.players
        expect(elsewhere.session.hydrated().canBattle(a, '1H', b, raid)).toBe(false)
        const none = leading((state, [a, b]) => {
            ships(state, '1H', a, 2)
            ships(state, '1H', b, 1)
        })
        expect(none.session.hydrated().canBattle(a, '1H', b, raid)).toBe(true)
    })
})

describe('assigning hits', () => {
    it('makes every hit count while pieces remain to take it', () => {
        const { session, players } = battling({ attackerHits: 2 }, (state, [a, b]) => {
            ships(state, '1H', a, 3)
            ships(state, '1H', b, 1)
        })
        const [a] = players
        const assign = (attacking: { damage: number; destroy: number }) =>
            session.act(a, ActionType.AssignHits, { attacking, defending: noHits, buildings: [] })
        expect(() => assign({ damage: 1, destroy: 0 })).toThrow()
        assign({ damage: 0, destroy: 1 })
        const state = session.hydrated()
        expect(state.system('1H').ships[a]).toEqual({ fresh: 2, damaged: 0 })
        expect(state.getPlayerState(players[1]).trophies).toEqual([
            { owner: a, kind: TrophyKind.Ship }
        ])
        expect(state.machineState).toBe(MachineState.TakingActions)
    })

    it('sends hits past the last defending ship to the buildings, destroying a city', () => {
        const { session, players } = battling({ hits: 3, buildingHits: 0 }, (state, [a, b, c]) => {
            ships(state, '1H', a, 2)
            ships(state, '1H', b, 0, 1)
            building(state, '1H', 0, b, BuildingKind.City)
            // 1H is a Material planet.
            player(state, a).resources = [
                Resource.Material,
                Resource.Fuel,
                Resource.Material,
                null,
                null,
                null
            ]
            player(state, a).guildCards = ['BC01', 'BC02', 'BC21']
            state.court[0].agents = { [b]: 1, [c]: 2 }
        })
        const [a, b, c] = players
        const supplyBefore = session.state.supply[Resource.Material]
        const agentsBefore = session.hydrated().getPlayerState(a).agents
        expect(() =>
            session.act(a, ActionType.AssignHits, {
                attacking: noHits,
                defending: { damage: 0, destroy: 1 },
                buildings: [{ slot: 0, hits: 1 }]
            })
        ).toThrow()
        const [hits] = session.act(a, ActionType.AssignHits, {
            attacking: noHits,
            defending: { damage: 0, destroy: 1 },
            buildings: [{ slot: 0, hits: 2 }]
        })
        expect(hits).toMatchObject({
            metadata: {
                defenderShipsDestroyed: 1,
                buildingsDestroyed: [BuildingKind.City],
                outraged: [Resource.Material]
            }
        })
        let state = session.hydrated()
        const attacker = state.getPlayerState(a)
        expect(state.system('1H').slots[0]).toBeNull()
        expect(attacker.trophies).toEqual([
            { owner: b, kind: TrophyKind.Ship },
            { owner: b, kind: TrophyKind.City }
        ])
        // Outrage: Material and Material Guild cards are discarded, and an agent covers the slot.
        expect(attacker.resources).toEqual([null, Resource.Fuel, null, null, null, null])
        expect(state.supply[Resource.Material]).toBe(supplyBefore + 2)
        // Loyal Engineers is kept.
        expect(attacker.guildCards).toEqual(['BC01', 'BC21'])
        expect(state.courtDiscard).toContain('BC02')
        expect(attacker.outrage).toEqual([Resource.Material])
        expect(attacker.agents).toBe(agentsBefore - 1)
        // Ransack: the card with the defender's agent is secured, every Rival agent a Trophy.
        expect(state.battle?.step).toBe(BattleStep.Ransack)
        const cardId = state.court[0].cardId
        expect(() =>
            session.act(a, ActionType.Ransack, { cardId: state.court[1].cardId })
        ).toThrow()
        session.act(a, ActionType.Ransack, { cardId })
        state = session.hydrated()
        expect(state.getPlayerState(a).trophies.filter((t) => t.kind === TrophyKind.Agent)).toEqual(
            [
                { owner: b, kind: TrophyKind.Agent },
                { owner: c, kind: TrophyKind.Agent },
                { owner: c, kind: TrophyKind.Agent }
            ]
        )
        expect(state.court.map((slot) => slot.cardId)).not.toContain(cardId)
        expect(state.machineState).toBe(MachineState.TakingActions)
    })

    it('damages a fresh building with one hit', () => {
        const { session, players } = battling({ buildingHits: 1 }, (state, [a, b]) => {
            ships(state, '1H', a, 1)
            building(state, '1H', 0, b, BuildingKind.Starport)
        })
        session.act(players[0], ActionType.AssignHits, {
            attacking: noHits,
            defending: noHits,
            buildings: [{ slot: 0, hits: 1 }]
        })
        expect(session.hydrated().system('1H').slots[0]).toMatchObject({ damaged: true })
    })
})

describe('raiding', () => {
    it('spends keys on resource slots and Guild cards', () => {
        const { session, players } = battling(
            { step: BattleStep.Raid, keys: 4 },
            (state, [a, b]) => {
                ships(state, '1H', a, 1)
                player(state, b).resources = [
                    Resource.Fuel,
                    Resource.Weapon,
                    null,
                    null,
                    null,
                    null
                ]
                player(state, b).guildCards = ['BC01']
            }
        )
        const [a, b] = players
        const [raid] = session.act(a, ActionType.Raid, { slot: 1 })
        expect(raid).toMatchObject({ metadata: { resource: Resource.Weapon } })
        let state = session.hydrated()
        expect(state.battle?.keys).toBe(3)
        expect(state.getPlayerState(a).resources[0]).toBe(Resource.Weapon)
        expect(state.getPlayerState(b).resources[1]).toBeNull()
        session.act(a, ActionType.Raid, { slot: 0 })
        state = session.hydrated()
        // Nothing left that the keys can pay for.
        expect(state.battle).toBeUndefined()
        expect(state.machineState).toBe(MachineState.TakingActions)
    })

    it('discards to make room when every open slot is full', () => {
        const { session, players } = battling(
            { step: BattleStep.Raid, keys: 2 },
            (state, [a, b]) => {
                ships(state, '1H', a, 1)
                player(state, a).resources = [Resource.Fuel, Resource.Fuel, null, null, null, null]
                player(state, a).citiesOnBoard = 5
                player(state, b).resources = [
                    null,
                    Resource.Relic,
                    Resource.Psionic,
                    null,
                    null,
                    null
                ]
            }
        )
        const [a] = players
        expect(() => session.act(a, ActionType.Raid, { slot: 1 })).toThrow()
        session.act(a, ActionType.Raid, { slot: 1, discard: Resource.Fuel })
        expect(session.hydrated().getPlayerState(a).resources.slice(0, 2)).toEqual([
            Resource.Fuel,
            Resource.Relic
        ])
        // The stolen resource itself can be the one discarded.
        session.act(a, ActionType.Raid, { slot: 2, discard: Resource.Psionic })
        expect(session.hydrated().getPlayerState(a).resources.slice(0, 2)).toEqual([
            Resource.Fuel,
            Resource.Relic
        ])
    })

    it('needs an attacking ship left after the hits', () => {
        const { session, players } = battling({ attackerHits: 1, keys: 3 }, (state, [a, b]) => {
            ships(state, '1H', a, 0, 1)
            ships(state, '1H', b, 1)
            player(state, b).resources = [Resource.Fuel, null, null, null, null, null]
        })
        session.act(players[0], ActionType.AssignHits, {
            attacking: { damage: 0, destroy: 1 },
            defending: noHits,
            buildings: []
        })
        expect(session.state.battle).toBeUndefined()
    })

    it('can stop with keys unspent', () => {
        const { session, players } = battling(
            { step: BattleStep.Raid, keys: 3 },
            (state, [a, b]) => {
                ships(state, '1H', a, 1)
                player(state, b).resources = [Resource.Fuel, null, null, null, null, null]
            }
        )
        session.act(players[0], ActionType.EndBattle)
        expect(session.state.battle).toBeUndefined()
        expect(session.state.machineState).toBe(MachineState.TakingActions)
    })
})

describe('elimination', () => {
    it('returns 3 ships to a gate at the end of the turn of a player with nothing on the map', () => {
        const { session, players } = leading()
        const [a] = players
        expect(() => session.act(a, ActionType.EndTurn)).toThrow()
        expect(() => session.act(a, ActionType.EndTurn, { returnTo: '1H' })).toThrow()
        session.act(a, ActionType.EndTurn, { returnTo: '2G' })
        expect(session.hydrated().system('2G').ships[a]).toEqual({ fresh: 3, damaged: 0 })
    })
})

describe('Court cards in battle', () => {
    it('Gatekeepers collect 2 more dice in a gate', () => {
        const { session, players } = leading((state, [a, b]) => {
            ships(state, '1G', a, 1)
            ships(state, '1G', b, 1)
            ships(state, '1H', a, 1)
            ships(state, '1H', b, 1)
            player(state, a).guildCards = [Court.Gatekeepers]
        })
        const [a, b] = players
        const three = { [Die.Assault]: 3, [Die.Skirmish]: 0, [Die.Raid]: 0 }
        expect(session.hydrated().canBattle(a, '1G', b, three)).toBe(true)
        expect(session.hydrated().canBattle(a, '1H', b, three)).toBe(false)
    })

    it('Skirmishers reroll skirmish dice, up to the Weapon icons, once', () => {
        const { session, players } = leading((state, [a, b]) => {
            ships(state, '1H', a, 3)
            ships(state, '1H', b, 1)
            player(state, a).guildCards = [Court.Skirmishers]
            player(state, a).resources = [Resource.Weapon, null, null, null, null, null]
        })
        const [a, b] = players
        session.act(a, ActionType.Battle, {
            system: '1H',
            defender: b,
            dice: { [Die.Assault]: 1, [Die.Skirmish]: 2, [Die.Raid]: 0 },
            revealsInfo: true
        })
        // A Weapon resource and the Skirmishers card itself.
        expect(session.state.battle?.rerolls).toEqual({ ...noRerolls(), [Die.Skirmish]: 2 })
        expect(() => session.act(a, ActionType.Reroll, { dice: [0], revealsInfo: true })).toThrow()
        const [reroll] = session.act(a, ActionType.Reroll, { dice: [1, 2], revealsInfo: true })
        expect(reroll).toMatchObject({ metadata: { rolled: expect.any(Array) } })
        expect(session.state.battle?.rerolls ?? noRerolls()).toEqual(noRerolls())
    })

    it('Sworn Guardians protect everything else, and are buried when stolen', () => {
        const { session, players } = battling(
            { step: BattleStep.Raid, keys: 3 },
            (state, [a, b]) => {
                ships(state, '1H', a, 1)
                player(state, b).resources = [null, Resource.Fuel, null, null, null, null]
                player(state, b).guildCards = [Court.SwornGuardians]
            }
        )
        const [a, b] = players
        expect(() => session.act(a, ActionType.Raid, { slot: 1 })).toThrow()
        session.act(a, ActionType.Raid, { cardId: Court.SwornGuardians })
        let state = session.hydrated()
        expect(state.getPlayerState(a).guildCards).toEqual([])
        expect(state.getPlayerState(b).guildCards).toEqual([])
        session.act(a, ActionType.Raid, { slot: 1 })
        state = session.hydrated()
        expect(state.getPlayerState(a).resources[0]).toBe(Resource.Fuel)
    })
})
