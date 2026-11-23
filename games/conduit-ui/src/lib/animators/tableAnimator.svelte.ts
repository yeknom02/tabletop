import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { Point } from '@tabletop/common'
import type { AnimationContext, GameStateChangeListener } from '@tabletop/frontend-components'
import {
    isPayRevenue,
    isPlaceTile,
    type HydratedConduitGameState,
    type PlaceTile,
    type RevenuePaid
} from '@tabletop/conduit'
import { CellSize } from '$lib/utils/boardLayout.js'
import {
    cellTableOrigin,
    spotTileOrigin,
    tableGeometry,
    TileInSpot
} from '$lib/utils/tableLayout.js'

export type FlyingTile = {
    slot: number
    tileId: number
    rotation: number
    faceUp: boolean
    from: Point
    to: Point
}

export type PayoutFloat = { key: string; at: Point; amount: number }

type Session = {
    addGameStateChangeListener(listener: GameStateChangeListener<HydratedConduitGameState>): void
    removeGameStateChangeListener(listener: GameStateChangeListener<HydratedConduitGameState>): void
}

const TileFlight = 0.55
const PayoutRise = 1.1

// Explains two committed actions on the table: a placed tile flies from its auction spot to its
// cell, and each station's revenue rises from it as "+$N". Only a played or replayed action
// animates; Undo and history steps without an action swap the state at once.
export class TableAnimator {
    flyingTile: FlyingTile | undefined = $state()
    payoutFloats: PayoutFloat[] = $state([])

    private svg: SVGSVGElement | undefined

    constructor(private readonly session: Session) {}

    readonly attach = (svg: SVGSVGElement) => {
        this.svg = svg
        this.session.addGameStateChangeListener(this.onGameStateChange)
        return () => {
            this.session.removeGameStateChangeListener(this.onGameStateChange)
            this.svg = undefined
        }
    }

    private readonly onGameStateChange: GameStateChangeListener<HydratedConduitGameState> = async ({
        from,
        to,
        action,
        animationContext
    }) => {
        if (!from || !action) return
        if (isPlaceTile(action) && action.metadata) {
            await this.flyTile(action, action.metadata.faceUp, from, to, animationContext)
        } else if (isPayRevenue(action) && action.metadata) {
            await this.floatPayouts(action.metadata, from, animationContext)
        }
    }

    private async flyTile(
        action: PlaceTile,
        faceUp: boolean,
        from: HydratedConduitGameState,
        to: HydratedConduitGameState,
        animationContext: AnimationContext
    ) {
        const placement = from.pendingPlacement()
        if (!placement) return
        const before = tableGeometry(from.board)
        const after = tableGeometry(to.board)
        const start = spotTileOrigin(placement.slot, before)
        this.flyingTile = {
            slot: placement.slot,
            tileId: placement.tileId,
            rotation: faceUp ? action.rotation : 0,
            faceUp,
            from: start,
            to: cellTableOrigin(action.cell, after)
        }
        await tick()
        const wrapper = this.svg?.querySelector<SVGGElement>('[data-flying-tile]')
        const scaler = this.svg?.querySelector<SVGGElement>('[data-flying-scale]')
        const flight = this.flyingTile
        if (!wrapper || !scaler || !flight) return
        const point = { ...flight.from }
        const startScale = TileInSpot / CellSize
        scaler.setAttribute('transform', `scale(${startScale})`)
        const scale = { value: startScale }
        animationContext.actionTimeline.to(
            point,
            {
                x: flight.to.x,
                y: flight.to.y,
                duration: TileFlight,
                ease: 'power2.inOut',
                onUpdate: () =>
                    wrapper.setAttribute('transform', `translate(${point.x} ${point.y})`)
            },
            0
        )
        animationContext.actionTimeline.to(
            scale,
            {
                value: 1,
                duration: TileFlight,
                ease: 'power2.inOut',
                onUpdate: () => scaler.setAttribute('transform', `scale(${scale.value})`)
            },
            0
        )
    }

    // The tile stays where it landed through the rest of the action's cascade (revenue, loss), which
    // animates before the new state is shown, so it is put away only once that state is published.
    settle() {
        this.flyingTile = undefined
        this.payoutFloats = []
    }

    private async floatPayouts(
        paid: RevenuePaid,
        from: HydratedConduitGameState,
        animationContext: AnimationContext
    ) {
        const geometry = tableGeometry(from.board)
        this.payoutFloats = paid.revenues
            .filter((revenue) => revenue.amount > 0 && revenue.route.length > 0)
            .map((revenue, index) => {
                const origin = cellTableOrigin(revenue.route[0], geometry)
                return {
                    key: `${revenue.tileId}-${index}`,
                    at: { x: origin.x + CellSize / 2, y: origin.y + CellSize / 2 },
                    amount: revenue.amount
                }
            })
        await tick()
        for (const float of this.payoutFloats) {
            const element = this.svg?.querySelector<SVGGElement>(`[data-payout="${float.key}"]`)
            if (!element) continue
            const point = { y: float.at.y, opacity: 0 }
            const draw = () => {
                element.setAttribute('transform', `translate(${float.at.x} ${point.y})`)
                element.setAttribute('opacity', `${point.opacity}`)
            }
            const timeline = gsap.timeline({ onUpdate: draw })
            timeline.to(point, { opacity: 1, duration: 0.2 }, 0)
            timeline.to(point, { y: float.at.y - 40, duration: PayoutRise, ease: 'power1.out' }, 0)
            timeline.to(point, { opacity: 0, duration: 0.3 }, PayoutRise - 0.3)
            animationContext.actionTimeline.add(timeline, 0)
        }
        animationContext.afterAnimations(() => {
            this.payoutFloats = []
        })
    }
}
