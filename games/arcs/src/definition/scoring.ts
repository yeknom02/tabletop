import type { GameScoring } from '@tabletop/common'
import type { ArcsProjectedState } from '../model/gameState.js'

// Final Power; the winner is chosen by Power with turn-order tiebreaks (rule 6.2.3.1).
export class ArcsScoring implements GameScoring<ArcsProjectedState> {
    finalScores(state: ArcsProjectedState): Record<string, number> {
        return Object.fromEntries(state.players.map((player) => [player.playerId, player.power]))
    }
}
