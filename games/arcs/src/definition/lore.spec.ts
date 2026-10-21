import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Die } from '../components/dice.js'
import { Lore } from '../components/personas.js'
import { Resource } from '../components/resources.js'
import type { ArcsProjectedState } from '../model/gameState.js'
import { NewActionName } from '../model/newActionTypes.js'
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

describe('lore that builds outside slots', () => {
    it('Gate Ports build a starport on a gate, which captures Rivals moving in', () => {
        const { session, players } = withLore(Lore.GatePorts, 'construction-2', (state, [a]) => {
            setShips(state, '2G', a, 2)
        })
        const [a, b] = players
        session.act(a, ActionType.BuildBuilding, { system: '2G', building: BuildingKind.Starport })
        expect(session.hydrated().system('2G').extraBuildings).toEqual([
            { owner: a, kind: BuildingKind.Starport, damaged: false }
        ])
        session.edit((state) => {
            setShips(state, '2A', b, 1)
        })
        const state = session.hydrated()
        const agents = state.getPlayerState(b).agents
        const captured = state.move(b, '2A', ['2G'], { fresh: 1, damaged: 0 }, [])
        expect(captured).toEqual({ [a]: 1 })
        expect(state.getPlayerState(b).agents).toBe(agents - 1)
    })

    it('Cloud Cities build a city beside full slots, for a resource of the planet type', () => {
        const { session, players } = withLore(
            Lore.CloudCities,
            'construction-2',
            (state, [a, b]) => {
                setShips(state, '1H', a, 1)
                setBuilding(state, '1H', 0, b, BuildingKind.City)
                setBuilding(state, '1H', 1, b, BuildingKind.Starport)
                playerIn(state, a).resources = [Resource.Material, null, null, null, null, null]
            }
        )
        const [a] = players
        session.act(a, ActionType.BuildBuilding, { system: '1H', building: BuildingKind.City })
        const state = session.hydrated()
        expect(state.system('1H').extraBuildings).toHaveLength(1)
        expect(state.getPlayerState(a).resourceCount(Resource.Material)).toBe(0)
    })

    it('a Gate Station city taxes as any city type in its cluster', () => {
        const { session, players } = withLore(
            Lore.GateStations,
            'administration-2',
            (state, [a, b]) => {
                const gate = state.systems.find((system) => system.id === '1G')
                gate?.extraBuildings.push({ owner: a, kind: BuildingKind.City, damaged: false })
                // 1H is Material, 1A Weapon.
                setBuilding(state, '1H', 0, b, BuildingKind.City)
                setBuilding(state, '1A', 0, b, BuildingKind.City)
            }
        )
        const [a] = players
        const state = session.hydrated()
        expect(state.cityTypes('1G').toSorted()).toEqual([Resource.Material, Resource.Weapon])
        expect(() => session.act(a, ActionType.Tax, { system: '1G', slot: 0 })).toThrow()
        const [tax] = session.act(a, ActionType.Tax, {
            system: '1G',
            slot: 0,
            cityType: Resource.Weapon
        })
        expect(tax).toMatchObject({ metadata: { gained: [Resource.Weapon] } })
    })
})

describe('lore while Empath is declared', () => {
    it('Empath’s Bond taxes any city without Captives, and builds at any starport', () => {
        const { session, players } = withLore(
            Lore.EmpathsBond,
            'administration-2',
            (state, [, b]) => {
                declare(state, Ambition.Empath)
                setBuilding(state, '1H', 0, b, BuildingKind.City)
                setBuilding(state, '1H', 1, b, BuildingKind.Starport)
            }
        )
        const [a] = players
        const [tax] = session.act(a, ActionType.Tax, { system: '1H', slot: 0 })
        expect(tax).not.toHaveProperty('metadata.captured')
        expect(session.hydrated().canBuildShip(a, '1H', 1)).toBe(true)
    })
})

describe('lore that moves', () => {
    it('Sprinter Drives move fresh ships that just moved once more', () => {
        const { session, players } = withLore(
            Lore.SprinterDrives,
            'mobilization-2',
            (state, [a]) => {
                setShips(state, '1H', a, 2, 1)
            }
        )
        const [a] = players
        session.act(a, ActionType.MoveShips, {
            from: '1H',
            path: ['1G'],
            fresh: 2,
            damaged: 1,
            dropOffs: [],
            sprint: { from: '1G', path: ['2G'], fresh: 2, dropOffs: [] }
        })
        const state = session.hydrated()
        expect(state.system('1G').ships[a]).toEqual({ fresh: 0, damaged: 1 })
        expect(state.system('2G').ships[a]).toEqual({ fresh: 2, damaged: 0 })
    })

    it('Force Beams guide any ships next to a fresh Loyal starport', () => {
        const { session, players } = withLore(
            Lore.ForceBeams,
            'mobilization-2',
            (state, [a, b]) => {
                setBuilding(state, '1H', 0, a, BuildingKind.Starport)
                setShips(state, '1H', b, 3)
            }
        )
        const [a, b] = players
        session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Guide,
            system: '1H',
            to: '1G',
            ships: { [b]: { fresh: 2, damaged: 0 } }
        })
        const state = session.hydrated()
        expect(state.system('1G').ships[b]).toEqual({ fresh: 2, damaged: 0 })
    })

    it('Survival Overrides destroy a fresh Loyal ship to destroy a Rival one, as a Trophy', () => {
        const { session, players } = withLore(
            Lore.SurvivalOverrides,
            'mobilization-2',
            (state, [a, b]) => {
                setShips(state, '1H', a, 1)
                setShips(state, '1H', b, 1)
            }
        )
        const [a, b] = players
        session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Martyr,
            system: '1H',
            target: b
        })
        const state = session.hydrated()
        expect(state.system('1H').ships).toEqual({})
        expect(state.getPlayerState(a).trophies).toEqual([{ owner: b, kind: TrophyKind.Ship }])
    })
})

describe('lore that builds', () => {
    it('Tool-Priests summon a ship at a city the player controls, once a turn', () => {
        const { session, players } = withLore(
            Lore.ToolPriests,
            'construction-2',
            (state, [a, b]) => {
                setBuilding(state, '1H', 0, b, BuildingKind.City)
                setShips(state, '1H', a, 1)
            }
        )
        const [a] = players
        const summon = { name: NewActionName.Summon, system: '1H', slot: 0 }
        session.act(a, ActionType.TakeNewAction, summon)
        expect(session.hydrated().system('1H').ships[a]).toEqual({ fresh: 2, damaged: 0 })
        expect(() => session.act(a, ActionType.TakeNewAction, summon)).toThrow()
    })

    it('Living Structures prune a starport into a city', () => {
        const { session, players } = withLore(
            Lore.LivingStructures,
            'administration-2',
            (state, [a]) => {
                setBuilding(state, '1H', 0, a, BuildingKind.Starport, true)
            }
        )
        const [a] = players
        const before = session.hydrated().getPlayerState(a)
        session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Prune,
            system: '1H',
            slot: 0
        })
        const state = session.hydrated()
        expect(state.system('1H').slots[0]).toEqual({
            owner: a,
            kind: BuildingKind.City,
            damaged: true
        })
        expect(state.getPlayerState(a).starports).toBe(before.starports + 1)
        expect(state.getPlayerState(a).citiesOnBoard).toBe(before.citiesOnBoard - 1)
    })

    it('Tyrant’s Authority annexes a controlled Rival building while Tyrant is declared', () => {
        const { session, players } = withLore(
            Lore.TyrantsAuthority,
            'construction-2',
            (state, [a, b]) => {
                declare(state, Ambition.Tyrant)
                setShips(state, '1H', a, 1)
                setBuilding(state, '1H', 0, b, BuildingKind.Starport)
            }
        )
        const [a, b] = players
        const rivalStarports = session.hydrated().getPlayerState(b).starports
        session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Annex,
            system: '1H',
            slot: 0
        })
        const state = session.hydrated()
        expect(state.system('1H').slots[0]?.owner).toBe(a)
        expect(state.getPlayerState(b).starports).toBe(rivalStarports + 1)
    })
})

describe('lore before the dice', () => {
    const one = { [Die.Assault]: 1, [Die.Skirmish]: 0, [Die.Raid]: 0 }

    it('Railgun Arrays hit an attacking ship of the attacker’s choosing first', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            setShips(state, '1H', a, 1, 1)
            setShips(state, '1H', b, 1)
            playerIn(state, b).lore = [Lore.RailgunArrays]
        })
        const [a, b] = players
        expect(session.hydrated().canBattle(a, '1H', b, one)).toBe(false)
        session.act(a, ActionType.Battle, {
            system: '1H',
            defender: b,
            dice: one,
            railgun: 'damaged',
            revealsInfo: true
        })
        expect(session.hydrated().getPlayerState(b).trophies).toEqual([
            { owner: a, kind: TrophyKind.Ship }
        ])
    })

    it('Predictive Sensors let the defender move ships in before the dice are collected', () => {
        const { session, players } = leadingOnEmptyBoard('aggression-2', (state, [a, b]) => {
            setShips(state, '1H', a, 2)
            setShips(state, '1H', b, 1)
            setShips(state, '1G', b, 2)
            playerIn(state, b).lore = [Lore.PredictiveSensors]
        })
        const [a, b] = players
        session.act(a, ActionType.Battle, { system: '1H', defender: b })
        expect(session.state.activePlayerIds).toEqual([b])
        session.act(b, ActionType.MoveInBySensors, { moves: [{ from: '1G', fresh: 2 }] })
        expect(session.hydrated().system('1H').ships[b]).toEqual({ fresh: 3, damaged: 0 })
        expect(session.state.activePlayerIds).toEqual([a])
        const [roll] = session.act(a, ActionType.RollDice, { dice: one, revealsInfo: true })
        expect(roll).toMatchObject({ metadata: { rolled: expect.any(Array) } })
    })

    it('Galactic Rifles roll skirmish dice at an adjacent system', () => {
        const { session, players } = withLore(
            Lore.GalacticRifles,
            'aggression-2',
            (state, [a, b]) => {
                setShips(state, '1H', a, 3)
                setShips(state, '1G', b, 2)
            }
        )
        const [a, b] = players
        const [fire] = session.act(a, ActionType.FireRifles, {
            system: '1H',
            target: '1G',
            defender: b,
            revealsInfo: true
        })
        expect(fire).toMatchObject({ metadata: { rolled: expect.any(Array) } })
        const battle = session.state.battle
        if (battle) {
            expect(battle.rifles).toBe(true)
            expect(battle.system).toBe('1G')
            expect(battle.rolled.every((die) => die.die === Die.Skirmish)).toBe(true)
        }
    })
})
