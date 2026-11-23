import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    type OffsetCoordinates,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { ConduitGameConfig } from '../definition/gameConfig.js'
import { Definition } from '../definition/definition.js'
import { ConduitInfo } from '../definition/info.js'
import { ConduitRuntime } from '../definition/runtime.js'
import type { ConduitProjectedState } from '../model/gameState.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, config: Partial<ConduitGameConfig> = {}) {
    return ConduitRuntime.initializer.initializeGame(
        {
            id: 'conduit-test',
            typeId: ConduitInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(ConduitInfo.configurator?.options ?? []),
                ...config
            }),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type TestGame = ReturnType<typeof createGame>

export function startTestGame(
    count: number,
    config: Partial<ConduitGameConfig> = {},
    masterSeed: string = TestMasterSeed
) {
    const engine = new GameEngine(ConduitRuntime)
    const { initialState, startedGame } = engine.startGame(createGame(count, config), {
        masterSeed
    })
    return createTestSession(startedGame, initialState)
}

export function createTestSession(game: TestGame, initialState: ConduitProjectedState) {
    const engine = new GameEngine(ConduitRuntime)
    let state = initialState
    let actionCount = 0
    const actions: GameAction[] = []

    function act(playerId: string, type: ActionType, payload: Record<string, unknown> = {}) {
        const action: GameAction = {
            id: `test-${actionCount++}`,
            gameId: game.id,
            playerId,
            source: ActionSource.User,
            type,
            ...payload
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        state = result.updatedState
        actions.push(...result.processedActions)
        return result.processedActions
    }

    return {
        game,
        engine,
        actions,
        get state() {
            return state
        },
        set state(next: ConduitProjectedState) {
            state = next
        },
        edit(change: (draft: ConduitProjectedState) => void) {
            const draft = structuredClone(state)
            change(draft)
            state = draft
        },
        hydrated() {
            return ConduitRuntime.hydrator.hydrateState(structuredClone(state))
        },
        activePlayerId() {
            return state.activePlayerIds[0]
        },
        act,
        bid(slot: number, playerId: string = state.activePlayerIds[0]) {
            return act(playerId, ActionType.PlaceBid, { slot })
        },
        buy(playerId: string = state.activePlayerIds[0]) {
            return act(playerId, ActionType.BuyTile)
        },
        pass(playerId: string = state.activePlayerIds[0]) {
            return act(playerId, ActionType.PassTile)
        },
        place(
            cell: OffsetCoordinates,
            rotation: number,
            extraCubes = 0,
            playerId: string = state.activePlayerIds[0]
        ) {
            return act(playerId, ActionType.PlaceTile, { cell, rotation, extraCubes })
        }
    }
}

export type TestSession = ReturnType<typeof createTestSession>
