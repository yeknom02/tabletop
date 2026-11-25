import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
    extraCubeCostOf,
    marketDealOf,
    routeTargetOf,
    routeTollOf,
    marketSizeOf,
    biddingEndOf,
    emptyStationsOf,
    startPlayerRuleOf
} from '../../src/index.js'

// Plays a study: every seed with every rotation of the lineup (when --rotate), so each bot sits in
// every seat on the same deals. Rule flags default to the printed rules, v0.8.3 (batch scripts
// before batch 14 were written when the defaults were v0.8.2 and rely on them). Writes run.json and games-*.jsonl under the runs folder.
const { values } = parseArgs({
    options: {
        name: { type: 'string' },
        lineup: { type: 'string' },
        games: { type: 'string', default: '100' },
        'seed-start': { type: 'string', default: '1' },
        cubes: { type: 'string', default: '3' },
        route: { type: 'string', default: 'next' },
        'min-bids': { type: 'string', default: '2' },
        deal: { type: 'string', default: 'shuffled' },
        'cube-cost': { type: 'string', default: 'rising' },
        cash: { type: 'string', default: '5' },
        toll: { type: 'string', default: 'flat' },
        'cash-step': { type: 'string', default: '0' },
        market: { type: 'string', default: 'smallFirst' },
        'bid-end': { type: 'string', default: 'passAfterOwn' },
        'base-price': { type: 'string', default: '1' },
        'cube-cap': { type: 'string', default: '4' },
        'track-spaces': { type: 'string', default: '9' },
        'empty-stations': { type: 'string', default: 'linger' },
        start: { type: 'string', default: 'clockwise' },
        rotate: { type: 'boolean', default: false },
        workers: { type: 'string', default: '12' },
        purpose: { type: 'string', default: '' }
    }
})
if (!values.name || !values.lineup) throw Error('--name and --lineup are required')
if (routeTargetOf({ routeTarget: values.route }) !== values.route) throw Error('--route: same|next')
if (marketDealOf({ marketDeal: values.deal }) !== values.deal) throw Error('--deal: cycle|shuffled')
if (extraCubeCostOf({ extraCubeCost: values['cube-cost'] }) !== values['cube-cost'])
    throw Error('--cube-cost: free|rising|flat')
if (marketSizeOf({ marketSize: values.market }) !== values.market)
    throw Error('--market: smallFirst|plusOne|players')
if (routeTollOf({ routeToll: values.toll }) !== values.toll) throw Error('--toll: none|flat')
if (biddingEndOf({ biddingEnd: values['bid-end'] }) !== values['bid-end'])
    throw Error('--bid-end: minimum|allPass|passAfterOwn')
if (emptyStationsOf({ emptyStations: values['empty-stations'] }) !== values['empty-stations'])
    throw Error('--empty-stations: atOnce|linger')
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
            extraCubeCost: values['cube-cost'],
            startingCash: Number(values.cash),
            routeToll: values.toll,
            startingCashStep: Number(values['cash-step']),
            marketSize: values.market,
            biddingEnd: values['bid-end'],
            basePrice: Number(values['base-price']),
            ...(values['cube-cap'] ? { stationCubeCap: Number(values['cube-cap']) } : {}),
            trackSpaces: Number(values['track-spaces']),
            emptyStations: values['empty-stations'],
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
            marketDeal: values.deal,
            extraCubeCost: values['cube-cost'],
            startingCash: Number(values.cash),
            routeToll: values.toll,
            startingCashStep: Number(values['cash-step']),
            marketSize: values.market,
            biddingEnd: values['bid-end'],
            basePrice: Number(values['base-price']),
            ...(values['cube-cap'] ? { stationCubeCap: Number(values['cube-cap']) } : {}),
            trackSpaces: Number(values['track-spaces']),
            emptyStations: values['empty-stations']
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
