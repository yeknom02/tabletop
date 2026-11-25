import { Prng, type Game, type GameState, type RandomFunction } from '@tabletop/common'
import { ConduitRuntime, type HydratedConduitGameState } from '@tabletop/conduit'
import { hydrate, legalMoves, type BotAction, type Move } from './table.ts'
import type { ActionType } from '@tabletop/conduit'
import { humanBot } from './human.ts'

// What a bot knows when it chooses: the table as its player sees it (hidden tiles stay hidden),
// every legal move by action type, and a seeded random stream.
export type Choice = {
    game: Game
    view: HydratedConduitGameState
    playerId: string
    moves: Map<ActionType, Move[]>
    random: RandomFunction
}

export type Bot = {
    // Name and version, as seats name it: "random@v1". A changed habit is a new version.
    spec: string
    describe: string
    choose(choice: Choice): Move
}

function pick<T>(items: readonly T[], random: RandomFunction): T {
    return items[Math.floor(random() * items.length)]
}

// Any legal move: first an action type the player may take, then one of its legal moves, each
// uniformly at random.
const randomV1: Bot = {
    spec: 'random@v1',
    describe: 'Picks an action type the player may take, then one of its legal moves, at random',
    choose({ moves, random }) {
        const type = pick([...moves.keys()], random)
        return pick(moves.get(type) ?? [], random)
    }
}

// Human-like bots, each version one habit more than the last.
const humans: Bot[] = [
    humanBot(
        1,
        ['buy'],
        'Buys a tile only when it is worth $1 more than the price; otherwise random'
    ),
    humanBot(
        2,
        ['buy', 'place'],
        'human@v1, and places where the station earns most now (extra cubes still random)'
    ),
    humanBot(
        3,
        ['buy', 'place', 'bid'],
        'human@v2, and bids for value or under a likely buyer for $1, passing when nothing is worth a cube'
    ),
    humanBot(
        4,
        ['buy', 'place', 'bid', 'extras'],
        "human@v3, and adds each extra cube only while its payout beats its price, keeping cubes for next round's bids"
    ),
    humanBot(
        5,
        ['buy', 'place', 'bid', 'extras', 'block'],
        'human@v4, and counts what a placement gives the other players against it'
    )
]

export const Bots: Bot[] = [randomV1, ...humans]

export const PreferredBot = randomV1.spec

export function botFor(spec: string): Bot {
    const bot = Bots.find((candidate) => candidate.spec === spec)
    if (!bot)
        throw new Error(`No bot ${spec}; known: ${Bots.map((known) => known.spec).join(', ')}`)
    return bot
}

// A seed for one decision, from the game and the position, so the same bot in the same position
// always makes the same move.
export function decisionSeed(gameId: string, actionCount: number, playerId: string): number {
    let hash = 2166136261
    for (const char of `${gameId}:${actionCount}:${playerId}`) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0
    }
    return hash
}

export function seededRandom(seed: number): RandomFunction {
    return new Prng({ seed, invocations: 0 }).random
}

// The active player's bot chooses a move, seeing only what that player may see.
export function botMove(
    game: Game,
    state: GameState,
    spec: string,
    random?: RandomFunction
): BotAction {
    const playerId = state.activePlayerIds[0]
    if (!playerId) throw new Error('No one is to move')
    const moves = legalMoves(game, state, playerId)
    if (moves.size === 0) throw new Error(`${playerId} has no legal move`)
    const projected = ConduitRuntime.visibility?.state.project(
        state as never,
        { kind: 'player', playerId },
        { config: game.config }
    )
    const view = hydrate((projected ?? state) as GameState)
    const move = botFor(spec).choose({
        game,
        view,
        playerId,
        moves,
        random: random ?? seededRandom(decisionSeed(game.id, state.actionCount, playerId))
    })
    return { ...move, playerId }
}
