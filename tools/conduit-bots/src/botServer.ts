import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Game, GameState } from '@tabletop/common'
import { Bots, botMove, PreferredBot } from './bots.ts'
import { HarnessRun, keepGame, keptGames, keptRuns, KeptRoot, playGame, readKept } from './play.ts'
import { checkMove } from './table.ts'
import type { Seats } from './play.ts'

// Serves Conduit's bots to the dev harness, which proxies /bots here.
//   GET  specs            the bots, and the one seats start with
//   POST move             { game, state, seats }: the active player's bot's move, checked by the
//                         engine; the harness applies it through the engine like a player's
//   POST play             { players, seed, seats }: plays a whole bot game and keeps it
//   GET  runs             the runs of kept games
//   GET  games?run=       the kept games of a run
//   GET  game?file=       one kept game, as a scenario the harness can open
const Port = Number(process.env.PORT ?? 4196)

type Handler = (url: URL, body: unknown) => unknown

const routes: Record<string, Handler> = {
    'GET specs': () => ({
        specs: Bots.map((bot) => bot.spec),
        preferred: PreferredBot,
        bots: Bots.map(({ spec, describe }) => ({ spec, describe }))
    }),
    'POST move': (_url, body) => {
        const { game, state, seats } = body as { game: Game; state: GameState; seats: Seats }
        const playerId = state.activePlayerIds[0]
        const spec = seats[playerId ?? ''] ?? PreferredBot
        const action = botMove(game, state, spec)
        checkMove(game, state, action)
        return { spec, action }
    },
    'POST play': (_url, body) => {
        const { players, seed, seats } = body as { players: number; seed: number; seats: string[] }
        const kept = playGame(Number(players), Number(seed), seats)
        const file = keepGame(HarnessRun, kept)
        return { file, scenario: kept.scenario, seats: kept.seats }
    },
    'GET runs': () => keptRuns(),
    'GET games': (url) => keptGames(url.searchParams.get('run') ?? ''),
    'GET game': (url) => {
        const kept = readKept(url.searchParams.get('file') ?? '')
        return { scenario: kept.scenario, seats: kept.seats }
    }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
    if (request.method !== 'POST') return undefined
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function send(response: ServerResponse, status: number, body: unknown) {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
}

const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    // The harness proxies /bots/<route> unchanged; a direct call may leave the prefix off.
    const route = url.pathname.replace(/^\/bots/, '').replace(/^\/+|\/+$/g, '')
    const handler = routes[`${request.method} ${route}`]
    if (!handler) {
        send(response, 404, { error: `No route ${request.method} /${route}` })
        return
    }
    try {
        send(response, 200, handler(url, await readBody(request)))
    } catch (failure) {
        const message = failure instanceof Error ? failure.message : String(failure)
        console.error(`${request.method} /${route}: ${message}`)
        send(response, 400, { error: message })
    }
})

server.listen(Port, () => {
    console.log(`Conduit bots on http://127.0.0.1:${Port}/bots (kept games in ${KeptRoot})`)
})
