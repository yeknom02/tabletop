import { DefaultStateLogger, type GameRuntime, Visibility } from '@tabletop/common'
import {
    ArcsGameState,
    ArcsGameStateValidator,
    type HydratedArcsGameState,
    type ArcsProjectedState
} from '../model/gameState.js'
import { ArcsHydrator } from './hydrator.js'
import { ArcsGameInitializer } from './initializer.js'
import { ArcsApiActions } from './apiActions.js'
import { ArcsActionSchemas } from './actionSchemas.js'
import { ArcsStateHandlers } from './stateHandlers.js'
import { ArcsColors } from './colors.js'
import { ArcsScoring } from './scoring.js'

export const ArcsRuntime = {
    randomnessVersion: 1,
    initializer: new ArcsGameInitializer(),
    canonicalStateValidator: ArcsGameStateValidator,
    hydrator: new ArcsHydrator(),
    stateHandlers: ArcsStateHandlers,
    apiActions: ArcsApiActions,
    playerColors: ArcsColors,
    stateLogger: new DefaultStateLogger(),
    scoring: new ArcsScoring(),
    visibility: {
        state: Visibility.createProjector(ArcsGameState),
        actions: Visibility.createActionProjector(ArcsActionSchemas)
    }
} satisfies GameRuntime<ArcsProjectedState, HydratedArcsGameState>
