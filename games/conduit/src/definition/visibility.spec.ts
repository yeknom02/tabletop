import { describe, expect, it } from 'vitest'
import { assert, MachineContext, Prng, validateGameResult, type Visibility } from '@tabletop/common'
import { BaseLetters } from '../components/tiles.js'
import { ConduitGameStateValidator, type ConduitProjectedState } from '../model/gameState.js'
import { createGame, startTestGame, type TestSession } from '../testing/table.js'
import { MarketDeal } from './gameConfig.js'
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

describe('the shuffled-market variant', () => {
    it('deals from one hidden stack of every tile left after setup', () => {
        const session = startTestGame(4, { marketDeal: MarketDeal.Shuffled })
        const state = session.state
        expect(state.deck?.remaining).toBe(60 - 4)
        for (const letter of BaseLetters) {
            expect(state.stacks[letter].remaining).toBe(0)
        }
        const view = ConduitRuntime.visibility.state.project(
            state,
            { kind: 'player', playerId: 'p0' },
            { config: {} }
        )
        expect(view.deck).toEqual({ items: [], remaining: 56 })
    })

    it('refills the one stack with exactly the unseen tiles for exploration', () => {
        const session = startTestGame(4, { marketDeal: MarketDeal.Shuffled })
        playDecisions(session, 40)
        const view = ConduitRuntime.visibility.state.project(
            session.state,
            { kind: 'player', playerId: 'p0' },
            { config: {} }
        )
        const explored = ConduitRuntime.exploration.createFromProjectedState({
            game: createGame(4, { marketDeal: MarketDeal.Shuffled }),
            state: view,
            actions: [],
            perspective: { kind: 'player', playerId: 'p0' },
            random: new Prng({ seed: 3, invocations: 0 }).random
        })
        expect(explored.deck?.items.toSorted((a, b) => a - b)).toEqual(
            session.state.deck?.items.toSorted((a, b) => a - b)
        )
    })
})
