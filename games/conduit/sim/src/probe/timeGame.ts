import { playGame } from '../game.js'
import { makeBot } from '../bots/catalog.js'

// Times a few games. Usage: tsx sim/src/probe/timeGame.ts [players] [games]
const players = Number(process.argv[2] ?? 4)
const games = Number(process.argv[3] ?? 3)
const spec = 'stacker{margin=1,expectMargin=1,mirror=true}'
const started = Date.now()
for (let seed = 1; seed <= games; seed++) {
    playGame({ seed, bots: Array.from({ length: players }, () => makeBot(spec)) })
}
console.log(`${games} games, ${((Date.now() - started) / games).toFixed(0)} ms each`)
