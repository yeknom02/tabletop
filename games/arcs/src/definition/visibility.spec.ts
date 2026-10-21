import { assert, assertExists, type Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Court } from '../components/courtCards.js'
import { PlayKind } from '../model/round.js'
import { ArcsGameStateValidator, type ArcsProjectedState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { LeadersAndLore } from './config.js'
import { ArcsRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { startTestGame, type TestSession } from '../util/testHelper.js'

function perspectives(state: ArcsProjectedState): Visibility.Perspective[] {
    return [
        { kind: 'spectator' },
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

function project(session: TestSession, perspective: Visibility.Perspective) {
    const state = session.state
    assert(ArcsGameStateValidator.Check(state), 'The test game is canonical')
    return ArcsRuntime.visibility.state.project(state, perspective, {
        config: session.game.config
    })
}

// The second player Copies with one card and seizes with another, both face down.
function copyAndSeize(session: TestSession) {
    const [a, b] = session.state.turnManager.turnOrder
    session.edit((state) => {
        for (const player of state.players) {
            if (player.playerId === a) player.hand = ['construction-4', 'construction-2']
            if (player.playerId === b)
                player.hand = ['mobilization-3', 'aggression-5', 'construction-6']
            player.handCount = player.hand?.length ?? 0
        }
    })
    session.act(a, ActionType.LeadCard, { cardId: 'construction-4' })
    session.act(a, ActionType.EndTurn)
    return session.act(b, ActionType.FollowCard, {
        cardId: 'mobilization-3',
        playKind: PlayKind.Copy,
        seizeWith: 'aggression-5'
    })[0]
}

describe.each([2, 3, 4])('what each Perspective sees with %i players', (count) => {
    it('shows each player only their own hand, and nobody the decks', () => {
        const session = startTestGame(count)
        for (const perspective of perspectives(session.state)) {
            const view = project(session, perspective)
            for (const player of view.players) {
                const own =
                    perspective.kind === 'player' && perspective.playerId === player.playerId
                expect(player.hand !== undefined).toBe(own)
                expect(player.handCount).toBe(6)
            }
            expect(view.actionDiscard.items).toEqual([])
            expect(view.courtDeck.items).toEqual([])
            expect(view.courtDeck.remaining).toBe(session.state.courtDeck.remaining)
            expect(() => ArcsRuntime.hydrator.hydrateState(view)).not.toThrow()
        }
    })
})

describe('face-down plays', () => {
    it('show their cards only to the player who played them, in state and in the Action', () => {
        const session = startTestGame(3)
        const action = copyAndSeize(session)
        const [, b] = session.state.turnManager.turnOrder
        for (const perspective of perspectives(session.state)) {
            const own = perspective.kind === 'player' && perspective.playerId === b
            const view = project(session, perspective)
            const play = view.round.plays.find((candidate) => candidate.playerId === b)
            assertExists(play, 'The second player has played')
            expect(play.faceDownCount).toBe(2)
            expect(play.faceDown !== undefined).toBe(own)
            const seen = ArcsRuntime.visibility.actions.project(action, perspective, {
                config: session.game.config
            })
            expect('cardId' in seen && seen.cardId !== undefined).toBe(own)
            expect('seizeWith' in seen && seen.seizeWith !== undefined).toBe(own)
            expect(JSON.stringify(seen).includes('mobilization-3')).toBe(own)
        }
    })

    it('are never revealed, not even at the end of the game', () => {
        const session = startTestGame(3)
        copyAndSeize(session)
        session.edit((state) => {
            state.machineState = MachineState.EndOfGame
        })
        const [a, b] = session.state.turnManager.turnOrder
        const view = project(session, { kind: 'player', playerId: a })
        expect(view.round.plays.find((play) => play.playerId === b)?.faceDown).toBeUndefined()
    })
})

describe('the draft', () => {
    it('is public', () => {
        const session = startTestGame(3, { leadersAndLore: LeadersAndLore.OneLore })
        const view = project(session, { kind: 'spectator' })
        expect(view.draft).toEqual(session.state.draft)
    })
})

describe('Farseers', () => {
    it('shows the Rival’s hand to the declarer alone, then swaps a card', () => {
        const session = startTestGame(3, { leadersAndLore: LeadersAndLore.None })
        const [a, b, c] = session.state.turnManager.turnOrder
        session.edit((state) => {
            for (const player of state.players) {
                if (player.playerId === a) {
                    player.hand = ['construction-5', 'aggression-2']
                    player.guildCards = [Court.Farseers]
                }
                if (player.playerId === b) player.hand = ['mobilization-6', 'administration-1']
                player.handCount = player.hand?.length ?? 0
            }
        })
        session.act(a, ActionType.LeadCard, { cardId: 'construction-5', declare: Ambition.Keeper })
        expect(session.state.machineState).toBe(MachineState.Declaring)
        session.act(a, ActionType.Farsee, { rival: b, revealsInfo: true })
        expect(project(session, { kind: 'player', playerId: a }).declaration?.rivalHand).toEqual([
            'mobilization-6',
            'administration-1'
        ])
        for (const viewer of [b, c]) {
            const view = project(session, { kind: 'player', playerId: viewer })
            expect(view.declaration?.rivalHand).toBeUndefined()
        }
        const [swap] = session.act(a, ActionType.SwapWithRival, {
            give: 'aggression-2',
            take: 'mobilization-6'
        })
        for (const viewer of [b, c]) {
            const seen = ArcsRuntime.visibility.actions.project(
                swap,
                { kind: 'player', playerId: viewer },
                { config: session.game.config }
            )
            expect(JSON.stringify(seen)).not.toContain('mobilization-6')
            expect(JSON.stringify(seen)).not.toContain('aggression-2')
        }
        expect(session.hand(a)).toEqual(['mobilization-6'])
        expect(session.hand(b)).toEqual(['administration-1', 'aggression-2'])
        expect(session.state.declaration).toBeUndefined()
        expect(session.state.machineState).toBe(MachineState.TakingActions)
    })
})

describe('Farseers’ Prelude', () => {
    it('hides the cards discarded and drawn from everyone else', () => {
        const session = startTestGame(3, { leadersAndLore: LeadersAndLore.None })
        const [a, b] = session.state.turnManager.turnOrder
        session.edit((state) => {
            for (const player of state.players) {
                if (player.playerId === a) {
                    player.hand = ['construction-5', 'aggression-2']
                    player.handCount = 2
                    player.guildCards = [Court.Farseers]
                }
            }
        })
        session.act(a, ActionType.LeadCard, { cardId: 'construction-5' })
        const [use] = session.act(a, ActionType.UseFarseers, {
            discards: ['aggression-2'],
            revealsInfo: true
        })
        const seen = ArcsRuntime.visibility.actions.project(
            use,
            { kind: 'player', playerId: b },
            { config: session.game.config }
        )
        expect(JSON.stringify(seen)).not.toContain('aggression-2')
        const view = project(session, { kind: 'player', playerId: b })
        expect(view.players.find((player) => player.playerId === a)?.hand).toBeUndefined()
        expect(view.players.find((player) => player.playerId === a)?.handCount).toBe(2)
    })
})
