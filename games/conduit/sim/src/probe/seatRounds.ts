import { loadRun } from '../analyze/load.js'

// Per seat: mean cash after each round, buys per round, and final cash. Usage: seatRounds.ts <dir>...
for (const dir of process.argv.slice(2)) {
    const { games } = loadRun(dir)
    const players = games[0].players
    console.log(dir.split('/').pop())
    for (let seat = 0; seat < players; seat++) {
        const cash = [0, 1, 2, 3, 4].map(
            (round) =>
                games.reduce(
                    (total, game) => total + (game.cashAfterRound[round]?.[seat] ?? 0),
                    0
                ) / games.length
        )
        const buys = [1, 2, 3, 4, 5].map(
            (round) =>
                games.reduce(
                    (total, game) =>
                        total +
                        game.buys.filter((buy) => buy.round === round && buy.seat === seat).length,
                    0
                ) / games.length
        )
        const final = games.reduce((total, game) => total + game.finalCash[seat], 0) / games.length
        console.log(
            `  seat ${seat} cash after r1-5 ${cash.map((v) => v.toFixed(1)).join(' ')} final ${final.toFixed(1)} | buys r1-5 ${buys.map((v) => v.toFixed(2)).join(' ')}`
        )
    }
}
