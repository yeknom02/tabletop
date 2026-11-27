import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    Prng,
    shuffle,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    ConduitInfo,
    ConduitRuntime,
    Definition,
    MachineState,
    type ConduitGameState
} from '../../../src/index.js'
import { makeBot } from '../bots/catalog.js'
import type { Bot, Decision } from '../bots/bot.js'

// When is a game decided, and by what? Each seed plays one game. At the start of each round's
// bidding the position is kept, and the game is replayed from it to the end --conts times under
// two conditions:
// - reshuffle: the tiles still in the stack are shuffled again, and the bots get a new random
//   stream (tile luck plus the bots' own noise);
// - noise: the same stack order, with the same new random streams (the bots' noise alone).
// Continuation k uses the same random stream in both conditions, so they differ only by the stack.
// One JSON line per seed, round and condition: the original winners, the cash leaders when the
// position was kept, and each continuation's winners.
// Usage: tsx luckRollouts.ts --players 4 --seeds 1-200 --worker 0 --workers 15 --out f.jsonl
const { values } = parseArgs({
    options: {
        players: { type: 'string', default: '4' },
        seeds: { type: 'string', default: '1-10' },
        worker: { type: 'string', default: '0' },
        workers: { type: 'string', default: '1' },
        conts: { type: 'string', default: '10' },
        lineup: { type: 'string' },
        out: { type: 'string' }
    }
})
if (!values.out) throw Error('--out is required')
const players = Number(values.players)
const [first, last] = values.seeds.split('-').map(Number)
const worker = Number(values.worker)
const workers = Number(values.workers)
const conts = Number(values.conts)
const field = 'stacker{margin=1,expectMargin=1,mirror=true,maxExtra=2}'
const lineup = values.lineup
    ? (values.lineup.match(/[^,{]+(?:\{[^}]*\})?/g) ?? [])
    : Array.from({ length: players }, () => field)
if (lineup.length !== players) throw Error('--lineup must name one bot per player')
const playerIds = Array.from({ length: players }, (_, seat) => `s${seat}`)
const engine = new GameEngine(ConduitRuntime)

function start(seed: number) {
    const game = ConduitRuntime.initializer.initializeGame(
        {
            id: `sim-${seed}`,
            typeId: ConduitInfo.id,
            ownerId: 'sim',
            config: {},
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

let actionCount = 0
function step(game: Game, state: ConduitGameState, bots: Bot[], random: () => number) {
    const hydrated = hydrate(state)
    const playerId = hydrated.activePlayerIds[0]
    const seat = playerIds.indexOf(playerId)
    const context = {
        state: hydrated,
        playerId,
        random,
        canPassBid: hydrated.machineState === MachineState.Bidding && hydrated.canPassBid(playerId)
    }
    const choice =
        hydrated.machineState === MachineState.ChoosingRoutes
            ? hydrated.pendingRouteChoice()
            : undefined
    const decision: Decision = choice
        ? {
              type: ActionType.ChooseRoute,
              tileId: choice.tileId,
              route: choice.options[bots[seat].chooseRoute?.(context, choice) ?? 0].cells
          }
        : bots[seat].decide(context).decision
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

const winnersOf = (state: ConduitGameState) =>
    state.winningPlayerIds.map((id) => playerIds.indexOf(id))

function playOut(game: Game, from: ConduitGameState, random: () => number) {
    const bots = lineup.map(makeBot)
    let state = from
    for (let count = 0; state.machineState !== MachineState.EndOfGame; count++) {
        if (count > 5000) throw Error(`Game ${game.id} did not finish`)
        state = step(game, state, bots, random)
    }
    return winnersOf(state)
}

for (let seed = first; seed <= last; seed++) {
    if ((seed - first) % workers !== worker) continue
    const { game, state: initial } = start(seed)
    const bots = lineup.map(makeBot)
    const random = new Prng({ seed: seed * 7919 + 17, invocations: 0 }).random
    const kept: { round: number; state: ConduitGameState; leaders: number[] }[] = []
    let state = initial
    let lastRound = 0
    while (state.machineState !== MachineState.EndOfGame) {
        const hydrated = hydrate(state)
        if (hydrated.machineState === MachineState.Bidding && hydrated.round !== lastRound) {
            lastRound = hydrated.round
            const cash = playerIds.map((id) => hydrated.getPlayerState(id).cash)
            const top = Math.max(...cash)
            kept.push({
                round: hydrated.round,
                state: structuredClone(state),
                leaders: cash.flatMap((value, seat) => (value === top ? [seat] : []))
            })
        }
        state = step(game, state, bots, random)
    }
    const original = winnersOf(state)
    for (const { round, state: position, leaders } of kept) {
        for (const condition of ['reshuffle', 'noise'] as const) {
            const results: number[][] = []
            for (let k = 0; k < conts; k++) {
                const from = structuredClone(position)
                const stream = new Prng({
                    seed: seed * 1000003 + round * 101 + k + 1,
                    invocations: 0
                })
                if (condition === 'reshuffle') {
                    const deckRandom = new Prng({
                        seed: seed * 2000029 + round * 211 + k + 7,
                        invocations: 0
                    }).random
                    shuffle(from.deck.items, deckRandom)
                }
                results.push(playOut(game, from, stream.random))
            }
            appendFileSync(
                values.out,
                `${JSON.stringify({ seed, players, lineup, round, condition, original, leaders, conts: results })}\n`
            )
        }
    }
}
