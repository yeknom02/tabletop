import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { PlayKind } from '../model/round.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'
import { startTestGame, type TestSession } from '../util/testHelper.js'

// Deals chosen hands, in turn order from the initiative.
function withHands(session: TestSession, hands: string[][]) {
    session.edit((state) => {
        const all = state.players.flatMap((player) => player.hand ?? [])
        state.turnManager.turnOrder.forEach((playerId, seat) => {
            const player = state.players.find((candidate) => candidate.playerId === playerId)
            if (player) {
                player.hand = hands[seat] ?? []
                player.handCount = player.hand.length
            }
        })
        const used = new Set(hands.flat())
        state.actionDiscard.items = [
            ...state.actionDiscard.items,
            ...all.filter((card) => !used.has(card))
        ].filter((card) => !used.has(card))
        state.actionDiscard.remaining = state.actionDiscard.items.length
    })
}

function endTurn(session: TestSession) {
    session.act(session.currentPlayerId(), ActionType.EndTurn)
}

describe('a round', () => {
    it('lets the leader declare the lead card’s ambition, zeroing its number', () => {
        const session = startTestGame(3)
        withHands(session, [['construction-4'], ['construction-3'], ['construction-5']])
        const [a, b, c] = session.state.turnManager.turnOrder
        session.act(a, ActionType.LeadCard, { cardId: 'construction-4', declare: Ambition.Warlord })
        const state = session.hydrated()
        expect(state.ambitionMarkers[0].ambition).toBe(Ambition.Warlord)
        expect(state.leadNumber()).toBe(0)
        expect(state.turn?.pips).toBe(3)
        endTurn(session)
        // Zeroed, so even a 3 Surpasses.
        expect(session.currentPlayerId()).toBe(b)
        session.act(b, ActionType.FollowCard, {
            cardId: 'construction-3',
            playKind: PlayKind.Surpass
        })
        expect(session.hydrated().turn?.pips).toBe(3)
        endTurn(session)
        session.act(c, ActionType.FollowCard, {
            cardId: 'construction-5',
            playKind: PlayKind.Surpass
        })
        endTurn(session)
        // The highest Surpass takes the initiative.
        expect(session.state.initiative).toBe(c)
    })

    it('refuses an ambition the card doesn’t show', () => {
        const session = startTestGame(3)
        withHands(session, [
            ['construction-4', 'aggression-2'],
            ['construction-3'],
            ['construction-5']
        ])
        const [a] = session.state.turnManager.turnOrder
        expect(() =>
            session.act(a, ActionType.LeadCard, {
                cardId: 'construction-4',
                declare: Ambition.Tycoon
            })
        ).toThrow()
    })

    it('gives Copy and Pivot one action and leaves the initiative alone', () => {
        const session = startTestGame(3)
        withHands(session, [['construction-4'], ['construction-3'], ['aggression-6']])
        const [a, b, c] = session.state.turnManager.turnOrder
        session.act(a, ActionType.LeadCard, { cardId: 'construction-4' })
        endTurn(session)
        expect(() =>
            session.act(b, ActionType.FollowCard, {
                cardId: 'construction-3',
                playKind: PlayKind.Surpass
            })
        ).toThrow()
        session.act(b, ActionType.FollowCard, { cardId: 'construction-3', playKind: PlayKind.Copy })
        expect(session.hydrated().turn?.pips).toBe(1)
        endTurn(session)
        session.act(c, ActionType.FollowCard, { cardId: 'aggression-6', playKind: PlayKind.Pivot })
        expect(session.hydrated().turn?.pips).toBe(1)
        endTurn(session)
        expect(session.state.initiative).toBe(a)
    })

    it('lets a player seize the initiative with an extra face-down card', () => {
        const session = startTestGame(3)
        withHands(session, [
            ['construction-4', 'construction-2'],
            // A card left over, or an empty hand would pass the seized initiative straight on.
            ['construction-3', 'mobilization-2', 'mobilization-3'],
            ['construction-6', 'administration-3']
        ])
        const [a, b, c] = session.state.turnManager.turnOrder
        session.act(a, ActionType.LeadCard, { cardId: 'construction-4' })
        endTurn(session)
        session.act(b, ActionType.FollowCard, {
            cardId: 'construction-3',
            playKind: PlayKind.Copy,
            seizeWith: 'mobilization-2'
        })
        endTurn(session)
        // Nobody else can seize this round.
        expect(() =>
            session.act(c, ActionType.FollowCard, {
                cardId: 'construction-6',
                playKind: PlayKind.Surpass,
                seizeWith: 'administration-3'
            })
        ).toThrow()
        session.act(c, ActionType.FollowCard, {
            cardId: 'construction-6',
            playKind: PlayKind.Surpass
        })
        endTurn(session)
        expect(session.state.initiative).toBe(b)
        expect(session.state.round.leader).toBe(b)
    })

    it('ends the round when the initiative is passed, and the chapter when everyone passes', () => {
        const session = startTestGame(3)
        withHands(session, [['construction-4'], ['construction-3'], ['construction-5']])
        const [a, b, c] = session.state.turnManager.turnOrder
        session.act(a, ActionType.PassInitiative)
        expect(session.state.initiative).toBe(b)
        expect(session.currentPlayerId()).toBe(b)
        session.act(b, ActionType.PassInitiative)
        expect(session.currentPlayerId()).toBe(c)
        session.act(c, ActionType.PassInitiative)
        // Everyone with cards passed in a row: the chapter ends and new hands are dealt.
        const state = session.hydrated()
        expect(state.chapter).toBe(2)
        expect(state.players.every((player) => player.handCount === 6)).toBe(true)
        expect(state.machineState).toBe(MachineState.PlayingCard)
    })

    it('ends the chapter when everyone runs out of cards', () => {
        const session = startTestGame(3)
        withHands(session, [['construction-4'], ['construction-3'], ['construction-5']])
        const [a, b, c] = session.state.turnManager.turnOrder
        session.act(a, ActionType.LeadCard, { cardId: 'construction-4', declare: Ambition.Warlord })
        endTurn(session)
        session.act(b, ActionType.FollowCard, { cardId: 'construction-3', playKind: PlayKind.Copy })
        endTurn(session)
        session.act(c, ActionType.FollowCard, {
            cardId: 'construction-5',
            playKind: PlayKind.Surpass
        })
        const processed = session.act(c, ActionType.EndTurn)
        expect(processed.map((action) => action.type)).toContain(ActionType.EndChapter)
        const state = session.hydrated()
        expect(state.chapter).toBe(2)
        expect(state.initiative).toBe(c)
        // The lowest marker flipped; all are available again.
        expect(state.ambitionMarkers.map((marker) => marker.flipped)).toEqual([false, false, true])
        expect(state.ambitionMarkers.every((marker) => marker.ambition === undefined)).toBe(true)
    })
})
