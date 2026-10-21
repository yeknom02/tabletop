import type {
    GameUIRuntime,
    PlayerColorPalette
} from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Color } from '@tabletop/common'
import type { ArcsProjectedState, HydratedArcsGameState } from '@tabletop/arcs'
import { ArcsRuntime } from '@tabletop/arcs'
import { mountDynamicComponent } from '@tabletop/frontend-components/utils/dynamicComponent'
import { ArcsGameColorizer } from './colorizer.js'
import GameTable from '../components/GameTable.svelte'
import { ArcsGameSession } from '$lib/model/session.svelte.js'
import '../../app.css'

// The four colours of the plastic pieces, as the HRF art paints them.
const arcsPlayerColorPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#c8352b', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#e8b630', text: '#000000', contrast: '#000000' },
    [Color.Blue]: { fill: '#2f6fc2', text: '#ffffff', contrast: '#ffffff' },
    [Color.White]: { fill: '#e9e4d8', text: '#000000', contrast: '#000000' }
}

export const ArcsUiRuntime: GameUIRuntime<ArcsProjectedState, HydratedArcsGameState> = {
    ...ArcsRuntime,
    gameUI: {
        component: GameTable,
        load: async () => GameTable,
        mount: mountDynamicComponent
    },
    sessionClass: ArcsGameSession,
    colorizer: new ArcsGameColorizer(),
    playerColorPalette: arcsPlayerColorPalette
}
