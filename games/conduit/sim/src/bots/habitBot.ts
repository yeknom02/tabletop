import { assertExists } from '@tabletop/common'
import {
    ActionType,
    ExtraCubeCost,
    extraCubesPrice,
    MachineState,
    MarketDeal,
    MarketSize,
    RouteTarget,
    RouteToll,
    Rounds,
    type HydratedConduitGameState
} from '../../../src/index.js'
import { type Bot, type BotContext, noteOf } from './bot.js'
import {
    destinationLetter,
    letterOf,
    nextMarketChance,
    placementEffects,
    type PlacementEffect
} from './evaluate.js'

// What a two-station route pays: the usual first route a new destination gives.
const ShortRoutePay = 3

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
    // Weight on the chance that a tile with no route now gets a destination later: the chance a
    // tile of the letter it needs turns up (this market or the next), times how often such a tile
    // would actually connect. 0 is the myopic bot.
    prospect: number
    // When extra cubes cost money: add the next extra cube only if the payout it adds beats its
    // price by at least this much. ignoreCubeCost stacks every affordable cube anyway.
    cubeMargin: number
    // The margin the bot expects another player to need before buying a tile it bids under.
    expectMargin: number
    // Value another bidder's tile with this bot's own habits rather than the balanced ones.
    mirror: boolean
    ignoreCubeCost: boolean
    // Random noise on the bid choice, so bots are not all identical.
    jitter: number
    // When passing is allowed, pass unless the best bid scores at least this much.
    passBelow: number
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
    prospect: 0,
    cubeMargin: 0,
    expectMargin: 0,
    mirror: false,
    ignoreCubeCost: false,
    jitter: 0.5,
    passBelow: 0.5
}

type TileView = { best?: PlacementEffect; perPayout: number }

export class HabitBot implements Bot {
    private routeTarget = RouteTarget.SameLetter
    private marketDeal = MarketDeal.Cycle
    private extraCubeCost = ExtraCubeCost.Free
    private routeToll = RouteToll.None
    private marketSize = MarketSize.SmallFirst
    private stationCubeCap: number | undefined
    // tileView depends only on the board, the tile and the player; bidding asks the same question
    // many times over a board that does not change.
    private viewCache = new Map<string, TileView>()
    private viewBoard = ''

    constructor(
        readonly name: string,
        private readonly habits: Habits
    ) {}

    decide(context: BotContext) {
        const { state } = context
        this.routeTarget = context.routeTarget
        this.marketDeal = context.marketDeal
        this.extraCubeCost = context.extraCubeCost
        this.routeToll = context.routeToll
        this.marketSize = context.marketSize
        this.stationCubeCap = context.stationCubeCap
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
        const board = state.board.stations
            .map(
                (station) =>
                    `${station.tileId}@${station.cell.col},${station.cell.row}r${station.rotation}${
                        station.faceUp ? (station.ownerId ?? '') : '-'
                    }${station.cubes > 0 ? '+' : ''}`
            )
            .join(';')
        if (board !== this.viewBoard) {
            this.viewBoard = board
            this.viewCache.clear()
        }
        const key = `${tileId}:${playerId}`
        const cached = this.viewCache.get(key)
        if (cached) return cached
        const view = this.computeTileView(state, tileId, playerId)
        this.viewCache.set(key, view)
        return view
    }

    private computeTileView(
        state: HydratedConduitGameState,
        tileId: number,
        playerId: string
    ): TileView {
        const effects = placementEffects(
            state,
            tileId,
            true,
            playerId,
            this.routeTarget,
            this.routeToll
        )
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

    // Extra cubes for a new station paying perPayout each time. Free cubes: every spare cube the
    // habits allow. Paid cubes: one more while its extra (last, most discounted) payout beats what
    // that cube costs, and the player can pay.
    private extrasFor(
        state: HydratedConduitGameState,
        playerId: string,
        perPayout: number,
        habits: Habits,
        cashAfter = state.getPlayerState(playerId).cash
    ): number {
        const supply = state.getPlayerState(playerId).supply
        const cap = Math.max(
            0,
            Math.min(habits.maxExtra, supply - habits.keep, (this.stationCubeCap ?? 99) - 1)
        )
        if (this.extraCubeCost === ExtraCubeCost.Free) return cap
        const affordable = (count: number) =>
            extraCubesPrice(count, this.extraCubeCost) <= cashAfter
        let extras = 0
        while (extras < cap && affordable(extras + 1)) {
            const next = extras + 1
            const cubePrice =
                extraCubesPrice(next, this.extraCubeCost) -
                extraCubesPrice(extras, this.extraCubeCost)
            const worth = perPayout * habits.discount ** next - cubePrice
            if (!habits.ignoreCubeCost && worth < habits.cubeMargin) break
            extras = next
        }
        return extras
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
        const extras = this.extrasFor(state, playerId, view.perPayout, habits)
        const cubes = 1 + extras
        const cubeCost = extraCubesPrice(extras, this.extraCubeCost)
        if (view.perPayout > 0 || habits.prospect === 0) {
            return this.expectedValue(view.perPayout, cubes, habits.discount) - cubeCost
        }
        return this.prospectValue(state, tileId, cubes, habits) - cubeCost
    }

    // A station with no route yet earns once a tile of the letter it needs arrives and connects.
    // Another such tile still in this market can arrive before this round's payout; each later
    // market is a fresh chance, until the fifth round's market has been dealt.
    private prospectValue(
        state: HydratedConduitGameState,
        tileId: number,
        cubes: number,
        habits: Habits
    ): number {
        const needed = destinationLetter(tileId, this.routeTarget)
        const inMarket = state.market.some(
            (slot) =>
                slot.tileId !== undefined &&
                slot.tileId !== tileId &&
                letterOf(slot.tileId) === needed
        )
        const perMarket = nextMarketChance(state, needed, this.marketDeal, this.marketSize)
        const marketsLeft = Math.max(0, Rounds - state.round)
        let missing = inMarket ? 0 : 1
        let total = 0
        for (let payout = 0; payout < cubes; payout++) {
            if (payout > 0 && payout <= marketsLeft) missing *= 1 - perMarket
            total += habits.discount ** payout * ShortRoutePay * (1 - missing)
        }
        const focused = habits.focus === letterOf(tileId) ? 1 + habits.focusBonus : 1
        return habits.prospect * total * focused
    }

    private bid({ state, playerId, random, canPassBid }: BotContext) {
        const habits = this.habits
        const base = state.basePrice ?? 0
        const mine = new Map<number, number>()
        const scores = state.biddableSlots().map((slot) => {
            const { tileId, bids } = state.market[slot]
            assertExists(tileId, 'A biddable slot holds a tile')
            if (!mine.has(tileId)) mine.set(tileId, this.valueTo(state, tileId, playerId, habits))
            const myValue = mine.get(tileId) ?? 0
            const price = bids.length + 1 + base
            let score: number
            if (bids.length === 0) {
                score = habits.want * (myValue - price)
            } else if (bids[0] === playerId) {
                // A forced bid may as well go here; when passing is allowed, it only adds $1 to
                // the bot's own price.
                score = canPassBid ? -1 : habits.want * (myValue - price) - 1
            } else {
                const theirValue = this.valueTo(
                    state,
                    tileId,
                    bids[0],
                    habits.mirror ? habits : BalancedHabits
                )
                const likelyBuy = theirValue - price >= habits.expectMargin ? 1 : 0
                score =
                    habits.collect * likelyBuy +
                    habits.want * 0.25 * Math.max(0, myValue - price) * (1 - likelyBuy)
            }
            return { slot, raw: score, score: score + habits.jitter * random() }
        })
        const choice = scores.reduce((best, entry) => (entry.score > best.score ? entry : best))
        if (canPassBid) {
            const bestRaw = Math.max(...scores.map((entry) => entry.raw))
            const note = noteOf([...scores.map((entry) => entry.raw), habits.passBelow])
            if (bestRaw < habits.passBelow) {
                return { decision: { type: ActionType.PassBid } as const, note }
            }
            return {
                decision: { type: ActionType.PlaceBid, slot: choice.slot } as const,
                note
            }
        }
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
            placement.faceUp ? playerId : undefined,
            this.routeTarget,
            this.routeToll
        )
        const scored = effects.map((effect) => {
            let others = 0
            for (const [id, gain] of effect.gain) if (id !== playerId) others += gain
            return { effect, score: (effect.gain.get(playerId) ?? 0) - habits.block * others }
        })
        const best = scored.reduce((leader, entry) => (entry.score > leader.score ? entry : leader))
        const extraCubes = placement.faceUp
            ? this.extrasFor(state, playerId, best.effect.stationPayout, habits)
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
