import { appendFileSync } from 'node:fs'
import { makeBot } from './bots/catalog.js'
import { playGame, type Variant } from './game.js'

// Plays its share of the run's games and appends one JSON line per game.
type Job = { out: string; lineups: string[][]; seeds: number[]; variant: Variant }

const job: Job = JSON.parse(process.argv[2])
for (const seed of job.seeds) {
    for (const lineup of job.lineups) {
        const record = playGame({ seed, bots: lineup.map(makeBot), variant: job.variant })
        appendFileSync(job.out, `${JSON.stringify(record)}\n`)
    }
}
