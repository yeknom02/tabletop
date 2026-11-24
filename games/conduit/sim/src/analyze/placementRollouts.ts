import { readFileSync } from 'node:fs'

// Reads placementRollouts.ts output. For each tied decision, a two-way layout (spot x continuation):
// - real spread: the standard deviation of the spots' true values, with the continuation noise
//   taken out (ANOVA variance component, averaged over decisions, then square-rooted);
// - look-ahead gain: pick the best tied spot on half the continuations, score it on the other half
//   against the average tied spot (what a player who could see ahead would gain over picking any
//   tie), both halves swapped and averaged;
// - lower spot: how the bots' next-best-rated spot does against the tied ones, for scale.
// Measures: placing seat's final cash, margin over the best opponent, and win share.
// Usage: tsx sim/src/analyze/placementRollouts.ts <file.jsonl>...
type Candidate = {
    tied: boolean
    score: number
    own: number
    stationPayout: number
    cell: { col: number; row: number }
    rotation: number
    cash: number[]
    margin: number[]
    win: number[]
}
type Decision = {
    seed: number
    players: number
    round: number
    tiedCount: number
    tiedCells?: number
    options: number
    topScore: number
    candidates: Candidate[]
}
type Measure = 'cash' | 'margin' | 'win'

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

function varianceComponent(rows: number[][]): number {
    const spots = rows.length
    const conts = rows[0].length
    const grand = mean(rows.flat())
    const spotMeans = rows.map(mean)
    const contMeans = Array.from({ length: conts }, (_, r) => mean(rows.map((row) => row[r])))
    let ssSpot = 0
    let ssError = 0
    for (let c = 0; c < spots; c++) {
        ssSpot += conts * (spotMeans[c] - grand) ** 2
        for (let r = 0; r < conts; r++) {
            ssError += (rows[c][r] - spotMeans[c] - contMeans[r] + grand) ** 2
        }
    }
    const msSpot = ssSpot / (spots - 1)
    const msError = ssError / ((spots - 1) * (conts - 1))
    return (msSpot - msError) / conts
}

function lookAheadGain(rows: number[][]): number {
    const conts = rows[0].length
    const half = (parity: number) => (row: number[]) => mean(row.filter((_, r) => r % 2 === parity))
    let total = 0
    for (const parity of [0, 1]) {
        const pickMeans = rows.map(half(parity))
        const best = pickMeans.indexOf(Math.max(...pickMeans))
        const scoreMeans = rows.map(half(1 - parity))
        total += scoreMeans[best] - mean(scoreMeans)
    }
    return conts > 1 ? total / 2 : 0
}

function summarize(label: string, decisions: Decision[]) {
    const usable = decisions.filter(
        (decision) => decision.candidates.filter((candidate) => candidate.tied).length >= 2
    )
    if (usable.length === 0) return
    const cells = (decision: Decision) =>
        decision.tiedCells ??
        new Set(
            decision.candidates
                .filter((candidate) => candidate.tied)
                .map((candidate) => `${candidate.cell.col},${candidate.cell.row}`)
        ).size
    const parts = (['cash', 'margin', 'win'] as Measure[]).map((measure) => {
        const rows = usable.map((decision) =>
            decision.candidates
                .filter((candidate) => candidate.tied)
                .map((candidate) => candidate[measure])
        )
        const component = mean(rows.map(varianceComponent))
        const spread = Math.sqrt(Math.max(0, component))
        const gain = mean(rows.map(lookAheadGain))
        const lowerGaps = usable.flatMap((decision) => {
            const lower = decision.candidates.find((candidate) => !candidate.tied)
            if (!lower) return []
            const tied = decision.candidates.filter((candidate) => candidate.tied)
            return [mean(tied.map((candidate) => mean(candidate[measure]))) - mean(lower[measure])]
        })
        const fmt = (value: number) =>
            measure === 'win' ? value.toFixed(3) : `$${value.toFixed(1)}`
        return `${fmt(spread)} ${fmt(gain)} ${lowerGaps.length ? fmt(mean(lowerGaps)) : '-'}`
    })
    const lowerScoreGap = mean(
        usable.flatMap((decision) => {
            const lower = decision.candidates.find((candidate) => !candidate.tied)
            return lower ? [decision.topScore - lower.score] : []
        })
    )
    console.log(
        [
            label,
            String(usable.length),
            mean(usable.map((decision) => decision.tiedCount)).toFixed(1),
            `${Math.round((100 * usable.filter((decision) => cells(decision) === 1).length) / usable.length)}%`,
            `${Math.round((100 * usable.filter((decision) => decision.topScore <= 0).length) / usable.length)}%`,
            ...parts,
            `$${lowerScoreGap.toFixed(1)}`
        ].join(' | ')
    )
}

const decisions: Decision[] = process.argv.slice(2).flatMap((file) =>
    readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Decision)
)
console.log(
    [
        'group',
        'decisions',
        'tied spots',
        'ties all in one cell',
        'tie at no income',
        'cash: real spread, look-ahead gain, tied vs lower',
        'margin: same',
        'win: same',
        'lower spot rated'
    ].join(' | ')
)
for (const players of [...new Set(decisions.map((decision) => decision.players))].sort()) {
    const mine = decisions.filter((decision) => decision.players === players)
    summarize(`${players}p all`, mine)
    for (const round of [1, 2, 3, 4, 5]) {
        summarize(
            `  round ${round}`,
            mine.filter((decision) => decision.round === round)
        )
    }
    summarize(
        '  tie at no income',
        mine.filter((decision) => decision.topScore <= 0)
    )
    summarize(
        '  tie with income',
        mine.filter((decision) => decision.topScore > 0)
    )
}
