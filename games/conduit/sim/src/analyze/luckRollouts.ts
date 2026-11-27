import { readFileSync } from 'node:fs'

// Reads probe/luckRollouts.ts output. For each player count, round and condition:
// - settled: how often two replays of the same position have the same winner, rescaled so 0 is a
//   lottery (1 / players) and 1 is always the same winner;
// - original: the share of replays won by the original game's winner;
// - leader: the share of replays won by a player leading in cash when the position was kept.
// Ties share a win. The gap between "noise" and "reshuffle" is what the stack order adds.
// Usage: tsx sim/src/analyze/luckRollouts.ts <file.jsonl>...
type Line = {
    seed: number
    players: number
    round: number
    condition: 'reshuffle' | 'noise'
    original: number[]
    leaders: number[]
    conts: number[][]
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const half = (values: number[]) =>
    1.96 *
    Math.sqrt(
        values.reduce((a, b) => a + (b - mean(values)) ** 2, 0) /
            (values.length - 1) /
            values.length
    )
const ci = (values: number[]) => `${mean(values).toFixed(2)} ±${half(values).toFixed(2)}`

const share = (winners: number[], seats: number[]) =>
    winners.filter((seat) => seats.includes(seat)).length / winners.length

function settled(line: Line): number {
    const k = line.conts.length
    let agree = 0
    for (let seat = 0; seat < line.players; seat++) {
        const wins = line.conts.map((winners) => share(winners, [seat]))
        const total = wins.reduce((a, b) => a + b, 0)
        agree += total ** 2 - wins.reduce((a, b) => a + b ** 2, 0)
    }
    const chance = 1 / line.players
    return (agree / (k * (k - 1)) - chance) / (1 - chance)
}

const lines: Line[] = process.argv.slice(2).flatMap((file) =>
    readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((text) => JSON.parse(text) as Line)
)
console.log(
    '| players | round | positions | settled: noise | settled: reshuffle | original wins: noise | original wins: reshuffle | leader wins: reshuffle |'
)
console.log('|---|---|---|---|---|---|---|---|')
for (const players of [...new Set(lines.map((line) => line.players))].sort()) {
    for (const round of [1, 2, 3, 4, 5]) {
        const of = (condition: Line['condition']) =>
            lines.filter(
                (line) =>
                    line.players === players && line.round === round && line.condition === condition
            )
        const noise = of('noise')
        const reshuffle = of('reshuffle')
        if (!noise.length) continue
        const original = (group: Line[]) =>
            group.map((line) => mean(line.conts.map((winners) => share(winners, line.original))))
        const leader = reshuffle.map((line) =>
            mean(line.conts.map((winners) => (share(line.leaders, winners) > 0 ? 1 : 0)))
        )
        console.log(
            `| ${players} | ${round} | ${noise.length} | ${ci(noise.map(settled))} | ${ci(reshuffle.map(settled))} | ${ci(original(noise))} | ${ci(original(reshuffle))} | ${round === 1 ? '-' : ci(leader)} |`
        )
    }
}
