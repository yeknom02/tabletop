import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { marketDealOf, routeTargetOf, startPlayerRuleOf } from '../../src/index.js'

// Plays a study: every seed with every rotation of the lineup (when --rotate), so each bot sits in
// every seat on the same deals. Writes run.json and games-*.jsonl under the runs folder.
const { values } = parseArgs({
    options: {
        name: { type: 'string' },
        lineup: { type: 'string' },
        games: { type: 'string', default: '100' },
        'seed-start': { type: 'string', default: '1' },
        cubes: { type: 'string', default: '2' },
        route: { type: 'string', default: 'same' },
        'min-bids': { type: 'string', default: '2' },
        deal: { type: 'string', default: 'cycle' },
        start: { type: 'string', default: 'clockwise' },
        rotate: { type: 'boolean', default: false },
        workers: { type: 'string', default: '12' },
        purpose: { type: 'string', default: '' }
    }
})
if (!values.name || !values.lineup) throw Error('--name and --lineup are required')
if (routeTargetOf({ routeTarget: values.route }) !== values.route) throw Error('--route: same|next')
if (marketDealOf({ marketDeal: values.deal }) !== values.deal) throw Error('--deal: cycle|shuffled')
if (startPlayerRuleOf({ startPlayer: values.start }) !== values.start)
    throw Error('--start: clockwise|richest')

const RunsRoot = '/workspace/tmp/conduit/runs'
const dir = join(RunsRoot, values.name)
if (existsSync(dir)) throw Error(`${dir} exists; pick a new --name`)
mkdirSync(dir, { recursive: true })

// Bot specs may hold commas inside their braces, so split only on commas outside them.
const lineup = values.lineup.match(/[^,{]+(?:\{[^}]*\})?/g) ?? []
const lineups = values.rotate
    ? lineup.map((_, offset) => [...lineup.slice(offset), ...lineup.slice(0, offset)])
    : [lineup]
const seedStart = Number(values['seed-start'])
const seeds = Array.from({ length: Number(values.games) }, (_, index) => seedStart + index)
const workers = Math.min(Number(values.workers), seeds.length)
const git = (args: string[]) =>
    execFileSync('git', ['-C', '/workspace', ...args], { encoding: 'utf8' }).trim()

writeFileSync(
    join(dir, 'run.json'),
    JSON.stringify(
        {
            name: values.name,
            purpose: values.purpose,
            lineup,
            rotate: values.rotate,
            seeds: [seeds[0], seeds.at(-1)],
            gamesPerSeed: lineups.length,
            cubesPerRound: Number(values.cubes),
            routeTarget: values.route,
            startPlayer: values.start,
            minimumBids: Number(values['min-bids']),
            marketDeal: values.deal,
            commit: git(['rev-parse', 'HEAD']),
            dirty: git(['status', '--porcelain', '--', 'games/conduit']) !== '',
            startedAt: new Date().toISOString()
        },
        null,
        2
    )
)

const started = Date.now()
const runs = Array.from({ length: workers }, (_, worker) => {
    const job = {
        out: join(dir, `games-${worker}.jsonl`),
        lineups,
        seeds: seeds.filter((_, index) => index % workers === worker),
        variant: {
            cubesPerRound: Number(values.cubes),
            routeTarget: values.route,
            startPlayer: values.start,
            minimumBids: Number(values['min-bids']),
            marketDeal: values.deal
        }
    }
    return new Promise<void>((resolve, reject) => {
        const child = spawn(
            '/workspace/node_modules/.bin/tsx',
            [new URL('./worker.ts', import.meta.url).pathname, JSON.stringify(job)],
            { stdio: ['ignore', 'inherit', 'inherit'] }
        )
        child.on('exit', (code) =>
            code === 0 ? resolve() : reject(Error(`worker ${worker} exited ${code}`))
        )
    })
})
await Promise.all(runs)
console.log(
    `${values.name}: ${seeds.length * lineups.length} games in ${((Date.now() - started) / 1000).toFixed(0)} s`
)
