import type { RandomFunction } from '@tabletop/common'
import { ActionType, cubesPerRound, MachineState, minimumBidsOf, Rounds } from '@tabletop/conduit'
import type { Bot, Choice } from './bots.ts'
import type { Move } from './table.ts'
import {
    extrasWorthIt,
    rulesOf,
    spotEffects,
    stationPayout,
    tileWorth,
    type ExtraPlan,
    type Rules
} from './value.ts'

// Human-like bots, one habit per version, each version keeping the habits before it. A decision no
// habit covers yet is made at random, as random@v1 makes it, so each version shows what its own
// habit is worth.
export type Habit = 'buy' | 'place' | 'bid' | 'extras' | 'block'

// A tile is bought when it is worth at least this much more than its price.
const BuyMargin = 1
// What placing a tile that helps another player costs, per $1 it adds to their earnings.
const BlockWeight = 0.5
// Noise on bid choices, so a table of the same bot doesn't bid as one.
const BidJitter = 0.5
// When the player may pass, they bid again only for a bid scoring at least this much.
const PassBelow = 0.5

export function humanBot(version: number, habits: Habit[], describe: string): Bot {
    const has = (habit: Habit) => habits.includes(habit)
    return {
        spec: `human@v${version}`,
        describe,
        choose(choice) {
            const rules = rulesOf(choice.game.config)
            switch (choice.view.machineState) {
                case MachineState.Offering:
                    if (has('buy')) return offer(choice, rules, has('extras'))
                    break
                case MachineState.Placing:
                    if (has('place')) return place(choice, rules, has('extras'), has('block'))
                    break
                case MachineState.Bidding:
                    if (has('bid')) return bid(choice, rules, has('extras'))
                    break
            }
            return randomMove(choice)
        }
    }
}

function pick<T>(items: readonly T[], random: RandomFunction): T {
    return items[Math.floor(random() * items.length)]
}

function randomMove({ moves, random }: Choice): Move {
    return pick(pick([...moves.values()], random), random)
}

function only(choice: Choice, type: ActionType): Move {
    const [move] = choice.moves.get(type) ?? []
    if (!move) throw new Error(`${type} is not a legal move here`)
    return move
}

// Cubes a player keeps in supply rather than stack on a station: enough that next round's refill
// still covers their bids, with one to spare. Only with the extras habit; before it, nothing.
function keptBack(choice: Choice, playerId: string, thoughtful: boolean): number {
    const { view, game } = choice
    if (!thoughtful || view.round >= Rounds) return 0
    const refill = Math.min(cubesPerRound(game.config), view.getPlayerState(playerId).reserve)
    return Math.max(0, minimumBidsOf(game.config) + 1 - refill)
}

function planFor(choice: Choice, playerId: string, cash: number, thoughtful: boolean): ExtraPlan {
    const supply = choice.view.getPlayerState(playerId).supply
    return { room: supply - keptBack(choice, playerId, thoughtful), cash }
}

// Buy when the tile at its best spot, with the extra cubes worth adding, beats the price.
function offer(choice: Choice, rules: Rules, thoughtful: boolean): Move {
    const { view, playerId, moves } = choice
    const current = view.currentOffer()
    if (!current || !moves.has(ActionType.BuyTile)) return only(choice, ActionType.PassTile)
    const cash = view.getPlayerState(playerId).cash - current.price
    const worth = tileWorth(
        view,
        rules,
        current.tileId,
        playerId,
        planFor(choice, playerId, cash, thoughtful)
    )
    return worth - current.price >= BuyMargin
        ? only(choice, ActionType.BuyTile)
        : only(choice, ActionType.PassTile)
}

// The spot that adds most to the player's earnings (less what it adds to everyone else's, with the
// blocking habit), ties broken at random. A face-down tile only opens connections.
function place(choice: Choice, rules: Rules, thoughtful: boolean, blocking: boolean): Move {
    const { view, playerId, moves, random } = choice
    const placement = view.pendingPlacement()
    const legal = moves.get(ActionType.PlaceTile) ?? []
    if (!placement || legal.length === 0) return randomMove(choice)
    const ownerId = placement.faceUp ? playerId : undefined
    const scored = spotEffects(view, rules, placement.tileId, placement.faceUp, ownerId).map(
        (effect) => {
            let others = 0
            for (const [id, gain] of effect.gain) if (id !== playerId) others += gain
            const own = effect.gain.get(playerId) ?? 0
            return { spot: effect.spot, score: own - (blocking ? BlockWeight * others : 0) }
        }
    )
    const top = Math.max(...scored.map((entry) => entry.score))
    const spot = pick(
        scored.filter((entry) => entry.score >= top - 1e-9),
        random
    ).spot
    const atSpot = legal.filter(
        (move) => move.rotation === spot.rotation && sameCell(move.cell, spot.cell)
    )
    if (!placement.faceUp || !thoughtful) return pick(atSpot, random)
    const cash = view.getPlayerState(playerId).cash
    const payout = stationPayout(view, rules, placement.tileId, spot, playerId)
    const wanted = extrasWorthIt(payout, planFor(choice, playerId, cash, true), rules)
    // The most extra cubes up to the wanted number that the engine accepts here.
    return atSpot.reduce((best, move) =>
        extrasOf(move) <= wanted && extrasOf(move) > extrasOf(best) ? move : best
    )
}

function sameCell(cell: unknown, other: { col: number; row: number }): boolean {
    const { col, row } = cell as { col: number; row: number }
    return col === other.col && row === other.row
}

function extrasOf(move: Move): number {
    return Number(move.extraCubes ?? 0)
}

// Bid on the tile worth most over its price, or under another player who will clearly buy, to be
// paid $1 for the cube. Once passing is allowed, pass when no bid is worth another cube.
function bid(choice: Choice, rules: Rules, thoughtful: boolean): Move {
    const { view, playerId, moves, random } = choice
    const bids = moves.get(ActionType.PlaceBid) ?? []
    const canPass = moves.has(ActionType.PassBid)
    if (bids.length === 0) return randomMove(choice)
    const base = view.basePrice ?? 0
    const worthTo = new Map<string, number>()
    const worth = (tileId: number, who: string, price: number) => {
        const key = `${tileId}:${who}`
        if (!worthTo.has(key)) {
            const cash = view.getPlayerState(who).cash - price
            worthTo.set(
                key,
                tileWorth(view, rules, tileId, who, planFor(choice, who, cash, thoughtful))
            )
        }
        return worthTo.get(key) ?? 0
    }
    const scored = bids.map((move) => {
        const slot = view.market[Number(move.slot)]
        const tileId = slot.tileId as number
        const price = slot.bids.length + 1 + base
        const mine = worth(tileId, playerId, price) - price
        const leader = slot.bids[0]
        let score: number
        if (leader === undefined) {
            score = mine
        } else if (leader === playerId) {
            // Only raises the bot's own price.
            score = canPass ? -1 : mine - 1
        } else {
            const theyBuy = worth(tileId, leader, price) - price >= BuyMargin
            score = theyBuy ? 1 : 0.25 * Math.max(0, mine)
        }
        return { move, raw: score, score: score + BidJitter * random() }
    })
    if (canPass && Math.max(...scored.map((entry) => entry.raw)) < PassBelow) {
        return only(choice, ActionType.PassBid)
    }
    return scored.reduce((best, entry) => (entry.score > best.score ? entry : best)).move
}
