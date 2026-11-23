import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    Prng,
    type GameAction
} from '@tabletop/common'
import {
    ConduitInfo,
    ConduitRuntime,
    Definition,
    isBuyTile,
    isLoseInfrastructure,
    isPassTile,
    isFillMarket,
    isPayRevenue,
    isPlaceBid,
    isPlaceTile,
    MachineState,
    stationTile,
    type ExtraCubeCost,
    type MarketDeal,
    type RouteTarget,
    type StartPlayerRule
} from '../../src/index.js'
import type { Bot, DecisionNote } from './bots/bot.js'

export type NotedDecision = DecisionNote & { round: number; seat: number }

// One game, compact enough to keep thousands. Every per-player list is indexed by seat, seat 0
// being the first round's Start Player.
export type GameRecord = {
    seed: number
    players: number
    cubesPerRound: number
    routeTarget: RouteTarget
    startPlayer: StartPlayerRule
    minimumBids: number
    marketDeal: MarketDeal
    extraCubeCost: ExtraCubeCost
    startingCash: number
    bots: string[]
    // The letters dealt to each round's market, in order.
    markets: string[][]
    finalCash: number[]
    finalSupply: number[]
    winners: number[]
    cashAfterRound: number[][]
    supplyAtRoundStart: number[][]
    payoutRoundsAfterLast: number
    unboughtByRound: number[]
    bids: number[]
    buys: { round: number; seat: number; price: number; letter: string; payout: number }[]
    passes: number[]
    offers: (NotedDecision & { price: number; bought: boolean })[]
    placements: (NotedDecision & { faceUp: boolean; extraCubes: number })[]
    revenues: { round: number; seat: number; letter: string; amount: number; stations: number }[]
    steps: number
}

export type Variant = {
    cubesPerRound: number
    routeTarget: RouteTarget
    startPlayer: StartPlayerRule
    minimumBids: number
    marketDeal: MarketDeal
    extraCubeCost: ExtraCubeCost
    // Starting cash; the rules' $5 when absent.
    startingCash?: number
}

export function playGame({
    seed,
    bots,
    variant
}: {
    seed: number
    bots: Bot[]
    variant: Variant
}): GameRecord {
    const { cubesPerRound, routeTarget, startPlayer, minimumBids, marketDeal, extraCubeCost } =
        variant
    const players = bots.length
    const playerIds = bots.map((_, seat) => `s${seat}`)
    const engine = new GameEngine(ConduitRuntime)
    const game = ConduitRuntime.initializer.initializeGame(
        {
            id: `sim-${seed}`,
            typeId: ConduitInfo.id,
            ownerId: 'sim',
            config: normalizeGameConfig({
                ...defaultGameConfig(ConduitInfo.configurator?.options ?? []),
                cubesPerRound: String(cubesPerRound),
                routeTarget,
                startPlayer,
                minimumBids: String(minimumBids),
                marketDeal,
                extraCubeCost,
                ...(variant.startingCash === undefined
                    ? {}
                    : { startingCash: String(variant.startingCash) })
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
    let state = started.initialState
    const random = new Prng({ seed: seed * 7919 + 17, invocations: 0 }).random
    const seatOf = (playerId: string | undefined) => playerIds.indexOf(playerId ?? '')
    const record: GameRecord = {
        seed,
        players,
        cubesPerRound,
        routeTarget,
        startPlayer,
        minimumBids,
        marketDeal,
        extraCubeCost,
        startingCash: variant.startingCash ?? 5,
        bots: bots.map((bot) => bot.name),
        markets: [],
        finalCash: [],
        finalSupply: [],
        winners: [],
        cashAfterRound: [],
        supplyAtRoundStart: [],
        payoutRoundsAfterLast: 0,
        unboughtByRound: [],
        bids: playerIds.map(() => 0),
        buys: [],
        passes: playerIds.map(() => 0),
        offers: [],
        placements: [],
        revenues: [],
        steps: 0
    }
    // The first market is dealt during setup, not by an action.
    record.markets.push(
        state.market.flatMap((slot) =>
            slot.tileId === undefined ? [] : [stationTile(slot.tileId).letter]
        )
    )
    const seatValues = (pick: (player: { cash: number; supply: number }) => number) =>
        playerIds.map((id) =>
            pick(state.players.find((player) => player.playerId === id) ?? { cash: 0, supply: 0 })
        )
    let lastRoundSeen = 0
    let roundsEnded = 0

    const observe = (actions: GameAction[]) => {
        const hydrated = ConduitRuntime.hydrator.hydrateState(structuredClone(state))
        for (const action of actions) {
            if (isFillMarket(action) && action.metadata) {
                record.markets.push(action.metadata.tileIds.map((id) => stationTile(id).letter))
            }
            if (isPlaceBid(action)) record.bids[seatOf(action.playerId)] += 1
            if (isPassTile(action)) record.passes[seatOf(action.playerId)] += 1
            if (isPayRevenue(action) && action.metadata) {
                if (roundsEnded >= 5) record.payoutRoundsAfterLast += 1
                for (const revenue of action.metadata.revenues) {
                    record.revenues.push({
                        round:
                            hydrated.round + (roundsEnded >= 5 ? record.payoutRoundsAfterLast : 0),
                        seat: seatOf(revenue.playerId),
                        letter: stationTile(revenue.tileId).letter,
                        amount: revenue.amount,
                        stations: revenue.amount > 0 ? revenue.amount - 1 : 0
                    })
                }
            }
            if (isLoseInfrastructure(action) && action.metadata?.roundEnded) {
                roundsEnded += 1
                record.cashAfterRound.push(seatValues((player) => player.cash))
            }
        }
        if (hydrated.round !== lastRoundSeen && hydrated.machineState === MachineState.Bidding) {
            lastRoundSeen = hydrated.round
            record.supplyAtRoundStart.push(seatValues((player) => player.supply))
        }
    }

    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        if (step > 5000) throw Error(`Game ${seed} did not finish`)
        const playerId = state.activePlayerIds[0]
        const seat = seatOf(playerId)
        const hydrated = ConduitRuntime.hydrator.hydrateState(structuredClone(state))
        const round = hydrated.round
        const { decision, note } = bots[seat].decide({
            state: hydrated,
            playerId,
            random,
            cubesPerRound,
            routeTarget,
            marketDeal,
            extraCubeCost
        })
        if (hydrated.machineState === MachineState.Offering) {
            const offer = hydrated.currentOffer()
            record.offers.push({
                ...(note ?? { options: 2 }),
                round,
                seat,
                price: offer?.price ?? 0,
                bought: decision.type === 'buyTile'
            })
        }
        if (hydrated.machineState === MachineState.Placing && decision.type === 'placeTile') {
            record.placements.push({
                ...(note ?? { options: 0 }),
                round,
                seat,
                faceUp: hydrated.pendingPlacement()?.faceUp ?? false,
                extraCubes: decision.extraCubes
            })
        }
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
        state = result.updatedState
        for (const processed of result.processedActions) {
            if (isBuyTile(processed) && processed.metadata) {
                record.buys.push({
                    round,
                    seat,
                    price: processed.metadata.price,
                    letter: stationTile(processed.metadata.tileId).letter,
                    payout: 0
                })
            }
            if (isPlaceTile(processed) && processed.metadata && !processed.metadata.faceUp) {
                record.unboughtByRound[round - 1] = (record.unboughtByRound[round - 1] ?? 0) + 1
            }
        }
        observe(result.processedActions)
        record.steps = step + 1
    }
    record.finalCash = seatValues((player) => player.cash)
    record.finalSupply = seatValues((player) => player.supply)
    record.winners = state.winningPlayerIds.map((id) => seatOf(id))
    return record
}
