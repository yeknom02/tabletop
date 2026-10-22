import type { GameAction, Point } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { isMoveShips, type HydratedArcsGameState, type SystemId } from '@tabletop/arcs'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import { systemAnchor } from '$lib/utils/mapLayout.js'
import {
    inferredFlights,
    mapChanges,
    mapPieces,
    moveFlights,
    type MapPiece
} from '$lib/utils/mapPieces.js'

// A flight as drawn: its ships, and the points it passes, starting where it is drawn.
export type FlightView = { key: string; owner: string; ships: number; points: Point[]; leg: number }

type MapCallbacks = {
    // Presence only (Pattern B): no motion values pass through reactive state.
    show: (pieces: MapPiece[], flights: FlightView[]) => void
    settle: (pieces: MapPiece[]) => void
    // The viewer already knows what their own action did, so it plays briskly with no hold.
    isOwnLiveAction: (action: GameAction) => boolean
}

type Timing = typeof ACTION

const ACTION = {
    leave: 0.25,
    arrive: 0.3,
    hop: 0.32,
    land: 0.2,
    flipHalf: 0.18,
    shake: 0.32,
    hold: 0.4
}
const OWN: Timing = {
    leave: 0.15,
    arrive: 0.2,
    hop: 0.2,
    land: 0.15,
    flipHalf: 0.12,
    shake: 0.24,
    hold: 0
}
// Undo and history steps: every path ends within 200ms, flights straight to where they land.
const FAST: Timing = {
    leave: 0.15,
    arrive: 0.15,
    hop: 0.18,
    land: 0,
    flipHalf: 0.09,
    shake: 0.15,
    hold: 0
}

export const MapTimings = { ACTION, OWN, FAST }

// When each leg of flights takes off and lands. With an action, ships pass through each system on
// their route and a later leg waits for the earlier; without one, every flight goes straight at once.
export function flightSchedule(
    flights: readonly FlightView[],
    timing: Timing,
    hasAction: boolean
): { takeOff: number; landing: number }[] {
    if (!hasAction) {
        return flights.map(() => ({ takeOff: 0, landing: timing.hop }))
    }
    const legs = [...new Set(flights.map((flight) => flight.leg))].sort((a, b) => a - b)
    const legStart = new Map<number, number>()
    let start = 0
    for (const leg of legs) {
        legStart.set(leg, start)
        const hops = Math.max(
            ...flights.filter((flight) => flight.leg === leg).map((f) => f.points.length - 1)
        )
        start += hops * timing.hop
    }
    return flights.map((flight) => {
        const takeOff = legStart.get(flight.leg) ?? 0
        return { takeOff, landing: takeOff + (flight.points.length - 1) * timing.hop }
    })
}

export class MapAnimator {
    private elements = new Map<string, HTMLElement>()

    constructor(private callbacks: MapCallbacks) {}

    attach(key: string): Attachment<HTMLElement> {
        return (node) => {
            this.elements.set(key, node)
            return () => {
                if (this.elements.get(key) === node) {
                    this.elements.delete(key)
                }
            }
        }
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedArcsGameState
        to: HydratedArcsGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        const fromPieces = mapPieces(from)
        const toPieces = mapPieces(to)
        const changes = mapChanges(fromPieces, toPieces)
        const flights =
            action && isMoveShips(action)
                ? moveFlights(action)
                : inferredFlights(fromPieces, toPieces)
        const { arriving, leaving, shifted, turned, resized } = changes
        if (arriving.length + leaving.length + shifted.length + resized.length === 0) {
            return
        }

        // Players who ask for less motion get the quick changes undo uses, with no hold.
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const timing =
            !action || reduced ? FAST : this.callbacks.isOwnLiveAction(action) ? OWN : ACTION
        const routed = action !== undefined && !reduced

        const stackAt = (pieces: readonly MapPiece[], owner: string, system: SystemId) =>
            pieces.find(
                (piece) =>
                    piece.kind === 'ships' && piece.owner === owner && piece.system === system
            )?.at ?? systemAnchor(system)
        const views: FlightView[] = flights
            .filter((flight) => flight.ships > 0)
            .map((flight, index) => {
                const first = flight.route[0]
                const last = flight.route[flight.route.length - 1]
                const between = routed ? flight.route.slice(1, -1).map(systemAnchor) : []
                return {
                    key: `flight:${index}`,
                    owner: flight.owner,
                    ships: flight.ships,
                    leg: flight.leg,
                    points: [
                        stackAt(fromPieces, flight.owner, first),
                        ...between,
                        stackAt(toPieces, flight.owner, last)
                    ]
                }
            })

        this.callbacks.show([...toPieces, ...leaving], views)
        animationContext.afterAnimations(() => this.callbacks.settle(toPieces))
        await tick()

        const timeline = animationContext.actionTimeline
        const turnedFrom = new Set(turned.map(({ from }) => from.key))
        const turnedTo = new Set(turned.map(({ to }) => to.key))
        const destinations = new Map<string, number>()
        const origins = new Set<string>()
        const schedule = flightSchedule(views, timing, routed)
        for (const [index, flight] of flights.filter((f) => f.ships > 0).entries()) {
            const landing = schedule[index].landing
            const destination = `ships:${flight.route[flight.route.length - 1]}:${flight.owner}`
            destinations.set(destination, Math.max(destinations.get(destination) ?? 0, landing))
            origins.add(`ships:${flight.route[0]}:${flight.owner}`)
        }

        for (const piece of leaving) {
            const node = this.elements.get(piece.key)
            if (!node || turnedFrom.has(piece.key)) continue
            if (piece.kind === 'slot' || origins.has(piece.key)) {
                // A building takes the slot's place; the flight carries the ships away.
                gsap.set(node, { opacity: 0 })
                continue
            }
            timeline.to(
                node,
                { opacity: 0, scale: 0.6, duration: timing.leave, ease: 'power2.in' },
                0
            )
        }

        for (const piece of arriving) {
            const node = this.elements.get(piece.key)
            if (!node || turnedTo.has(piece.key)) continue
            if (piece.kind === 'slot') {
                gsap.set(node, { opacity: 0 })
                timeline.to(node, { opacity: 1, duration: timing.leave }, 0)
                continue
            }
            const at = timing.land > 0 ? (destinations.get(piece.key) ?? 0) : 0
            gsap.set(node, { opacity: 0, scale: 1.4 })
            timeline.to(
                node,
                {
                    opacity: 1,
                    scale: 1,
                    duration: timing.arrive,
                    ease: action ? 'back.out(1.8)' : 'power2.out'
                },
                at
            )
        }

        for (const { from: old, to: next } of turned) {
            const oldFace = this.elements.get(old.key)
            const newFace = this.elements.get(next.key)
            if (!oldFace || !newFace) continue
            gsap.set(newFace, { scaleX: 0 })
            timeline.to(oldFace, { scaleX: 0, duration: timing.flipHalf, ease: 'power1.in' }, 0)
            timeline.to(
                newFace,
                { scaleX: 1, duration: timing.flipHalf, ease: 'power1.out' },
                timing.flipHalf
            )
        }

        for (const { piece, from: was } of shifted) {
            const node = this.elements.get(piece.key)
            if (!node) continue
            gsap.set(node, { x: was.x - piece.at.x, y: was.y - piece.at.y })
            timeline.to(node, { x: 0, y: 0, duration: timing.hop, ease: 'power2.inOut' }, 0)
        }

        for (const { from: old, to: next } of resized) {
            const node = this.elements.get(next.key)
            if (!node) continue
            const landing = destinations.get(next.key)
            const grew = next.fresh + next.damaged > old.fresh + old.damaged
            if (landing !== undefined || grew) {
                const at = timing.land > 0 ? (landing ?? 0) : 0
                timeline.fromTo(
                    node,
                    { scale: 1.3 },
                    { scale: 1, duration: timing.arrive, ease: 'back.out(2)' },
                    at
                )
            } else if (!origins.has(next.key)) {
                // Ships lost or damaged where they stand.
                const step = timing.shake / 4
                timeline.to(node, { x: -14, duration: step, ease: 'power1.inOut' }, 0)
                timeline.to(node, { x: 14, duration: step, ease: 'power1.inOut' }, step)
                timeline.to(node, { x: -8, duration: step, ease: 'power1.inOut' }, step * 2)
                timeline.to(node, { x: 0, duration: step, ease: 'power1.inOut' }, step * 3)
            }
        }

        for (const [index, view] of views.entries()) {
            const node = this.elements.get(view.key)
            if (!node) continue
            const { takeOff, landing } = schedule[index]
            const [start, ...rest] = view.points
            if (takeOff > 0) {
                // A later leg's ships are still on their way to where it starts.
                gsap.set(node, { opacity: 0 })
                timeline.set(node, { opacity: 1 }, takeOff)
            }
            const hop = rest.length > 0 ? (landing - takeOff) / rest.length : 0
            for (const [step, point] of rest.entries()) {
                timeline.to(
                    node,
                    {
                        x: point.x - start.x,
                        y: point.y - start.y,
                        duration: hop,
                        ease: rest.length === 1 ? 'power2.inOut' : 'none'
                    },
                    takeOff + step * hop
                )
            }
            const fadeFor = Math.min(timing.land || hop / 3, hop)
            timeline.to(
                node,
                { opacity: 0, duration: fadeFor },
                landing - (timing.land ? 0 : fadeFor)
            )
        }

        if (timing.hold > 0) {
            animationContext.ensureDuration(timing.hold)
        }
    }
}
