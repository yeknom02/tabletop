import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import type { HydratedArcsGameState } from '@tabletop/arcs'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'

// What an element shows, read from a state; it pops when that differs between two states, and
// grows in when it had nothing to show before.
export type Signature = (state: HydratedArcsGameState) => string | undefined

type Registered = { node: HTMLElement; signature: Signature }

const ACTION = { pop: 0.4, appear: 0.35 }
const OWN = { pop: 0.28, appear: 0.25 }
// Undo and history steps end within 200ms.
const FAST = { pop: 0.15, appear: 0.15 }

export const HighlightTimings = { ACTION, OWN, FAST }

// Pops the side panels' elements whose content an action changed: the session draws the panels
// from the incoming state during the transition (a pre-reactivity override), so each element
// already shows its new content when it pops.
export class HighlightAnimator {
    private registered = new Map<string, Registered>()

    constructor(private isOwnLiveAction: (action: GameAction) => boolean) {}

    attach(key: string, signature: Signature): Attachment<HTMLElement> {
        return (node) => {
            const entry = { node, signature }
            this.registered.set(key, entry)
            return () => {
                if (this.registered.get(key) === entry) {
                    this.registered.delete(key)
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
        await tick()
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const timing = !action || reduced ? FAST : this.isOwnLiveAction(action) ? OWN : ACTION
        const timeline = animationContext.actionTimeline
        for (const { node, signature } of this.registered.values()) {
            const before = signature(from)
            const after = signature(to)
            if (before === after || after === undefined) continue
            gsap.set(node, { transformOrigin: 'center center' })
            if (before === undefined) {
                timeline.fromTo(
                    node,
                    { scale: 0.4, opacity: 0 },
                    { scale: 1, opacity: 1, duration: timing.appear, ease: 'back.out(1.7)' },
                    0
                )
            } else {
                timeline.fromTo(
                    node,
                    { scale: 1.35 },
                    { scale: 1, duration: timing.pop, ease: 'back.out(2.2)' },
                    0
                )
            }
        }
    }
}
