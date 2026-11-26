import { flushSync } from 'svelte'
import { assert, type GameState, type HydratedGameState } from '@tabletop/common'
import {
    BridgedContext,
    GameSession,
    createHarnessAppContext,
    scenarioData,
    type GameUiDefinition
} from '@tabletop/frontend-components'
import { ConduitGameStateValidator, ConduitRuntime } from '@tabletop/conduit'
import { UiDefinition } from '$lib/definitions/definition.js'
import { ConduitUiRuntime } from '$lib/definitions/runtime.js'
import { ConduitGameSession } from '$lib/model/session.svelte.js'

const HarnessDefinition: GameUiDefinition<GameState, HydratedGameState> = {
    info: UiDefinition.info,
    async runtime() {
        return {
            ...ConduitRuntime,
            sessionClass: GameSession,
            colorizer: ConduitUiRuntime.colorizer,
            gameUI: {
                load: async () => {
                    throw Error('The session harness does not render a table')
                },
                mount: () => {
                    throw Error('The session harness does not render a table')
                }
            }
        }
    }
}

const open: ConduitGameSession[] = []

// A hotseat session on a harness scenario file, so the seat on screen is the one on the clock.
export async function openSessionOn(file: unknown): Promise<ConduitGameSession> {
    const scenario = scenarioData(file)
    const state = scenario.state
    assert(ConduitGameStateValidator.Check(state), 'The scenario holds a Conduit state')
    const game = { ...scenario.game, hotseat: true }
    const appContext = createHarnessAppContext(HarnessDefinition)
    const bridgedContext = new BridgedContext({
        authorizationService: appContext.authorizationService,
        gameService: appContext.gameService,
        chatService: appContext.chatService,
        gameId: game.id
    })
    const session = new ConduitGameSession({
        gameService: appContext.gameService,
        bridgedContext,
        notificationService: appContext.notificationService,
        chatService: appContext.chatService,
        api: appContext.api,
        runtime: ConduitUiRuntime,
        game,
        state,
        actions: scenario.actions
    })
    open.push(session)
    flushSync()
    await session.waitForVisibleTransitionSettled()
    flushSync()
    return session
}

export function disposeSessions(): void {
    for (const session of open.splice(0)) session.dispose()
}
