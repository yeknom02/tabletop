import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Game, GameAction, GameState } from '@tabletop/common'
import { botFor, botMove, seededRandom } from './bots.ts'
import { activePlayerId, applyMove, hydrate, isOver, newTable, type Table } from './table.ts'

export type Seats = Record<string, string>

export type KeptSummary = {
    players: number
    seed: number
    policies: Seats
    winners: string[]
    finalCash: Record<string, number>
    final: boolean
    playedAt: string
}

export type KeptGame = {
    scenario: { game: Game; state: GameState; actions: GameAction[] }
    seats: Seats
    summary: KeptSummary
}

// Kept bot games, one folder per run, one JSON file per game holding its whole action history.
// The harness opens a file as a scenario, so the history and Undo work there.
export const KeptRoot = resolve(
    process.env.CONDUIT_BOT_GAMES ??
        fileURLToPath(new URL('../../../tmp/conduit/bot-games', import.meta.url))
)

export const HarnessRun = 'harness'

// Seats are named by seat, repeated round the table: ["random@v1"] seats every player with it.
export function seatsFor(players: number, specs: string[]): Seats {
    if (specs.length === 0) throw new Error('Name at least one bot')
    for (const spec of specs) botFor(spec)
    return Object.fromEntries(
        Array.from({ length: players }, (_, seat) => [`p${seat}`, specs[seat % specs.length]])
    )
}

// Plays a whole game, every move a bot's, each through the engine. The seed deals the game and
// drives the bots, so the same seed and seats replay the same game.
export function playGame(players: number, seed: number, specs: string[]): KeptGame {
    if (players < 3 || players > 5) throw new Error('Conduit takes 3 to 5 players')
    const seats = seatsFor(players, specs)
    let table: Table = newTable(players, seed, Object.values(seats))
    const random = seededRandom(seed * 7919 + 17)
    for (let step = 0; !isOver(table.state); step++) {
        if (step > 5000) throw new Error(`Game ${seed} did not finish`)
        const playerId = activePlayerId(table.state)
        if (!playerId) throw new Error('No one is to move')
        table = applyMove(table, botMove(table.game, table.state, seats[playerId], random))
    }
    return keepable(table, seats, seed)
}

function keepable(table: Table, seats: Seats, seed: number): KeptGame {
    const state = hydrate(table.state)
    const nameOf = (playerId: string) =>
        table.game.players.find((player) => player.id === playerId)?.name ?? playerId
    return {
        scenario: { game: table.game, state: table.state, actions: table.actions },
        seats,
        summary: {
            players: table.game.players.length,
            seed,
            policies: seats,
            winners: state.winningPlayerIds.map(nameOf),
            finalCash: Object.fromEntries(
                state.players.map((player) => [player.playerId, player.cash])
            ),
            final: isOver(table.state),
            playedAt: new Date().toISOString()
        }
    }
}

export function keepGame(run: string, kept: KeptGame): string {
    const dir = runDir(run)
    mkdirSync(dir, { recursive: true })
    const specs = [...new Set(Object.values(kept.seats))]
        .join('+')
        .replaceAll(/[^a-z0-9+.-]/gi, '_')
    const file = `${kept.summary.players}p-${kept.summary.seed}-${specs}-${Date.now().toString(36)}.json`
    writeFileSync(join(dir, file), `${JSON.stringify(kept)}\n`)
    return `${run}/${file}`
}

export function keptRuns(): { run: string; games: number }[] {
    let runs: string[]
    try {
        runs = readdirSync(KeptRoot).filter((name) => statSync(join(KeptRoot, name)).isDirectory())
    } catch {
        return []
    }
    return runs
        .map((run) => ({
            run,
            games: readdirSync(join(KeptRoot, run)).filter((name) => name.endsWith('.json')).length,
            changed: statSync(join(KeptRoot, run)).mtimeMs
        }))
        .toSorted((a, b) => b.changed - a.changed)
        .map(({ run, games }) => ({ run, games }))
}

export function keptGames(run: string): (KeptSummary & { file: string })[] {
    const dir = runDir(run)
    return readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => ({ name, changed: statSync(join(dir, name)).mtimeMs }))
        .toSorted((a, b) => b.changed - a.changed)
        .map(({ name }) => ({ file: `${run}/${name}`, ...readKept(`${run}/${name}`).summary }))
}

export function readKept(file: string): KeptGame {
    const [run, name, ...rest] = file.split('/')
    if (!run || !name || rest.length > 0 || basename(name) !== name || !name.endsWith('.json')) {
        throw new Error(`No kept game ${file}`)
    }
    return JSON.parse(readFileSync(join(runDir(run), name), 'utf8'))
}

function runDir(run: string): string {
    if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(run)) throw new Error(`Bad run name ${run}`)
    return join(KeptRoot, run)
}
