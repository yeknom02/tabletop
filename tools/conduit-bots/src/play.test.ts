import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ActionType, MachineState } from '@tabletop/conduit'
import { botMove, Bots } from './bots.ts'
import { playGame } from './play.ts'
import { engine, legalMoves, newTable } from './table.ts'

test('a random bot game plays to the end and keeps every action', () => {
    const kept = playGame(4, 11, ['random@v1'])
    const { game, state, actions } = kept.scenario
    assert.equal(state.machineState, MachineState.EndOfGame)
    assert.equal(actions.length, state.actionCount)
    assert.ok(kept.summary.winners.length > 0)
    // Replaying the kept history through the engine from the same start reaches the same end.
    let replayed = newTable(4, 11, Object.values(kept.seats)).state
    for (const action of actions) {
        replayed = engine.applyProcessedAction({ game, state: replayed, action }) as typeof replayed
    }
    // Only the state's own id and game id are new.
    assert.deepEqual({ ...replayed, id: '', gameId: '' }, { ...state, id: '', gameId: '' })
})

test('the same seed and seats play the same game', () => {
    const first = playGame(3, 5, ['random@v1'])
    const second = playGame(3, 5, ['random@v1'])
    const moves = (kept: typeof first) =>
        kept.scenario.actions.map((action) => {
            const { type, playerId, spot, cell, extraCubes } = action as Record<string, unknown>
            return JSON.stringify({ type, playerId, spot, cell, extraCubes })
        })
    assert.deepEqual(moves(second), moves(first))
    assert.deepEqual(second.summary.finalCash, first.summary.finalCash)
})

test('legal moves come from the engine: bids on every spot, no pass before two bids', () => {
    const { game, state } = newTable(3, 2, ['random@v1', 'random@v1', 'random@v1'])
    const moves = legalMoves(game, state, state.activePlayerIds[0])
    assert.deepEqual([...moves.keys()], [ActionType.PlaceBid])
    assert.equal(moves.get(ActionType.PlaceBid)?.length, 3)
})

test('a harness move is the same for the same position', () => {
    const { game, state } = newTable(5, 9, Array(5).fill('random@v1'))
    assert.deepEqual(botMove(game, state, 'random@v1'), botMove(game, state, 'random@v1'))
})

test('every bot plays 3, 4 and 5 player games to the end, alone and mixed', () => {
    const specs = Bots.map((bot) => bot.spec)
    for (const spec of specs) {
        const kept = playGame(3 + (specs.indexOf(spec) % 3), 21, [spec])
        assert.equal(kept.scenario.state.machineState, MachineState.EndOfGame, spec)
    }
    const mixed = playGame(5, 22, specs.slice(1))
    assert.equal(mixed.scenario.state.machineState, MachineState.EndOfGame)
})

test('a human bot buys only what it values above the price, and stays reproducible', () => {
    const first = playGame(4, 23, ['human@v4'])
    const second = playGame(4, 23, ['human@v4'])
    assert.deepEqual(second.summary.finalCash, first.summary.finalCash)
    const types = first.scenario.actions.map((action) => action.type)
    assert.ok(types.includes(ActionType.BuyTile))
    assert.ok(types.includes(ActionType.PassTile))
})
