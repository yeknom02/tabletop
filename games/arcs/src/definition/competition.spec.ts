import { assert, GameEngine, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ArcsGameStateValidator, DraftKind, type ArcsProjectedState } from '../model/gameState.js'
import {
    createGame,
    createTestSession,
    TestMasterSeed,
    type TestGame,
    type TestSession
} from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { LeadersAndLore, type ArcsGameConfig } from './config.js'
import { ArcsRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(ArcsRuntime)

const Configurations: Partial<ArcsGameConfig>[] = [
    { leadersAndLore: LeadersAndLore.None },
    { leadersAndLore: LeadersAndLore.OneLore },
    { leadersAndLore: LeadersAndLore.TwoLore }
]

function rotations(playerIds: string[]): string[][] {
    return playerIds.map((_, offset) => [...playerIds.slice(offset), ...playerIds.slice(0, offset)])
}

function startAssigned(game: TestGame, order: string[]) {
    const { initialState, startedGame } = engine.startGame(game, {
        masterSeed: TestMasterSeed,
        startingPositions: { playerIds: order }
    })
    expect(startedGame.protectedInformation).toBe(true)
    return createTestSession(startedGame, initialState)
}

function initializer(game: TestGame) {
    const uninitialized = engine.generateUninitializedState(game, TestMasterSeed)
    return (playerIds?: string[]): ArcsProjectedState =>
        ArcsRuntime.initializer
            .initializeGameState(
                game,
                structuredClone(uninitialized),
                playerIds ? { playerIds } : undefined
            )
            .dehydrate()
}

// Everything a seat is dealt or places, without the player sitting there.
function seats(state: ArcsProjectedState) {
    return state.players.map(({ playerId: _playerId, color: _color, ...seat }) => seat)
}

// The map with each owner named by seat, so seatings can be compared.
function mapBySeat(state: ArcsProjectedState) {
    const seat = (owner: string) => `seat${state.turnManager.turnOrder.indexOf(owner)}`
    return state.systems.map((system) => ({
        id: system.id,
        ships: Object.fromEntries(
            Object.entries(system.ships).map(([owner, count]) => [seat(owner), count])
        ),
        slots: system.slots.map((building) =>
            building ? { ...building, owner: seat(building.owner) } : null
        )
    }))
}

// Drafts the first card offered each time, and has an Archivist keep the first 2 lore drawn.
function draftAll(session: TestSession) {
    draftLeadersAndLore(session)
    const archive = session.state.archive
    if (archive) {
        session.act(archive.playerId, ActionType.KeepLore, { cardIds: archive.cards.slice(0, 2) })
    }
}

function draftLeadersAndLore(session: TestSession) {
    while (session.state.machineState === MachineState.Drafting) {
        const playerId = session.currentPlayerId()
        const state = session.hydrated()
        const leader = state.needsFromDraft(playerId, DraftKind.Leader)
        session.act(playerId, ActionType.DraftCard, {
            cardId: leader ? state.draft?.leaders[0] : state.draft?.lore[0],
            kind: leader ? DraftKind.Leader : DraftKind.Lore
        })
    }
}

// Everyone passes the initiative every round, so each chapter ends at once, until the fifth.
function passToTheEnd(session: TestSession) {
    for (
        let step = 0;
        step < 200 && session.state.machineState !== MachineState.EndOfGame;
        step++
    ) {
        if (session.state.machineState === MachineState.Mulligan) {
            session.act(session.currentPlayerId(), ActionType.KeepHand)
        } else {
            session.act(session.currentPlayerId(), ActionType.PassInitiative)
        }
    }
}

describe.each([2, 3, 4])('Arcs tournaments with %i players', (count) => {
    it.each(Configurations)(
        'gives seat one the initiative and turn order to the rest (%o)',
        (config) => {
            const game = createGame(count, config)
            for (const order of rotations(game.players.map((player) => player.id))) {
                const session = startAssigned(game, order)
                expect(session.state.turnManager.turnOrder).toEqual(order)
                expect(session.state.initiative).toBe(order[0])
                draftAll(session)
                if (session.state.machineState === MachineState.Mulligan) {
                    session.act(session.currentPlayerId(), ActionType.KeepHand)
                }
                expect(session.currentPlayerId()).toBe(order[0])
            }
        }
    )

    it.each(Configurations)('leaves the rest of setup as the seed made it (%o)', (config) => {
        const game = createGame(count, config)
        const initialize = initializer(game)
        const normal = initialize()
        expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)
        for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
            const assigned = initialize(order)
            assert(ArcsGameStateValidator.Check(assigned), 'Setup must be canonical')
            expect(assigned.turnManager.turnOrder).toEqual(order)
            expect(seats(assigned)).toEqual(seats(normal))
            expect(mapBySeat(assigned)).toEqual(mapBySeat(normal))
            expect({
                ...assigned,
                players: normal.players,
                turnManager: normal.turnManager,
                initiative: normal.initiative,
                round: normal.round,
                systems: normal.systems,
                draft: normal.draft
            }).toEqual(normal)
        }
    })

    it('records a result every player can be scored by', () => {
        const game = createGame(count, { leadersAndLore: LeadersAndLore.OneLore })
        const order = game.players.map((player) => player.id).reverse()
        const session = startAssigned(game, order)
        draftAll(session)
        passToTheEnd(session)
        const finished = session.state
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        assert(ArcsGameStateValidator.Check(finished), 'The end must be canonical')
        expect(() => validateGameResult(finished)).not.toThrow()
        const finalScores = ArcsRuntime.scoring.finalScores(finished)
        expect(Object.keys(finalScores).toSorted()).toEqual(order.toSorted())
        const best = Math.max(...Object.values(finalScores))
        expect(finished.winningPlayerIds.every((playerId) => finalScores[playerId] === best)).toBe(
            true
        )
    })
})
