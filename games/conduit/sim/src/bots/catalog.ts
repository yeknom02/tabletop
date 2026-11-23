import type { Bot } from './bot.js'
import { BalancedHabits, HabitBot, type Habits } from './habitBot.js'
import { RandomBot } from './randomBot.js'

// Named bots. A spec is a preset name, optionally with a letter ("focus:B") and habit overrides
// ("balanced{keep=2,margin=0}").
export const Presets: Record<string, Partial<Habits>> = {
    balanced: {},
    greedy: { margin: 0, keep: 0, maxExtra: 9, discount: 1, block: 0 },
    cautious: { margin: 3, keep: 4, maxExtra: 2 },
    passer: { neverBuy: true, collect: 1.5, want: 0 },
    blocker: { block: 1 },
    stacker: { keep: 0, maxExtra: 9 },
    hoarder: { keep: 9, maxExtra: 0 },
    focus: { focusBonus: 0.5 }
}

export function makeBot(spec: string): Bot {
    if (spec === 'random') return new RandomBot()
    const match = /^([a-z]+)(?::([A-D]))?(?:\{(.*)\})?$/.exec(spec)
    if (!match) throw Error(`Bad bot spec ${spec}`)
    const [, preset, letter, overrides] = match
    const base = Presets[preset]
    if (!base) throw Error(`Unknown bot ${preset}`)
    const habits: Habits = { ...BalancedHabits, ...base, ...(letter ? { focus: letter } : {}) }
    for (const pair of overrides ? overrides.split(',') : []) {
        const [key, value] = pair.split('=')
        if (!(key in habits)) throw Error(`Unknown habit ${key}`)
        Object.assign(habits, {
            [key]: value === 'true' ? true : value === 'false' ? false : Number(value)
        })
    }
    return new HabitBot(spec, habits)
}
