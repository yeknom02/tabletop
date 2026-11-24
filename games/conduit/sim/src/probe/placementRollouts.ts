import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    Prng,
    shuffle,
    type GameAction
} from '@tabletop/common'
import {
    BiddingEnd,
    ConduitInfo,
    ConduitRuntime,
    Definition,
    extraCubeCostOf,
    MachineState,
    MarketDeal,
    MarketSize,
    RouteTarget,
    RouteToll,
    StartPlayerRule,
    type ConduitGameState
} from '../../../src/index.js'
import { makeBot } from '../bots/catalog.js'
import { BalancedHabits } from '../bots/habitBot.js'
import type { Bot, Decision } from '../bots/bot.js'
import { placementEffects } from '../bots/evaluate.js'

// Does a placement the bots see as tied really not matter? For each seed, one face-up placement
// whose best spots tie by the bots' immediate measure is picked at random. The game is then
// played to the end from each of up to --cands tied spots (and one spot the bots rate lower, for
// scale), --conts times each. Every spot uses the same continuations: continuation r reshuffles
// the unseen stack the same way and gives the bots the same random stream. The placing seat's
// final cash and wins are written per spot and continuation, one JSON line per decision.
// Setup (d): flat $5, 3 cubes, one shuffled stack, bid until all pass, $1 base price, cap 3.
// Usage: tsx placementRollouts.ts --players 4 --seeds 1-200 --worker 0 --workers 15 --out f.jsonl
const { values } = parseArgs({
    options: {
        players: { type: 'string', default: '4' },
        seeds: { type: 'string', default: '1-10' },
        worker: { type: 'string', default: '0' },
        workers: { type: 'string', default: '1' },
        cands: { type: 'string', default: '4' },
        conts: { type: 'string', default: '12' },
        'cube-cost': { type: 'string', default: 'free' },
        'cube-cap': { type: 'string', default: '3' },
        spec: { type: 'string', default: 'stacker{margin=1,expectMargin=1,mirror=true}' },
        out: { type: 'string' }
    }
})
if (!values.out) throw Error('--out is required')
const players = Number(values.players)
const [first, last] = values.seeds.split('-').map(Number)
const worker = Number(values.worker)
const workers = Number(values.workers)
const maxCands = Number(values.cands)
const conts = Number(values.conts)
const extraCubeCost = extraCubeCostOf({ extraCubeCost: values['cube-cost'] })
const stationCubeCap = Number(values['cube-cap'])
const variant = {
    cubesPerRound: 3,
    routeTarget: RouteTarget.NextLetter,
    startPlayer: StartPlayerRule.Clockwise,
    minimumBids: 2,
    marketDeal: MarketDeal.Shuffled,
    routeToll: RouteToll.Flat,
    marketSize: MarketSize.SmallFirst,
    biddingEnd: BiddingEnd.AllPass,
    basePrice: 1
}
const playerIds = Array.from({ length: players }, (_, seat) => `s${seat}`)
const engine = new GameEngine(ConduitRuntime)

function start(seed: number) {
    const game = ConduitRuntime.initializer.initializeGame(
        {
            id: `sim-${seed}`,
            typeId: ConduitInfo.id,
            ownerId: 'sim',
            config: normalizeGameConfig({
                ...defaultGameConfig(ConduitInfo.configurator?.options ?? []),
                cubesPerRound: String(variant.cubesPerRound),
                routeTarget: variant.routeTarget,
                startPlayer: variant.startPlayer,
                minimumBids: String(variant.minimumBids),
                marketDeal: variant.marketDeal,
                extraCubeCost,
                startingCashStep: '0',
                routeToll: variant.routeToll,
                marketSize: variant.marketSize,
                biddingEnd: variant.biddingEnd,
                basePrice: String(variant.basePrice),
                stationCubeCap: String(stationCubeCap)
            }),
            players: playerIds.map((id) => ({
                id,
                name: id,
                isHuman: false,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const masterSeed = seed.toString(16).padStart(32, '0')
    const started = engine.startGame(game, { masterSeed, startingPositions: { playerIds } })
    return { game: started.startedGame, state: started.initialState as ConduitGameState }
}

type Game = ReturnType<typeof start>['game']
const hydrate = (state: ConduitGameState) =>
    ConduitRuntime.hydrator.hydrateState(structuredClone(state))

function decide(bots: Bot[], state: ConduitGameState, random: () => number) {
    const hydrated = hydrate(state)
    const playerId = hydrated.activePlayerIds[0]
    const seat = playerIds.indexOf(playerId)
    const out = bots[seat].decide({
        state: hydrated,
        playerId,
        random,
        cubesPerRound: variant.cubesPerRound,
        routeTarget: variant.routeTarget,
        marketDeal: variant.marketDeal,
        extraCubeCost,
        routeToll: variant.routeToll,
        marketSize: variant.marketSize,
        canPassBid:
            hydrated.machineState === MachineState.Bidding &&
            hydrated.canPassBid(playerId, variant.minimumBids, variant.biddingEnd),
        stationCubeCap
    })
    return { hydrated, playerId, seat, ...out }
}

let actionCount = 0
function execute(game: Game, state: ConduitGameState, playerId: string, decision: Decision) {
    const { type, ...payload } = decision
    const action: GameAction = {
        id: `a${actionCount++}`,
        gameId: game.id,
        playerId,
        source: ActionSource.User,
        type,
        ...payload
    }
    return engine.executeAction({ game, state, action }).updatedState as ConduitGameState
}

const fieldBots = () => playerIds.map(() => makeBot(values.spec as string))
const isTiedPlacement = (
    hydrated: ReturnType<typeof hydrate>,
    note: { options: number; best?: number; second?: number } | undefined
) =>
    hydrated.machineState === MachineState.Placing &&
    hydrated.pendingPlacement()?.faceUp === true &&
    note !== undefined &&
    note.options > 1 &&
    note.best === note.second

function playOut(game: Game, state: ConduitGameState, random: () => number) {
    const bots = fieldBots()
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        if (step > 5000) throw Error('Rollout did not finish')
        const { playerId, decision } = decide(bots, state, random)
        state = execute(game, state, playerId, decision)
    }
    return state
}

for (let seed = first; seed <= last; seed++) {
    if ((seed - first) % workers !== worker) continue
    // Pass 1: the whole game, noting every tied face-up placement.
    let { game, state } = start(seed)
    let bots = fieldBots()
    let random = new Prng({ seed: seed * 7919 + 17, invocations: 0 }).random
    const tiedSteps: number[] = []
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        const { hydrated, playerId, decision, note } = decide(bots, state, random)
        if (isTiedPlacement(hydrated, note)) tiedSteps.push(step)
        state = execute(game, state, playerId, decision)
    }
    if (tiedSteps.length === 0) continue
    const pick = new Prng({ seed: seed * 31 + 5, invocations: 0 }).random
    const target = tiedSteps[Math.floor(pick() * tiedSteps.length)]

    // Pass 2: replay to the chosen placement.
    ;({ game, state } = start(seed))
    bots = fieldBots()
    random = new Prng({ seed: seed * 7919 + 17, invocations: 0 }).random
    for (let step = 0; step < target; step++) {
        const { playerId, decision } = decide(bots, state, random)
        state = execute(game, state, playerId, decision)
    }
    const { hydrated, playerId, seat, decision, note } = decide(bots, state, random)
    if (!isTiedPlacement(hydrated, note) || decision.type !== 'placeTile') {
        throw Error(`Seed ${seed}: replay diverged at step ${target}`)
    }
    const placement = hydrated.pendingPlacement()
    if (!placement) throw Error('No pending placement')
    const scored = placementEffects(
        hydrated,
        placement.tileId,
        true,
        playerId,
        variant.routeTarget,
        variant.routeToll
    ).map((effect) => {
        let others = 0
        for (const [id, gain] of effect.gain) if (id !== playerId) others += gain
        const own = effect.gain.get(playerId) ?? 0
        return { effect, own, score: own - BalancedHabits.block * others }
    })
    const top = Math.max(...scored.map((entry) => entry.score))
    const tied = scored.filter((entry) => entry.score === top)
    const lower = scored.filter((entry) => entry.score < top)
    shuffle(tied, pick)
    const chosen = tied.slice(0, maxCands).map((entry) => ({ ...entry, tied: true }))
    if (lower.length > 0) {
        chosen.push({ ...lower[Math.floor(pick() * lower.length)], tied: false })
    }

    const candidates = chosen.map((entry) => {
        const cash: number[] = []
        const margin: number[] = []
        const win: number[] = []
        for (let r = 0; r < conts; r++) {
            let branch = execute(game, structuredClone(state), playerId, {
                ...decision,
                cell: entry.effect.choice.cell,
                rotation: entry.effect.choice.rotation
            })
            if (branch.deck) {
                branch = structuredClone(branch)
                const deck = branch.deck
                if (!deck) throw Error('No deck')
                const unseen = deck.items.slice(0, deck.remaining)
                shuffle(unseen, new Prng({ seed: seed * 1000 + r, invocations: 0 }).random)
                deck.items = unseen
            }
            const end = playOut(
                game,
                branch,
                new Prng({ seed: seed * 100003 + r * 7 + 1, invocations: 0 }).random
            )
            const final = playerIds.map(
                (id) => end.players.find((player) => player.playerId === id)?.cash ?? 0
            )
            const winners = end.winningPlayerIds
            cash.push(final[seat])
            margin.push(final[seat] - Math.max(...final.filter((_, other) => other !== seat)))
            win.push(winners.includes(playerId) ? 1 / winners.length : 0)
        }
        return {
            cell: entry.effect.choice.cell,
            rotation: entry.effect.choice.rotation,
            tied: entry.tied,
            score: entry.score,
            own: entry.own,
            stationPayout: entry.effect.stationPayout,
            cash,
            margin,
            win
        }
    })
    appendFileSync(
        values.out,
        JSON.stringify({
            seed,
            players,
            round: hydrated.round,
            seat,
            extraCubes: decision.extraCubes,
            options: scored.length,
            tiedCount: tied.length,
            tiedCells: new Set(
                tied.map(
                    (entry) => `${entry.effect.choice.cell.col},${entry.effect.choice.cell.row}`
                )
            ).size,
            topScore: top,
            candidates
        }) + '\n'
    )
}
