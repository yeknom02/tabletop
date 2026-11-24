import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ActionType, MachineState } from '@tabletop/conduit'
import { botMove } from './bots.ts'
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
            const { type, playerId, slot, cell, extraCubes } = action as Record<string, unknown>
            return JSON.stringify({ type, playerId, slot, cell, extraCubes })
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
