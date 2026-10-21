import type { GameUiDefinition } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { ArcsInfo } from '@tabletop/arcs'
import type { ArcsProjectedState, HydratedArcsGameState } from '@tabletop/arcs'
import coverImg from '$lib/images/cover.webp'

export const UiDefinition: GameUiDefinition<ArcsProjectedState, HydratedArcsGameState> = {
    info: {
        ...ArcsInfo,
        thumbnailUrl: coverImg
    },
    runtime: async () => {
        return (await import('./runtime.js')).ArcsUiRuntime
    }
}
