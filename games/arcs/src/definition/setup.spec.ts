import { describe, expect, it } from 'vitest'
import { SetupCards } from '../components/setupCards.js'
import { planetOf } from '../components/map.js'
import { shipsOf } from '../model/pieces.js'
import { LeadersAndLore } from './config.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { DraftKind } from '../model/gameState.js'
import { LeaderSetups } from '../components/cardData.js'
import { startTestGame } from '../util/testHelper.js'

describe('setup without leaders or lore', () => {
    it.each([2, 3, 4])('starts %i players where the setup card says', (count) => {
        const session = startTestGame(count)
        const state = session.hydrated()
        const card = SetupCards[state.setupCard ?? '2-frontiers']
        expect(card.players).toBe(count)
        expect(state.outOfPlay).toEqual(card.outOfPlay)
        expect(state.initiative).toBe(state.turnManager.turnOrder[0])
        state.turnManager.turnOrder.forEach((playerId, seat) => {
            const start = card.seats[seat]
            const player = state.getPlayerState(playerId)
            expect(shipsOf(state.system(start.A), playerId).fresh).toBe(3)
            expect(shipsOf(state.system(start.B), playerId).fresh).toBe(3)
            for (const system of start.C) {
                expect(shipsOf(state.system(system), playerId).fresh).toBe(2)
            }
            expect(state.system(start.A).slots).toContainEqual({
                owner: playerId,
                kind: 'city',
                damaged: false
            })
            expect(state.system(start.B).slots).toContainEqual({
                owner: playerId,
                kind: 'starport',
                damaged: false
            })
            expect(player.citiesOnBoard).toBe(4)
            expect(player.starports).toBe(4)
            expect(player.ships).toBe(15 - 6 - 2 * start.C.length)
            expect(player.resources.slice(0, 2)).toEqual([
                planetOf(start.A)?.resource,
                planetOf(start.B)?.resource
            ])
            expect(player.handCount).toBe(6)
        })
        expect(state.court).toHaveLength(count === 2 ? 3 : 4)
        expect(state.courtDeck.count()).toBe(31 - state.court.length)
        const dealt = count === 4 ? 28 : 20
        expect(state.actionDiscard.count()).toBe(dealt - 6 * count)
        expect(state.machineState).toBe(
            count === 2 ? MachineState.Mulligan : MachineState.PlayingCard
        )
    })

    it('puts the out-of-play planets’ resources on the ambitions with two players', () => {
        const state = startTestGame(2).hydrated()
        expect(state.ambitionResources).toHaveLength(6)
        const total = Object.values(state.supply).reduce((sum, count) => sum + count, 0)
        // 25 tokens, less the 6 on the ambitions and the 4 starting resources.
        expect(total).toBe(25 - 6 - 4)
    })

    it('lets the player without initiative redraw with two players', () => {
        const session = startTestGame(2)
        const playerId = session.currentPlayerId()
        expect(playerId).toBe(session.state.turnManager.turnOrder[1])
        const before = session.hand(playerId)
        const [redraw] = session.act(playerId, ActionType.RedrawHand, { revealsInfo: true })
        expect(redraw.revealsInfo).toBe(true)
        expect(session.hand(playerId)).toHaveLength(6)
        expect(session.hand(playerId)).not.toEqual(before)
        expect(session.state.machineState).toBe(MachineState.PlayingCard)
        expect(session.currentPlayerId()).toBe(session.state.initiative)
    })
})

describe('the leaders and lore draft', () => {
    it.each([
        [LeadersAndLore.OneLore, 1],
        [LeadersAndLore.TwoLore, 2],
        [LeadersAndLore.FiveLore, 5]
    ])('with %s lore, drafts in reverse turn order and then deals', (leadersAndLore, lore) => {
        const session = startTestGame(4, { leadersAndLore })
        const state = session.hydrated()
        expect(state.machineState).toBe(MachineState.Drafting)
        expect(state.draft?.leaders).toHaveLength(5)
        expect(state.draft?.lore).toHaveLength(4 * lore + 1)
        expect(state.players.every((player) => player.handCount === 0)).toBe(true)
        const order = state.turnManager.turnOrder
        const pickers: string[] = []
        while (session.state.machineState === MachineState.Drafting) {
            const playerId = session.currentPlayerId()
            pickers.push(playerId)
            const draft = session.hydrated().draft
            const needsLeader = session.hydrated().needsFromDraft(playerId, DraftKind.Leader)
            const cardId = needsLeader ? draft?.leaders[0] : draft?.lore[0]
            const kind = needsLeader ? DraftKind.Leader : DraftKind.Lore
            session.act(playerId, ActionType.DraftCard, { cardId, kind })
        }
        // Starting with the player to the right of the initiative, going counterclockwise.
        expect(pickers.slice(0, 4)).toEqual([...order].reverse())
        expect(pickers).toHaveLength(4 * (1 + lore))
        const after = session.hydrated()
        expect(after.machineState).toBe(MachineState.PlayingCard)
        for (const player of after.players) {
            expect(player.leader).toBeDefined()
            expect(player.lore).toHaveLength(lore)
            expect(player.handCount).toBe(6)
            const setup = LeaderSetups[player.leader ?? '']
            expect(player.resources.slice(0, 2)).toEqual([...setup.resources])
        }
    })

    it('refuses a second leader', () => {
        const session = startTestGame(3, { leadersAndLore: LeadersAndLore.OneLore })
        const playerId = session.currentPlayerId()
        const leaders = session.hydrated().draft?.leaders ?? []
        session.act(playerId, ActionType.DraftCard, { cardId: leaders[0], kind: DraftKind.Leader })
        for (let pick = 0; pick < 2; pick++) {
            const next = session.currentPlayerId()
            const lore = session.hydrated().draft?.lore[0]
            session.act(next, ActionType.DraftCard, { cardId: lore, kind: DraftKind.Lore })
        }
        expect(session.currentPlayerId()).toBe(playerId)
        expect(() =>
            session.act(playerId, ActionType.DraftCard, {
                cardId: session.hydrated().draft?.leaders[0],
                kind: DraftKind.Leader
            })
        ).toThrow()
    })
})
