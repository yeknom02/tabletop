import { fmt, loadRun, meanCI } from './load.js'

// Cash gained in a round by the round's Start Player against everyone else, under the printed
// clockwise rule (round r's Start Player is seat r-1 mod players). Usage: startPlayer.ts <run dir>
const { games } = loadRun(process.argv[2])
const players = games[0].players
for (let round = 1; round <= 5; round++) {
    const start: number[] = []
    const others: number[] = []
    for (const game of games) {
        const before =
            round === 1 ? game.cashAfterRound[0].map(() => 5) : game.cashAfterRound[round - 2]
        const after = game.cashAfterRound[round - 1]
        after.forEach((cash, seat) => {
            const gain = cash - before[seat]
            if (seat === (round - 1) % players) start.push(gain)
            else others.push(gain)
        })
    }
    console.log(
        `round ${round}: Start Player gains ${fmt(meanCI(start), 2)}, others ${fmt(meanCI(others), 2)}`
    )
}
