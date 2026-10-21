import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { LeadersAndLore, type ArcsGameConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import { ArcsInfo } from '../definition/info.js'
import { ArcsRuntime } from '../definition/runtime.js'
import type { ArcsProjectedState } from '../model/gameState.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(count: number, config: Partial<ArcsGameConfig> = {}) {
    return ArcsRuntime.initializer.initializeGame(
        {
            id: 'arcs-test',
            typeId: ArcsInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(ArcsInfo.configurator?.options ?? []),
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

// Without leaders and lore unless the config says otherwise, so tests start straight at play.
export function startTestGame(
    count: number,
    config: Partial<ArcsGameConfig> = { leadersAndLore: LeadersAndLore.None },
    masterSeed: string = TestMasterSeed
) {
    const engine = new GameEngine(ArcsRuntime)
    const { initialState, startedGame } = engine.startGame(createGame(count, config), {
        masterSeed
    })
    return createTestSession(startedGame, initialState)
}

export function createTestSession(game: TestGame, initialState: ArcsProjectedState) {
    const engine = new GameEngine(ArcsRuntime)
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
        actions,
        initialState,
        get state() {
            return state
        },
        edit(change: (draft: ArcsProjectedState) => void) {
            const draft = structuredClone(state)
            change(draft)
            state = draft
        },
        hydrated() {
            return ArcsRuntime.hydrator.hydrateState(structuredClone(state))
        },
        currentPlayerId() {
            return state.activePlayerIds[0]
        },
        hand(playerId: string): string[] {
            return state.players.find((player) => player.playerId === playerId)?.hand ?? []
        },
        act
    }
}

export type TestSession = ReturnType<typeof createTestSession>

