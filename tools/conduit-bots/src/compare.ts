import { parseArgs } from 'node:util'
import { playGame } from './play.ts'

// Seats one challenger bot against a field of another, in every seat in turn, and reports the
// challenger's share of wins and average cash against the field's. Games are not kept.
// Usage: node src/compare.ts --challenger human@v2 --field human@v1 --games 40 --players 4 --seed 1
const { values } = parseArgs({
    options: {
        challenger: { type: 'string' },
        field: { type: 'string' },
        games: { type: 'string', default: '40' },
        players: { type: 'string', default: '4' },
        seed: { type: 'string', default: '1' }
    }
})
const { challenger, field } = values
if (!challenger || !field) throw new Error('--challenger and --field are required')
const players = Number(values.players)
const games = Number(values.games)
const first = Number(values.seed)

let wins = 0
let challengerCash = 0
let fieldCash = 0
for (let game = 0; game < games; game++) {
    const seat = game % players
    const specs = Array.from({ length: players }, (_, index) =>
        index === seat ? challenger : field
    )
    const kept = playGame(players, first + game, specs)
    const cash = kept.summary.finalCash
    const best = Math.max(...Object.values(cash))
    const winners = Object.keys(cash).filter((playerId) => cash[playerId] === best)
    if (winners.includes(`p${seat}`)) wins += 1 / winners.length
    for (const [playerId, amount] of Object.entries(cash)) {
        if (playerId === `p${seat}`) challengerCash += amount
        else fieldCash += amount / (players - 1)
    }
}
const fair = 1 / players
console.log(
    `${challenger} vs ${field}, ${players}p, ${games} games: wins ${(wins / games).toFixed(2)} ` +
        `(fair ${fair.toFixed(2)}), cash $${(challengerCash / games).toFixed(1)} vs ` +
        `$${(fieldCash / games).toFixed(1)}`
)
