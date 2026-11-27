import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { ActionSource, GameEngine, PlayerStatus, Prng, type GameAction } from '@tabletop/common'
import {
    ActionType,
    ConduitInfo,
    ConduitRuntime,
    Definition,
    MachineState,
    type ConduitGameState
} from '../../../src/index.js'
import { makeBot } from '../bots/catalog.js'
import type { Decision } from '../bots/bot.js'

// How many blocking markers a game needs on the table at once: the closed connections (Central
// Station's four included) after every action. One JSON line per game: the peak, when it came,
// and the count at the end. Usage: tsx blockingMarkers.ts --players 4 --seeds 1-100 --out f.jsonl
const { values } = parseArgs({
    options: {
        players: { type: 'string', default: '4' },
        seeds: { type: 'string', default: '1-10' },
        bot: { type: 'string', default: 'stacker{margin=1,expectMargin=1,mirror=true,maxExtra=2}' },
        out: { type: 'string' }
    }
})
if (!values.out) throw Error('--out is required')
const players = Number(values.players)
const [first, last] = values.seeds.split('-').map(Number)
const playerIds = Array.from({ length: players }, (_, seat) => `s${seat}`)
const engine = new GameEngine(ConduitRuntime)

for (let seed = first; seed <= last; seed++) {
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
    const started = engine.startGame(game, {
        masterSeed: seed.toString(16).padStart(32, '0'),
        startingPositions: { playerIds }
    })
    let state = started.initialState as ConduitGameState
    const bots = playerIds.map(() => makeBot(values.bot as string))
    const random = new Prng({ seed: seed * 7919 + 17, invocations: 0 }).random
    let peak = 0
    let peakRound = 0
    let count = 0
    const byRoundEnd: number[] = []
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        const hydrated = ConduitRuntime.hydrator.hydrateState(structuredClone(state))
        count = hydrated.grid().closedConnections().length
        if (count > peak) {
            peak = count
            peakRound = hydrated.round
        }
        const playerId = hydrated.activePlayerIds[0]
        const seat = playerIds.indexOf(playerId)
        const context = {
            state: hydrated,
            playerId,
            random,
            canPassBid:
                hydrated.machineState === MachineState.Bidding && hydrated.canPassBid(playerId)
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
            id: `${seed}-${step}`,
            gameId: started.startedGame.id,
            playerId,
            source: ActionSource.User,
            type,
            ...payload
        }
        const result = engine.executeAction({ game: started.startedGame, state, action })
        state = result.updatedState as ConduitGameState
        if (
            result.processedActions.some(
                (processed) =>
                    processed.type === ActionType.LoseInfrastructure &&
                    (processed.metadata as { roundEnded?: boolean } | undefined)?.roundEnded
            )
        ) {
            byRoundEnd.push(
                ConduitRuntime.hydrator
                    .hydrateState(structuredClone(state))
                    .grid()
                    .closedConnections().length
            )
        }
    }
    const final = ConduitRuntime.hydrator
        .hydrateState(structuredClone(state))
        .grid()
        .closedConnections().length
    appendFileSync(
        values.out,
        `${JSON.stringify({ seed, players, peak, peakRound, final, byRoundEnd })}\n`
    )
}
