import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { Resource } from '../components/resources.js'
import { NewActionName } from '../model/courtEffects.js'
import { BuildingKind, TrophyKind } from '../model/pieces.js'
import { PlayKind } from '../model/round.js'
import { ActionType } from './actions.js'
import {
    leadingOnEmptyBoard,
    playerIn,
    setBuilding,
    setShips,
    startTestGame,
    type BoardSetup
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
        expect(tax).toMatchObject({ metadata: { gained: [] } })
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
            discard: [Resource.Relic]
        })
        expect(tax).toMatchObject({
            metadata: { gained: [Resource.Material], discarded: [Resource.Relic] }
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

describe('Court card Prelude actions', () => {
    function holding(cardId: string, setup: BoardSetup = () => {}, lead = 'construction-2') {
        return leadingOnEmptyBoard(lead, (state, players) => {
            const [a, b, c] = players
            for (const playerId of [a, b, c]) {
                setShips(state, '6H', playerId, 1)
            }
            playerIn(state, a).guildCards = [cardId]
            setup(state, players)
        })
    }

    it('Mining Interest fills the empty slots, stealing once the supply runs out', () => {
        const { session, players } = holding(Court.MiningInterest, (state, [a, b]) => {
            playerIn(state, a).resources = [Resource.Fuel, null, null, null, null, null]
            playerIn(state, b).resources = [Resource.Material, null, null, null, null, null]
            state.supply[Resource.Material] = 1
        })
        const [a, b] = players
        expect(() => session.act(a, ActionType.UseCard, { cardId: Court.MiningInterest })).toThrow()
        session.act(a, ActionType.UseCard, {
            cardId: Court.MiningInterest,
            steal: [{ playerId: b, slot: 0 }]
        })
        const state = session.hydrated()
        expect(state.getPlayerState(a).resources.slice(0, 3)).toEqual([
            Resource.Fuel,
            Resource.Material,
            Resource.Material
        ])
        expect(state.getPlayerState(b).resources[0]).toBeNull()
        expect(state.getPlayerState(a).guildCards).toEqual([])
        expect(state.courtDiscard).toContain(Court.MiningInterest)
    })

    it('a Cartel can be discarded to steal 1 of its resource, or nothing', () => {
        const { session, players } = holding(Court.FuelCartel, (state, [, b]) => {
            playerIn(state, b).resources = [
                Resource.Material,
                Resource.Fuel,
                null,
                null,
                null,
                null
            ]
        })
        const [a, b] = players
        expect(() =>
            session.act(a, ActionType.UseCard, {
                cardId: Court.FuelCartel,
                steal: [{ playerId: b, slot: 0 }]
            })
        ).toThrow()
        session.act(a, ActionType.UseCard, {
            cardId: Court.FuelCartel,
            steal: [{ playerId: b, slot: 1 }]
        })
        expect(session.hydrated().getPlayerState(a).resources[0]).toBe(Resource.Fuel)
    })

    it('a Union takes its face-up played card back to hand at the end of the round', () => {
        const { session, players } = holding(Court.ConstructionUnion)
        const [a, b, c] = players
        session.act(a, ActionType.UseCard, {
            cardId: Court.ConstructionUnion,
            actionCardId: 'construction-2'
        })
        expect(session.state.round.unions).toHaveLength(1)
        session.act(a, ActionType.EndTurn)
        for (const playerId of [b, c]) {
            session.act(playerId, ActionType.FollowCard, {
                cardId: 'mobilization-2',
                playKind: PlayKind.Pivot
            })
            session.act(playerId, ActionType.EndTurn)
        }
        const state = session.hydrated()
        expect(state.getPlayerState(a).hand).toEqual(['construction-2'])
        expect(state.courtDiscard).toContain(Court.ConstructionUnion)
    })

    it('Prison Wardens place 3 ships in a system the player controls', () => {
        const { session, players } = holding(Court.PrisonWardens, (state, [a, b]) => {
            setShips(state, '2A', a, 2)
            setShips(state, '2A', b, 1)
            setShips(state, '3A', b, 1)
        })
        const [a] = players
        expect(() =>
            session.act(a, ActionType.UseCard, { cardId: Court.PrisonWardens, system: '3A' })
        ).toThrow()
        session.act(a, ActionType.UseCard, { cardId: Court.PrisonWardens, system: '2A' })
        expect(session.hydrated().system('2A').ships[a]).toEqual({ fresh: 5, damaged: 0 })
    })

    it('Gatekeepers place a ship in every gate in play', () => {
        const { session, players } = holding(Court.Gatekeepers)
        session.act(players[0], ActionType.UseCard, { cardId: Court.Gatekeepers })
        const state = session.hydrated()
        const gates = state.systems.filter((system) => system.id.endsWith('G'))
        expect(gates.every((gate) => gate.ships[players[0]]?.fresh === 1)).toBe(true)
    })

    it('Lattice Spies seize the initiative, but only before any other action', () => {
        const late = holding(Court.LatticeSpies, () => {}, 'mobilization-2')
        const [a] = late.players
        late.session.act(a, ActionType.Influence, { cardId: late.session.state.court[0].cardId })
        expect(() =>
            late.session.act(a, ActionType.UseCard, { cardId: Court.LatticeSpies })
        ).toThrow()
        // The leader holds the initiative already, so a follower uses it.
        const { session, players } = leadingOnEmptyBoard('construction-2', (state, [x, y]) => {
            setShips(state, '6H', x, 1)
            playerIn(state, y).guildCards = [Court.LatticeSpies]
        })
        const [leader, follower] = players
        session.act(leader, ActionType.EndTurn)
        session.act(follower, ActionType.FollowCard, {
            cardId: 'mobilization-2',
            playKind: PlayKind.Pivot
        })
        const [use] = session.act(follower, ActionType.UseCard, { cardId: Court.LatticeSpies })
        expect(use).toMatchObject({ metadata: { seized: true } })
        expect(session.state.round.seizedBy).toBe(follower)
    })

    it('Silver-Tongues steal a Guild card', () => {
        const { session, players } = holding(Court.SilverTongues, (state, [, b]) => {
            playerIn(state, b).guildCards = [Court.RelicFence]
        })
        const [a, b] = players
        session.act(a, ActionType.UseCard, {
            cardId: Court.SilverTongues,
            steal: [{ playerId: b, cardId: Court.RelicFence }]
        })
        const state = session.hydrated()
        expect(state.getPlayerState(a).guildCards).toEqual([Court.RelicFence])
        expect(state.getPlayerState(b).guildCards).toEqual([])
    })

    it('Elder Broker gains Material, Fuel and a Weapon, discarding what can’t be held', () => {
        const { session, players } = holding(Court.ElderBroker, (state, [a]) => {
            playerIn(state, a).citiesOnBoard = 5
            playerIn(state, a).resources = [Resource.Relic, null, null, null, null, null]
        })
        const [a] = players
        expect(() => session.act(a, ActionType.UseCard, { cardId: Court.ElderBroker })).toThrow()
        session.act(a, ActionType.UseCard, {
            cardId: Court.ElderBroker,
            discard: [Resource.Relic, Resource.Material]
        })
        expect(session.hydrated().getPlayerState(a).resources.slice(0, 2)).toEqual([
            Resource.Fuel,
            Resource.Weapon
        ])
    })

    it('Relic Fence trades a resource for a Relic once per turn, and is kept', () => {
        const { session, players } = holding(Court.RelicFence, (state, [a]) => {
            playerIn(state, a).resources = [Resource.Fuel, Resource.Fuel, null, null, null, null]
        })
        const [a] = players
        const use = { cardId: Court.RelicFence, discard: [Resource.Fuel] }
        session.act(a, ActionType.UseCard, use)
        expect(() => session.act(a, ActionType.UseCard, use)).toThrow()
        const player = session.hydrated().getPlayerState(a)
        expect(player.resources.slice(0, 2)).toEqual([Resource.Fuel, Resource.Relic])
        expect(player.guildCards).toEqual([Court.RelicFence])
    })

    it('can’t be used in the Prelude the card was secured in', () => {
        const { session, players } = holding(Court.RelicFence, (state, [a]) => {
            playerIn(state, a).guildCards = []
            playerIn(state, a).resources = [Resource.Fuel, Resource.Relic, null, null, null, null]
            state.court[0] = { cardId: Court.RelicFence, agents: { [a]: 1 } }
            playerIn(state, a).agents -= 1
        })
        const [a] = players
        session.act(a, ActionType.Secure, { cardId: Court.RelicFence, via: Resource.Relic })
        expect(() =>
            session.act(a, ActionType.UseCard, {
                cardId: Court.RelicFence,
                discard: [Resource.Fuel]
            })
        ).toThrow()
    })

    it('Farseers swap cards from hand for cards from the bottom of the action discard pile', () => {
        const { session, players } = holding(Court.Farseers)
        const [a] = players
        session.edit((state) => {
            playerIn(state, a).hand = ['aggression-4']
            playerIn(state, a).handCount = 1
        })
        const pile = session.state.actionDiscard.remaining
        const bottom = session.state.actionDiscard.items.slice(0, 2)
        session.act(a, ActionType.UseFarseers, { discards: ['aggression-4'], revealsInfo: true })
        const state = session.hydrated()
        expect(state.getPlayerState(a).hand).toEqual(bottom)
        expect(state.actionDiscard.remaining).toBe(pile - 1)
        expect(state.courtDiscard).toContain(Court.Farseers)
    })
})

describe('new actions', () => {
    function holding(cardId: string, lead: string, setup: BoardSetup = () => {}) {
        return leadingOnEmptyBoard(lead, (state, players) => {
            playerIn(state, players[0]).guildCards = [cardId]
            setup(state, players)
        })
    }

    it('Manufacture builds a Material instead of a building', () => {
        const { session, players } = holding(Court.MiningInterest, 'construction-2')
        const [a] = players
        const [action] = session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Manufacture
        })
        expect(action).toMatchObject({ metadata: { gained: [Resource.Material] } })
        expect(session.state.turn?.pips).toBe(3)
        // Mobilization can't build.
        const moving = holding(Court.MiningInterest, 'mobilization-2')
        expect(() =>
            moving.session.act(moving.players[0], ActionType.TakeNewAction, {
                name: NewActionName.Manufacture
            })
        ).toThrow()
    })

    it('Pressgang returns Captives for resources; Execute makes them Trophies', () => {
        const { session, players } = holding(
            Court.PrisonWardens,
            'construction-2',
            (state, [a, b]) => {
                playerIn(state, a).captives = { [b]: 3 }
                playerIn(state, b).agents -= 3
            }
        )
        const [a, b] = players
        const agents = session.hydrated().getPlayerState(b).agents
        session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Pressgang,
            captives: { [b]: 2 },
            gains: [Resource.Psionic, Resource.Relic]
        })
        let state = session.hydrated()
        expect(state.getPlayerState(a).captives).toEqual({ [b]: 1 })
        expect(state.getPlayerState(b).agents).toBe(agents + 2)
        expect(state.getPlayerState(a).resources.slice(0, 2)).toEqual([
            Resource.Psionic,
            Resource.Relic
        ])
        // Execute replaces Influence, which Administration has.
        const influencing = holding(Court.PrisonWardens, 'administration-2', (draft, [x, y]) => {
            playerIn(draft, x).captives = { [y]: 2 }
        })
        const [x, y] = influencing.players
        influencing.session.act(x, ActionType.TakeNewAction, {
            name: NewActionName.Execute,
            captives: { [y]: 2 }
        })
        state = influencing.session.hydrated()
        expect(state.getPlayerState(x).captives).toEqual({})
        expect(state.getPlayerState(x).trophies).toEqual([
            { owner: y, kind: TrophyKind.Agent },
            { owner: y, kind: TrophyKind.Agent }
        ])
    })

    it('Abduct captures the Rival agents on a Court card with fewer than the Weapon icons', () => {
        const { session, players } = holding(
            Court.CourtEnforcers,
            'aggression-2',
            (state, [a, b, c]) => {
                playerIn(state, a).resources = [Resource.Weapon, null, null, null, null, null]
                state.court[0].agents = { [a]: 1, [b]: 1 }
                state.court[1].agents = { [b]: 1, [c]: 1 }
            }
        )
        const [a, b] = players
        // Two Weapon icons: the resource and Court Enforcers.
        expect(() =>
            session.act(a, ActionType.TakeNewAction, {
                name: NewActionName.Abduct,
                courtCardId: session.state.court[1].cardId
            })
        ).toThrow()
        session.act(a, ActionType.TakeNewAction, {
            name: NewActionName.Abduct,
            courtCardId: session.state.court[0].cardId
        })
        expect(session.state.court[0].agents).toEqual({ [a]: 1 })
        expect(session.hydrated().getPlayerState(a).captives).toEqual({ [b]: 1 })
    })

    it('Trade swaps resources with a Rival whose city the player controls', () => {
        const { session, players } = holding(
            Court.ElderBroker,
            'administration-2',
            (state, [a, b]) => {
                // 1H is a Material planet.
                setBuilding(state, '1H', 0, b, BuildingKind.City)
                setShips(state, '1H', a, 1)
                playerIn(state, a).resources = [Resource.Psionic, null, null, null, null, null]
                playerIn(state, b).resources = [
                    Resource.Material,
                    Resource.Psionic,
                    null,
                    null,
                    null,
                    null
                ]
            }
        )
        const [a, b] = players
        const trade = { name: NewActionName.Trade, system: '1H', slot: 0, give: Resource.Psionic }
        // They already have Psionic.
        expect(() => session.act(a, ActionType.TakeNewAction, trade)).toThrow()
        session.edit((state) => {
            playerIn(state, a).resources[1] = Resource.Weapon
        })
        session.act(a, ActionType.TakeNewAction, { ...trade, give: Resource.Weapon })
        const state = session.hydrated()
        expect(state.getPlayerState(a).resourceCount(Resource.Material)).toBe(1)
        expect(state.getPlayerState(b).resourceCount(Resource.Weapon)).toBe(1)
        expect(state.getPlayerState(b).resourceCount(Resource.Material)).toBe(0)
    })
})

describe('Vox cards when secured', () => {
    function securing(cardId: string, setup: BoardSetup = () => {}) {
        return leadingOnEmptyBoard('aggression-2', (state, players) => {
            const [a] = players
            state.court[0] = { cardId, agents: { [a]: 1 } }
            playerIn(state, a).agents -= 1
            setup(state, players)
        })
    }

    it('take no choices for a Guild card', () => {
        const { session, players } = securing(Court.RelicFence)
        expect(() =>
            session.act(players[0], ActionType.Secure, {
                cardId: Court.RelicFence,
                vox: { cluster: 2 }
            })
        ).toThrow()
    })

    it('Mass Uprising places a ship in each system of a cluster', () => {
        const { session, players } = securing(Court.MassUprising)
        const [a] = players
        session.act(a, ActionType.Secure, { cardId: Court.MassUprising, vox: { cluster: 2 } })
        const state = session.hydrated()
        for (const id of ['2G', '2A', '2C', '2H'] as const) {
            expect(state.system(id).ships[a]).toEqual({ fresh: 1, damaged: 0 })
        }
        expect(state.courtDiscard).toContain(Court.MassUprising)
        expect(state.court[0].cardId).not.toBe(Court.MassUprising)
    })

    it('Populist Demands declares an ambition without the zero marker', () => {
        const { session, players } = securing(Court.PopulistDemands)
        session.act(players[0], ActionType.Secure, {
            cardId: Court.PopulistDemands,
            vox: { ambition: Ambition.Warlord }
        })
        const state = session.hydrated()
        expect(state.ambitionMarkers.some((marker) => marker.ambition === Ambition.Warlord)).toBe(
            true
        )
        expect(state.leadNumber()).toBe(2)
    })

    it('Outrage Spreads Outrages everyone', () => {
        const { session, players } = securing(Court.OutrageSpreads)
        session.act(players[0], ActionType.Secure, {
            cardId: Court.OutrageSpreads,
            vox: { outrage: Resource.Relic }
        })
        expect(
            session.hydrated().players.every((player) => player.outrage.includes(Resource.Relic))
        ).toBe(true)
    })

    it('Song of Freedom returns a controlled city and may seize, then rejoins the Court deck', () => {
        const { session, players } = leadingOnEmptyBoard('construction-2', (state, [a, b]) => {
            setShips(state, '6H', a, 1)
            setBuilding(state, '1H', 0, a, BuildingKind.City)
            setShips(state, '1H', b, 1)
            state.court[0] = { cardId: Court.SongOfFreedom, agents: { [b]: 1 } }
            playerIn(state, b).hand = ['aggression-3']
        })
        const [a, b] = players
        session.act(a, ActionType.EndTurn)
        session.act(b, ActionType.FollowCard, { cardId: 'aggression-3', playKind: PlayKind.Pivot })
        const deck = session.state.courtDeck.remaining
        const cities = session.hydrated().getPlayerState(a).citiesOnBoard
        session.act(b, ActionType.Secure, {
            cardId: Court.SongOfFreedom,
            vox: { city: { system: '1H', slot: 0 }, seize: true }
        })
        const state = session.hydrated()
        expect(state.system('1H').slots[0]).toBeNull()
        expect(state.getPlayerState(a).citiesOnBoard).toBe(cities + 1)
        expect(state.round.seizedBy).toBe(b)
        // Back into the deck, and one card drawn to refill the Court.
        expect(state.courtDeck.remaining).toBe(deck)
        expect(state.courtDiscard).not.toContain(Court.SongOfFreedom)
    })

    it('Guild Struggle steals a Guild card and shuffles discarded Guild cards into the deck', () => {
        const { session, players } = securing(Court.GuildStruggle, (state, [, b]) => {
            playerIn(state, b).guildCards = [Court.Gatekeepers]
            state.courtDiscard = [Court.RelicFence, Court.CallToAction]
        })
        const [a, b] = players
        const deck = session.state.courtDeck.remaining
        session.act(a, ActionType.Secure, {
            cardId: Court.GuildStruggle,
            vox: { steal: { playerId: b, cardId: Court.Gatekeepers } }
        })
        const state = session.hydrated()
        expect(state.getPlayerState(a).guildCards).toEqual([Court.Gatekeepers])
        expect(state.courtDiscard).toEqual([Court.CallToAction, Court.GuildStruggle])
        // Relic Fence joined the deck, and one card left it to refill the Court.
        expect(state.courtDeck.remaining).toBe(deck)
    })

    it('Call to Action draws the bottom action card as a reveal', () => {
        const { session, players } = securing(Court.CallToAction)
        const [a] = players
        const bottom = session.state.actionDiscard.items[0]
        const processed = session.act(a, ActionType.Secure, { cardId: Court.CallToAction })
        expect(processed.map((action) => action.type)).toEqual([
            ActionType.Secure,
            ActionType.DrawActionCard
        ])
        expect(processed[1].revealsInfo).toBe(true)
        expect(session.hydrated().getPlayerState(a).hand).toEqual([bottom])
    })
})
