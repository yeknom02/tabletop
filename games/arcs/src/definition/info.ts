import { GameVisibility, type GameInfo } from '@tabletop/common'
import { ArcsConfigurator } from './config.js'
import { GAME_VERSION } from './version.js'

// A private proof of concept: not to be published.
export const ArcsInfo: GameInfo = {
    id: 'arcs',
    metadata: {
        name: 'Arcs',
        designer: 'Cole Wehrle',
        description:
            'Lead a spacefaring society through the Reach: play action cards to move, build, tax and battle, declare ambitions, and gain the most Power over the chapters.',
        year: '2024',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new ArcsConfigurator()
}
