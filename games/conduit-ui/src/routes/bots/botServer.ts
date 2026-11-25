// The bot server (tools/conduit-bots), proxied at /bots by the harness's dev server.
import type { Game, GameState, ScenarioData } from '@tabletop/common'
import { scenarioData } from '@tabletop/frontend-components'

export type Seats = Record<string, string>

export interface BotSpecs {
    specs: string[]
    preferred: string
}

export interface KeptRun {
    run: string
    games: number
}

export interface KeptGame {
    file: string
    players: number
    seed: number
    policies: Record<string, string>
    winners: string[]
    finalCash: Record<string, number>
    final: boolean
    playedAt: string
}

export interface BotMove {
    spec: string
    action: { type: string; playerId: string } & Record<string, unknown>
}

export interface BotGame {
    scenario: ScenarioData
    seats: Seats
    // In a game against bots, the seat the person plays.
    person?: string
}

export const BotServerCommand = 'pnpm --filter @tabletop/conduit-bots start'

export const botServer = {
    specs: () => request<BotSpecs>('specs'),
    runs: () => request<KeptRun[]>('runs'),
    games: (run: string) => request<KeptGame[]>(`games?run=${encodeURIComponent(run)}`),
    game: (file: string) => botGame(request(`game?file=${encodeURIComponent(file)}`)),
    play: (players: number, seed: number, seats: string[]) =>
        botGame(post('play', { players, seed, seats })),
    newGame: (players: number, seed: number, bot: string) =>
        botGame(post('new', { players, seed, bot })),
    move: (game: Game, state: GameState, seats: Seats) =>
        post<BotMove>('move', { game, state, seats })
}

async function botGame(
    response: Promise<{ scenario: unknown; seats: Seats; person?: string }>
): Promise<BotGame> {
    const { scenario, seats, person } = await response
    return { scenario: scenarioData(scenario), seats, ...(person ? { person } : {}) }
}

function post<T>(path: string, body: unknown): Promise<T> {
    return request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/bots/${path}`, init)
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`The bot server is not running; start it with ${BotServerCommand}`)
    }
    const body = await response.json()
    if (!response.ok) throw new Error(body.error ?? response.statusText)
    return body
}
