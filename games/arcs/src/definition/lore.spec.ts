import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Die } from '../components/dice.js'
import { Lore } from '../components/personas.js'
import { Resource } from '../components/resources.js'
import type { ArcsProjectedState } from '../model/gameState.js'
import { BuildingKind, TrophyKind } from '../model/pieces.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import {
    battleFixture,
    leadingOnEmptyBoard,
    playerIn,
    setBuilding,
    setShips,
    type BoardSetup
} from '../util/testHelper.js'

function declare(state: ArcsProjectedState, ambition: Ambition) {
    state.ambitionMarkers[0].ambition = ambition
}

function withLore(lore: Lore, lead: string, setup: BoardSetup = () => {}) {
    return leadingOnEmptyBoard(lead, (state, players) => {
        playerIn(state, players[0]).lore = [lore]
        setup(state, players)
    })
}

describe('lore in battle', () => {
    function rolled(setup: BoardSetup, dice: { die: Die; face: number }[]) {
        const result = leadingOnEmptyBoard('aggression-2', setup)
        const [a, b] = result.players
        const state = result.session.hydrated()
        state.battle = battleFixture(a, b, {
            rolled: dice,
            allFresh: state.system('1H').ships[a]?.damaged === 0
        })
        state.tallyRoll()
        return state
    }

    it('Mirror Plating intercepts any assault roll; Signal Breaker ignores one rolled intercept', () => {
        const mirror = rolled(
            (state, [a, b]) => {
                setShips(state, '1H', a, 2)
                setShips(state, '1H', b, 2)
                playerIn(state, b).lore = [Lore.MirrorPlating]
            },
            [{ die: Die.Assault, face: 0 }]
        )
        expect(mirror.battle?.attackerHits).toBe(2)
        const breaker = rolled(
            (state, [a, b]) => {
                setShips(state, '1H', a, 2)
                setShips(state, '1H', b, 2)
                playerIn(state, a).lore = [Lore.SignalBreaker]
            },
            [{ die: Die.Raid, face: 2 }]
        )
        expect(breaker.battle).toBeUndefined()
    })

    it('Hidden Harbors stops raid dice with a fresh defending starport; Raider Exosuits allow one', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            setShips(state, '1H', a, 3)
            setShips(state, '1H', b, 1)
            setBuilding(state, '1H', 0, b, BuildingKind.Starport)
            setShips(state, '2H', a, 3)
            setShips(state, '2H', b, 1)
            playerIn(state, b).lore = [Lore.HiddenHarbors]
            playerIn(state, a).lore = [Lore.RaiderExosuits]
        })
        const [a, b] = players
        const state = session.hydrated()
        expect(state.raidDiceLimit(a, '1H', b)).toBe(0)
        expect(state.raidDiceLimit(a, '2H', b)).toBe(1)
    })

    it('Ancient Holdings holds a resource raided for 4 keys', () => {
        const { session, players } = withLore(
            Lore.AncientHoldings,
            'aggression-2',
            (state, [a]) => {
                playerIn(state, a).citiesOnBoard = 5
                playerIn(state, a).resources = [
                    Resource.Fuel,
                    Resource.Fuel,
                    null,
                    null,
                    null,
                    null,
                    null
                ]
            }
        )
        const [a] = players
        const player = session.hydrated().getPlayerState(a)
        expect(player.slotCapacity()).toBe(3)
        player.gainResource(Resource.Relic)
        expect(player.resources[6]).toBe(Resource.Relic)
    })
})

describe('Keeper lore while Keeper is declared', () => {
    it('Keeper’s Trust and Solidarity stop some steals', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            declare(state, Ambition.Keeper)
            playerIn(state, a).resources = [Resource.Fuel, null, null, null, null, null]
            playerIn(state, b).lore = [Lore.KeepersTrust, Lore.KeepersSolidarity]
            playerIn(state, b).resources = [Resource.Fuel, Resource.Relic, null, null, null, null]
            playerIn(state, b).guildCards = [Court.RelicFence, Court.ArmsUnion]
        })
        const [a, b] = players
        const state = session.hydrated()
        expect(state.canSteal(a, { playerId: b, slot: 0 })).toBe(false)
        expect(state.canSteal(a, { playerId: b, slot: 1 })).toBe(true)
        expect(state.canSteal(a, { playerId: b, cardId: Court.RelicFence })).toBe(false)
        expect(state.canSteal(a, { playerId: b, cardId: Court.ArmsUnion })).toBe(true)
    })
})

describe('lore Prelude abilities', () => {
    it('Warlord’s Cruelty taxes a city again while Warlord is declared', () => {
        const { session, players } = withLore(
            Lore.WarlordsCruelty,
            'administration-2',
            (state, [a]) => {
                declare(state, Ambition.Warlord)
                setBuilding(state, '1H', 0, a, BuildingKind.City)
            }
        )
        const [a] = players
        session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        expect(session.hydrated().getPlayerState(a).resourceCount(Resource.Material)).toBe(2)
    })

    it('a lore card can be discarded to clear its Outrage', () => {
        const { session, players } = withLore(
            Lore.TycoonsCharm,
            'administration-2',
            (state, [a]) => {
                playerIn(state, a).outrage = [Resource.Fuel, Resource.Relic]
            }
        )
        const [a] = players
        session.act(a, ActionType.UseLore, { cardId: Lore.TycoonsCharm, clear: true })
        const player = session.hydrated().getPlayerState(a)
        expect(player.outrage).toEqual([Resource.Relic])
        expect(player.lore).toEqual([])
    })

    it('Tycoon’s Charm trades Material or Fuel for any resource', () => {
        const { session, players } = withLore(
            Lore.TycoonsCharm,
            'administration-2',
            (state, [a]) => {
                declare(state, Ambition.Tycoon)
                playerIn(state, a).resources = [Resource.Fuel, null, null, null, null, null]
            }
        )
        const [a] = players
        session.act(a, ActionType.UseLore, {
            cardId: Lore.TycoonsCharm,
            discard: Resource.Fuel,
            gain: Resource.Psionic
        })
        expect(session.hydrated().getPlayerState(a).resources[0]).toBe(Resource.Psionic)
    })

    it('Warlord’s Terror spends Trophies to influence; Tyrant’s Ego spends Captives to secure', () => {
        const { session, players } = withLore(
            Lore.WarlordsTerror,
            'administration-2',
            (state, [a, b]) => {
                declare(state, Ambition.Warlord)
                state.ambitionMarkers[1].ambition = Ambition.Tyrant
                playerIn(state, a).lore = [Lore.WarlordsTerror, Lore.TyrantsEgo]
                playerIn(state, a).trophies = [{ owner: b, kind: TrophyKind.Ship }]
                playerIn(state, b).ships -= 1
                playerIn(state, a).captives = { [b]: 1 }
                playerIn(state, b).agents -= 1
                state.court[1] = { cardId: Court.RelicFence, agents: { [a]: 1 } }
            }
        )
        const [a, b] = players
        const cardId = session.state.court[0].cardId
        session.act(a, ActionType.UseLore, {
            cardId: Lore.WarlordsTerror,
            trophy: { owner: b, kind: TrophyKind.Ship },
            influence: cardId
        })
        let state = session.hydrated()
        expect(state.getPlayerState(a).trophies).toEqual([])
        expect(state.court[0].agents).toEqual({ [a]: 1 })
        session.act(a, ActionType.UseLore, {
            cardId: Lore.TyrantsEgo,
            captive: b,
            secure: Court.RelicFence
        })
        state = session.hydrated()
        expect(state.getPlayerState(a).captives).toEqual({})
        expect(state.getPlayerState(a).guildCards).toEqual([Court.RelicFence])
    })

    it('Tycoon’s Ambition discards Material and Fuel to declare, before any other action', () => {
        const { session, players } = withLore(
            Lore.TycoonsAmbition,
            'administration-1',
            (state, [a]) => {
                declare(state, Ambition.Tycoon)
                playerIn(state, a).resources = [
                    Resource.Fuel,
                    Resource.Relic,
                    null,
                    null,
                    null,
                    null
                ]
            }
        )
        const [a] = players
        expect(() =>
            session.act(a, ActionType.UseLore, {
                cardId: Lore.TycoonsAmbition,
                ambition: Ambition.Tycoon
            })
        ).toThrow()
        session.act(a, ActionType.UseLore, {
            cardId: Lore.TycoonsAmbition,
            ambition: Ambition.Empath
        })
        const state = session.hydrated()
        expect(state.isDeclared(Ambition.Empath)).toBe(true)
        expect(state.getPlayerState(a).resources.slice(0, 2)).toEqual([null, Resource.Relic])
        expect(state.machineState).toBe(MachineState.TakingActions)
    })
})
