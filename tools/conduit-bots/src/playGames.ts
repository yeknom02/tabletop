import { parseArgs } from 'node:util'
import { PreferredBot } from './bots.ts'
import { keepGame, playGame } from './play.ts'

// Plays a batch of bot games into a run of kept games, one seed after another.
// Usage: node src/playGames.ts --run <name> --games 10 --players 4 --seed 1 --bots random@v1[,…]
const { values } = parseArgs({
    options: {
        run: { type: 'string' },
        games: { type: 'string', default: '10' },
        players: { type: 'string', default: '4' },
        seed: { type: 'string', default: '1' },
        bots: { type: 'string', default: PreferredBot }
    }
})
if (!values.run) throw new Error('--run is required')
const specs = values.bots.split(',').map((spec) => spec.trim())
const first = Number(values.seed)
for (let seed = first; seed < first + Number(values.games); seed++) {
    const kept = playGame(Number(values.players), seed, specs)
    const file = keepGame(values.run, kept)
    const cash = Object.entries(kept.summary.finalCash)
        .map(([playerId, amount]) => `${playerId} $${amount}`)
        .join(' ')
    console.log(
        `${file}: ${kept.scenario.actions.length} actions, ${cash}, won by ${kept.summary.winners.join(', ')}`
    )
}
