import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameRecord } from '../game.js'

export function loadRun(dir: string): { run: Record<string, unknown>; games: GameRecord[] } {
    const run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'))
    const games = readdirSync(dir)
        .filter((name) => name.startsWith('games-') && name.endsWith('.jsonl'))
        .flatMap((name) =>
            readFileSync(join(dir, name), 'utf8')
                .split('\n')
                .filter((line) => line.length > 0)
                .map((line): GameRecord => JSON.parse(line))
        )
    return { run, games }
}

// Mean with a 95% normal interval.
export function meanCI(values: number[]): { mean: number; low: number; high: number; n: number } {
    const n = values.length
    const mean = values.reduce((total, value) => total + value, 0) / Math.max(n, 1)
    const variance =
        values.reduce((total, value) => total + (value - mean) ** 2, 0) / Math.max(n - 1, 1)
    const half = 1.96 * Math.sqrt(variance / Math.max(n, 1))
    return { mean, low: mean - half, high: mean + half, n }
}

export function fmt(ci: { mean: number; low: number; high: number }, digits = 2): string {
    return `${ci.mean.toFixed(digits)} [${ci.low.toFixed(digits)}, ${ci.high.toFixed(digits)}]`
}

// A tie shares the win.
export function winShare(game: GameRecord, seat: number): number {
    return game.winners.includes(seat) ? 1 / game.winners.length : 0
}
