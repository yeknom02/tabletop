import { defineGame } from '@tabletop/common'
import type { HydratedArcsGameState, ArcsProjectedState } from '../model/gameState.js'
import { ArcsInfo } from './info.js'
import { ArcsRuntime } from './runtime.js'

export const Definition = defineGame<ArcsProjectedState, HydratedArcsGameState>({
    info: ArcsInfo,
    runtime: ArcsRuntime
})
