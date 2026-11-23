import { describe, expect, it } from 'vitest'
import { assert, MachineContext, Prng, validateGameResult, type Visibility } from '@tabletop/common'
import { BaseLetters } from '../components/tiles.js'
import { ConduitGameStateValidator, type ConduitProjectedState } from '../model/gameState.js'
import { createGame, startTestGame, TestMasterSeed, type TestSession } from '../testing/table.js'
import { playRandomDecision } from '../testing/bot.js'
import { ConduitRuntime } from './runtime.js'
import { MachineState } from './states.js'

function perspectivesFor(state: ConduitProjectedState): Visibility.Perspective[] {
    return [
        { kind: 'spectator' },
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

function playDecisions(session: TestSession, count: number, seed = 7) {
    const random = new Prng({ seed, invocations: 0 }).random
    for (
        let step = 0;
        step < count && session.state.machineState !== MachineState.EndOfGame;
        step++
    ) {
        playRandomDecision(session, random)
    }
}

function stages(count: number): ConduitProjectedState[] {
    const session = startTestGame(count)
    const atSetup = structuredClone(session.state)
    playDecisions(session, 40)
    const midGame = structuredClone(session.state)
    playDecisions(session, 2000)
    expect(session.state.machineState).toBe(MachineState.EndOfGame)
    return [atSetup, midGame, session.state]
}

describe.each([3, 4, 5])('what each Perspective sees with %i players', (count) => {
    it('hides the order of the stacks and shows everything else', () => {
        for (const state of stages(count)) {
            assert(ConduitGameStateValidator.Check(state), 'Projection starts from canonical state')
            for (const perspective of perspectivesFor(state)) {
                const view = ConduitRuntime.visibility.state.project(state, perspective, {
                    config: {}
                })
                expect(view).not.toHaveProperty('masterSeed')
                for (const letter of BaseLetters) {
                    expect(view.stacks[letter]).toEqual({
                        items: [],
                        remaining: state.stacks[letter].remaining
                    })
                }
                expect({
                    ...view,
                    stacks: state.stacks,
                    protectedPrng: state.protectedPrng
                }).toEqual({ ...state, masterSeed: undefined })
            }
        }
    })

    it('fills each stack for exploration with exactly the tiles nobody has seen', () => {
        const [, midGame] = stages(count)
        const view = ConduitRuntime.visibility.state.project(
            midGame,
            { kind: 'player', playerId: 'p0' },
            { config: {} }
        )
        const explored = ConduitRuntime.exploration.createFromProjectedState({
            game: createGame(count),
            state: view,
            actions: [],
            perspective: { kind: 'player', playerId: 'p0' },
            random: new Prng({ seed: 3, invocations: 0 }).random
        })
        assert(ConduitGameStateValidator.Check(explored), 'Exploration is canonical')
        for (const letter of BaseLetters) {
            expect(explored.stacks[letter].items.toSorted((a, b) => a - b)).toEqual(
                midGame.stacks[letter].items.toSorted((a, b) => a - b)
            )
        }
    })
})

describe.each([3, 4, 5])('tournaments with %i players', (count) => {
    it('seats players in their assigned order', () => {
        const game = createGame(count)
        const order = game.players.map((seat) => seat.id).reverse()
        const { initialState, startedGame } = startTestGame(count).engine.startGame(game, {
            masterSeed: TestMasterSeed,
            startingPositions: { playerIds: order }
        })
        expect(startedGame.protectedInformation).toBe(true)
        expect(initialState.turnManager.turnOrder).toEqual(order)
        expect(initialState.activePlayerIds).toEqual([order[0]])
    })

    it('declares a valid result with scores the spectator can see', () => {
        const [, , finished] = stages(count)
        expect(() => validateGameResult(finished)).not.toThrow()
        const scores = ConduitRuntime.scoring.finalScores(finished)
        const spectatorView = ConduitRuntime.visibility.state.project(
            finished,
            { kind: 'spectator' },
            { config: {} }
        )
        expect(ConduitRuntime.scoring.finalScores(spectatorView)).toEqual(scores)
        const best = Math.max(...Object.values(scores))
        expect(finished.winningPlayerIds.every((playerId) => scores[playerId] === best)).toBe(true)
    })
})

describe('the end-of-game result', () => {
    it('is a draw when cash and supply tie', () => {
        const session = startTestGame(3)
        const state = session.hydrated()
        for (const seat of state.players) {
            seat.cash = 9
            seat.supply = 3
        }
        state.machineState = MachineState.EndOfGame
        ConduitRuntime.stateHandlers[MachineState.EndOfGame].enter(
            new MachineContext({ gameState: state, gameConfig: session.game.config })
        )
        expect(state.winningPlayerIds).toEqual(['p0', 'p1', 'p2'])
        expect(() => validateGameResult(state.dehydrate())).not.toThrow()
    })
})
