import { spawn, type ChildProcess } from 'node:child_process'
import { connect } from 'node:net'
import { fileURLToPath } from 'node:url'
import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import type { Plugin } from 'vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

const BotServerUrl = process.env.CONDUIT_BOT_SERVER ?? 'http://127.0.0.1:4196'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), devtoolsJson(), botServer()],
        server: {
            // Bind every interface rather than loopback alone. Without this vite listens
            // on [::1] only, so a container port forwarded over IPv4 - as VS Code's
            // devcontainer forwarding does - refuses the connection while the server is
            // running perfectly well.
            host: true,
            port: 5240,
            // The Bots bar asks the bot server (tools/conduit-bots) for moves.
            proxy: { '/bots': BotServerUrl }
        }
    })
)

// Starts the bot server with the dev server, unless one is already listening or CONDUIT_BOT_SERVER
// names another. It runs under node --watch, so it restarts when its code or the built engine
// (games/conduit/esm) changes. It lives on globalThis so a dev server restart reuses it.
function botServer(): Plugin {
    const running = globalThis as { conduitBotServer?: ChildProcess }
    return {
        name: 'conduit-bot-server',
        apply: 'serve',
        async configureServer() {
            if (process.env.CONDUIT_BOT_SERVER || process.env.VITEST) return
            if (running.conduitBotServer && running.conduitBotServer.exitCode === null) return
            const url = new URL(BotServerUrl)
            if (await listening(url.hostname, Number(url.port))) return
            const child = spawn('node', ['--watch', 'src/botServer.ts'], {
                cwd: fileURLToPath(new URL('../../tools/conduit-bots', import.meta.url)),
                env: { ...process.env, PORT: url.port },
                stdio: ['ignore', 'inherit', 'inherit']
            })
            running.conduitBotServer = child
            process.once('exit', () => child.kill())
        }
    }
}

function listening(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = connect({ host, port })
        socket.once('connect', () => {
            socket.destroy()
            resolve(true)
        })
        socket.once('error', () => resolve(false))
    })
}
