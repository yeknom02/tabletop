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
import type { SystemId } from '../components/map.js'
import type { ArcsProjectedState } from '../model/gameState.js'
import type { BuildingKind } from '../model/pieces.js'

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

export type BoardSetup = (state: ArcsProjectedState, players: string[]) => void

// A 3-player game with an empty map and no resources, in which the first player leads `cardId`
// and is taking actions. The others hold one Mobilization card.
export function leadingOnEmptyBoard(
    cardId: string,
    setup: BoardSetup = () => {}
): { session: TestSession; players: string[] } {
    const session = startTestGame(3)
    const players = [...session.state.turnManager.turnOrder]
    session.edit((state) => {
        for (const system of state.systems) {
            system.ships = {}
            system.slots = system.slots.map(() => null)
        }
        for (const player of state.players) {
            player.hand = player.playerId === players[0] ? [cardId] : ['mobilization-2']
            player.handCount = player.hand.length
            player.resources = player.resources.map(() => null)
        }
        state.outOfPlay = []
        setup(state, players)
    })
    session.act(players[0], ActionType.LeadCard, { cardId })
    return { session, players }
}

export function setShips(
    state: ArcsProjectedState,
    id: SystemId,
    owner: string,
    fresh: number,
    damaged = 0
) {
    const system = state.systems.find((candidate) => candidate.id === id)
    if (system) {
        system.ships[owner] = { fresh, damaged }
    }
}

export function setBuilding(
    state: ArcsProjectedState,
    id: SystemId,
    slot: number,
    owner: string,
    kind: BuildingKind,
    damaged = false
) {
    const system = state.systems.find((candidate) => candidate.id === id)
    if (system) {
        system.slots[slot] = { owner, kind, damaged }
    }
}

export function playerIn(state: ArcsProjectedState, playerId: string) {
    const found = state.players.find((candidate) => candidate.playerId === playerId)
    if (!found) {
        throw new Error(`No player ${playerId}`)
    }
    return found
}
