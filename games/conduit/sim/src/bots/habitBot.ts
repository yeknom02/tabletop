import { assertExists } from '@tabletop/common'
import { ActionType, MachineState, type HydratedConduitGameState } from '../../../src/index.js'
import { type Bot, type BotContext, noteOf } from './bot.js'
import { letterOf, placementEffects, type PlacementEffect } from './evaluate.js'

// Each habit is one knob, so a study can switch one off and see what it was doing.
export type Habits = {
    // Buy when the tile's expected earnings beat the price by at least this much.
    margin: number
    neverBuy: boolean
    maxPrice: number
    // Cubes kept in supply for next round's bids when stacking extra cubes on a new station.
    keep: number
    maxExtra: number
    // Weight of each later payout; routes change, so later ones are less certain.
    discount: number
    // Weight on bidding under another player likely to buy, to be paid $1 for the cube.
    collect: number
    // Weight on bidding for tiles the bot itself wants.
    want: number
    // Weight on what a placement costs the other players.
    block: number
    focus?: string
    focusBonus: number
    // Random noise on the bid choice, so bots are not all identical.
    jitter: number
}

export const BalancedHabits: Habits = {
    margin: 1,
    neverBuy: false,
    maxPrice: 9,
    keep: 3,
    maxExtra: 3,
    discount: 0.9,
    collect: 1,
    want: 1,
    block: 0.3,
    focusBonus: 0,
    jitter: 0.5
}

type TileView = { best?: PlacementEffect; perPayout: number }

export class HabitBot implements Bot {
    constructor(
        readonly name: string,
        private readonly habits: Habits
    ) {}

    decide(context: BotContext) {
        const { state } = context
        switch (state.machineState) {
            case MachineState.Bidding:
                return this.bid(context)
            case MachineState.Offering:
                return this.offer(context)
            case MachineState.Placing:
                return this.place(context)
            default:
                throw Error(`No decision in ${state.machineState}`)
        }
    }

    // What one payout of the tile would be worth to a player at its best spot now.
    private tileView(state: HydratedConduitGameState, tileId: number, playerId: string): TileView {
        const effects = placementEffects(state, tileId, true, playerId)
        let best: PlacementEffect | undefined
        for (const effect of effects) {
            if (!best || (effect.gain.get(playerId) ?? 0) > (best.gain.get(playerId) ?? 0)) {
                best = effect
            }
        }
        const perPayout = best ? Math.max(0, best.gain.get(playerId) ?? 0) : 0
        const focused = this.habits.focus === letterOf(tileId) ? 1 + this.habits.focusBonus : 1
        return { best, perPayout: perPayout * focused }
    }

    private plannedCubes(state: HydratedConduitGameState, playerId: string, habits: Habits) {
        const supply = state.getPlayerState(playerId).supply
        return 1 + Math.max(0, Math.min(habits.maxExtra, supply - habits.keep))
    }

    private expectedValue(perPayout: number, cubes: number, discount: number): number {
        let total = 0
        for (let payout = 0; payout < cubes; payout++) total += perPayout * discount ** payout
        return total
    }

    private valueTo(
        state: HydratedConduitGameState,
        tileId: number,
        playerId: string,
        habits: Habits
    ): number {
        const view = this.tileView(state, tileId, playerId)
        return this.expectedValue(
            view.perPayout,
            this.plannedCubes(state, playerId, habits),
            habits.discount
        )
    }

    private bid({ state, playerId, random }: BotContext) {
        const habits = this.habits
        const mine = new Map<number, number>()
        const scores = state.biddableSlots().map((slot) => {
            const { tileId, bids } = state.market[slot]
            assertExists(tileId, 'A biddable slot holds a tile')
            if (!mine.has(tileId)) mine.set(tileId, this.valueTo(state, tileId, playerId, habits))
            const myValue = mine.get(tileId) ?? 0
            const price = bids.length + 1
            let score: number
            if (bids.length === 0) {
                score = habits.want * (myValue - 1)
            } else if (bids[0] === playerId) {
                score = habits.want * (myValue - price) - 1
            } else {
                const theirValue = this.valueTo(state, tileId, bids[0], BalancedHabits)
                const likelyBuy = theirValue - price >= 0 ? 1 : 0
                score =
                    habits.collect * likelyBuy +
                    habits.want * 0.25 * Math.max(0, myValue - price) * (1 - likelyBuy)
            }
            return { slot, score: score + habits.jitter * random() }
        })
        const choice = scores.reduce((best, entry) => (entry.score > best.score ? entry : best))
        return {
            decision: { type: ActionType.PlaceBid, slot: choice.slot } as const,
            note: noteOf(scores.map((entry) => entry.score))
        }
    }

    private offer({ state, playerId }: BotContext) {
        const offer = state.currentOffer()
        assertExists(offer, 'A tile is on offer')
        const habits = this.habits
        const affordable = state.getPlayerState(playerId).cash >= offer.price
        const value = this.valueTo(state, offer.tileId, playerId, habits)
        const buys =
            !habits.neverBuy &&
            affordable &&
            offer.price <= habits.maxPrice &&
            value - offer.price >= habits.margin
        return {
            decision: buys
                ? ({ type: ActionType.BuyTile } as const)
                : ({ type: ActionType.PassTile } as const),
            note: { options: 2, best: value - offer.price, second: 1 }
        }
    }

    private place({ state, playerId }: BotContext) {
        const placement = state.pendingPlacement()
        assertExists(placement, 'A tile is waiting to be placed')
        const habits = this.habits
        const effects = placementEffects(
            state,
            placement.tileId,
            placement.faceUp,
            placement.faceUp ? playerId : undefined
        )
        const scored = effects.map((effect) => {
            let others = 0
            for (const [id, gain] of effect.gain) if (id !== playerId) others += gain
            return { effect, score: (effect.gain.get(playerId) ?? 0) - habits.block * others }
        })
        const best = scored.reduce((leader, entry) => (entry.score > leader.score ? entry : leader))
        const supply = state.getPlayerState(playerId).supply
        const extraCubes = placement.faceUp
            ? Math.max(0, Math.min(habits.maxExtra, supply - habits.keep))
            : 0
        return {
            decision: {
                type: ActionType.PlaceTile,
                cell: best.effect.choice.cell,
                rotation: best.effect.choice.rotation,
                extraCubes
            } as const,
            note: noteOf(scored.map((entry) => entry.score))
        }
    }
}
