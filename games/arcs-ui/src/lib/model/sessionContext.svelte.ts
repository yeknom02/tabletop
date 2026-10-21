import { createGameSessionContext } from '@tabletop/frontend-components'
import { ArcsGameSession } from './session.svelte.js'

const [getContext, setContext] = createGameSessionContext<ArcsGameSession>()

export function setGameSession(session: ArcsGameSession) {
    setContext(session)
}

export function getGameSession(): ArcsGameSession {
    return getContext()
}
