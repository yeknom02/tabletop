import { fmt, loadRun, meanCI } from './load.js'

// Buying by the round's Start Player against everyone else (printed clockwise rule).
// Usage: startPlayerBuys.ts <run dir>
const { games } = loadRun(process.argv[2])
const players = games[0].players
for (let round = 1; round <= 5; round++) {
    const role = (seat: number) => (seat === (round - 1) % players ? 'start' : 'other')
    const buys = { start: [] as number[], other: [] as number[] }
    const prices = { start: [] as number[], other: [] as number[] }
    const bids = { start: [] as number[], other: [] as number[] }
    for (const game of games) {
        const count = game.bots.map(() => 0)
        for (const buy of game.buys.filter((b) => b.round === round)) {
            count[buy.seat] += 1
            prices[role(buy.seat)].push(buy.price)
        }
        count.forEach((n, seat) => buys[role(seat)].push(n))
        const offered = game.offers.filter((o) => o.round === round)
        game.bots.forEach((_, seat) =>
            bids[role(seat)].push(offered.filter((o) => o.seat === seat).length)
        )
    }
    console.log(
        `round ${round}: buys start ${fmt(meanCI(buys.start))} vs ${fmt(meanCI(buys.other))}; price start ${fmt(meanCI(prices.start))} vs ${fmt(meanCI(prices.other))}; offers received start ${fmt(meanCI(bids.start))} vs ${fmt(meanCI(bids.other))}`
    )
}
