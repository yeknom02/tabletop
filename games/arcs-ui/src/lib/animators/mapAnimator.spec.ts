import { describe, expect, it } from 'vitest'
import { flightSchedule, MapTimings, type FlightView } from './mapAnimator.js'

const flight = (hops: number, leg = 0): FlightView => ({
    key: `f${hops}${leg}`,
    owner: 'a',
    ships: 1,
    leg,
    points: Array.from({ length: hops + 1 }, (_, x) => ({ x, y: 0 }))
})

describe('flightSchedule', () => {
    it('passes through each system, a later leg waiting for the earlier', () => {
        const { ACTION } = MapTimings
        const [first, second] = flightSchedule([flight(3), flight(1, 1)], ACTION, true)
        expect(first).toEqual({ takeOff: 0, landing: 3 * ACTION.hop })
        expect(second.takeOff).toBe(3 * ACTION.hop)
    })

    it('flies everything straight and at once within 200ms without an action', () => {
        const schedule = flightSchedule([flight(3), flight(1, 1)], MapTimings.FAST, false)
        expect(schedule.every(({ takeOff, landing }) => takeOff === 0 && landing <= 0.2)).toBe(true)
    })

    it('keeps every undo and history change within 200ms', () => {
        const { FAST } = MapTimings
        expect(
            Math.max(FAST.leave, FAST.arrive, FAST.hop, FAST.shake, FAST.flipHalf * 2, FAST.hold)
        ).toBeLessThanOrEqual(0.2)
    })
})
