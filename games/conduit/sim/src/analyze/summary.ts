import { fmt, loadRun, meanCI, winShare } from './load.js'

// Usage: tsx sim/src/analyze/summary.ts <run dir>
const dir = process.argv[2]
const { run, games } = loadRun(dir)
const players = games[0]?.players ?? 0
const lines: string[] = []
const out = (line = '') => lines.push(line)

out(
    `# ${String(run.name)}: ${games.length} games, ${players} players, ${String(run.cubesPerRound)} cubes per round`
)
out(`Expected win share for an equal seat: ${(1 / players).toFixed(3)}`)
out()

out('## Win share by bot (95% interval)')
const bots = [...new Set(games.flatMap((game) => game.bots))]
for (const bot of bots) {
    const shares = games.flatMap((game) =>
        game.bots.flatMap((name, seat) => (name === bot ? [winShare(game, seat)] : []))
    )
    const cash = games.flatMap((game) =>
        game.bots.flatMap((name, seat) => (name === bot ? [game.finalCash[seat]] : []))
    )
    out(`- ${bot}: win ${fmt(meanCI(shares), 3)}, cash ${fmt(meanCI(cash), 1)}`)
}
out()

out('## Win share by first-round seat')
for (let seat = 0; seat < players; seat++) {
    out(`- seat ${seat + 1}: ${fmt(meanCI(games.map((game) => winShare(game, seat))), 3)}`)
}
out()

out('## Runaway leaders')
const leaderAfter = (game: (typeof games)[number], round: number) => {
    const cash = game.cashAfterRound[round - 1]
    if (!cash) return []
    const top = Math.max(...cash)
    return cash.flatMap((value, seat) => (value === top ? [seat] : []))
}
for (const round of [1, 2, 3, 4, 5]) {
    const holds = games.map((game) => {
        const leaders = leaderAfter(game, round)
        return leaders.some((seat) => game.winners.includes(seat)) ? 1 : 0
    })
    out(`- leader after round ${round} wins: ${fmt(meanCI(holds), 3)}`)
}
const changes = games.map((game) => {
    let count = 0
    let previous: number[] = []
    for (let round = 1; round <= game.cashAfterRound.length; round++) {
        const leaders = leaderAfter(game, round)
        if (previous.length > 0 && !leaders.some((seat) => previous.includes(seat))) count += 1
        previous = leaders
    }
    return count
})
out(`- lead changes per game (rounds 1-5): ${fmt(meanCI(changes))}`)
const margin = games.map((game) => {
    const sorted = [...game.finalCash].sort((a, b) => b - a)
    return sorted[0] - sorted[1]
})
out(`- winning margin over second: ${fmt(meanCI(margin), 1)}`)
const spread = games.map((game) => Math.max(...game.finalCash) - Math.min(...game.finalCash))
out(`- first to last spread: ${fmt(meanCI(spread), 1)}`)
out()

out('## Economy')
out(`- tiles bought per game: ${fmt(meanCI(games.map((game) => game.buys.length)), 1)}`)
out(
    `- tiles unbought (face down) per game: ${fmt(meanCI(games.map((game) => game.unboughtByRound.reduce((t, v) => t + (v ?? 0), 0))), 1)}`
)
out(`- price paid: ${fmt(meanCI(games.flatMap((game) => game.buys.map((buy) => buy.price))), 2)}`)
out(
    `- payout rounds after round 5: ${fmt(meanCI(games.map((game) => game.payoutRoundsAfterLast)), 2)}`
)
const lowSupply = games.flatMap((game) =>
    game.supplyAtRoundStart
        .slice(1)
        .flat()
        .map((supply) => (supply < 3 ? 1 : 0))
)
out(`- share of player-rounds starting with fewer than 3 cubes: ${fmt(meanCI(lowSupply), 3)}`)
const emptySupply = games.flatMap((game) =>
    game.supplyAtRoundStart
        .slice(1)
        .flat()
        .map((supply) => (supply === 0 ? 1 : 0))
)
out(`- share of player-rounds starting with no cubes: ${fmt(meanCI(emptySupply), 3)}`)
out()

out('## Routes')
const paid = games.flatMap((game) => game.revenues)
out(`- payouts with no route: ${fmt(meanCI(paid.map((r) => (r.amount === 0 ? 1 : 0))), 3)}`)
const routed = paid.filter((r) => r.amount > 0)
out(`- stations on a paying route: ${fmt(meanCI(routed.map((r) => r.stations)), 2)}`)
out(
    `- routes of just two stations (adjacent): ${fmt(meanCI(routed.map((r) => (r.stations === 2 ? 1 : 0))), 3)}`
)
for (const letter of ['A', 'B', 'C', 'D']) {
    const of = paid.filter((r) => r.letter === letter)
    out(
        `- ${letter} station payout: ${fmt(meanCI(of.map((r) => r.amount)), 2)} over ${of.length} payouts`
    )
}
out()

out('## Placement freedom (face-up, by round)')
for (let round = 1; round <= 5; round++) {
    const of = games.flatMap((game) => game.placements.filter((p) => p.faceUp && p.round === round))
    if (of.length === 0) continue
    const options = meanCI(of.map((p) => p.options))
    const single = meanCI(of.map((p) => (p.options === 1 ? 1 : 0)))
    const gap = of.filter((p) => p.options > 1).map((p) => (p.best ?? 0) - (p.second ?? 0))
    const range = of.filter((p) => p.options > 1).map((p) => (p.best ?? 0) - (p.worst ?? 0))
    const tie = gap.map((value) => (value < 0.01 ? 1 : 0))
    out(
        `- round ${round}: options ${fmt(options, 1)}, forced ${fmt(single, 2)}, best-second gap ${fmt(meanCI(gap), 2)}, tied best ${fmt(meanCI(tie), 2)}, best-worst ${fmt(meanCI(range), 2)}`
    )
}
out()

out('## Offers')
const offers = games.flatMap((game) => game.offers)
for (const price of [1, 2, 3, 4, 5, 6]) {
    const of = offers.filter((offer) => (price === 6 ? offer.price >= 6 : offer.price === price))
    if (of.length === 0) continue
    out(
        `- price ${price === 6 ? '6+' : price}: bought ${fmt(meanCI(of.map((o) => (o.bought ? 1 : 0))), 2)} of ${of.length}`
    )
}
console.log(lines.join('\n'))
