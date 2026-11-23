import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'

export const DefaultCubesPerRound = 2
export const DefaultMinimumBids = 2

export type ConduitGameConfig = Type.Static<typeof ConduitGameConfig>
// Rule variants the designer is testing with bots. Only cubes per round is offered when creating a
// game; the rest take their defaults (the current printed rules) unless a bot study sets them.
export enum RouteTarget {
    NextLetter = 'next',
    SameLetter = 'same'
}

export enum StartPlayerRule {
    Clockwise = 'clockwise',
    Richest = 'richest'
}

export enum MarketDeal {
    // Fill the market from the A, B, C, D stacks in turn.
    Cycle = 'cycle',
    // Shuffle every tile left after setup into one stack and deal from its top.
    Shuffled = 'shuffled'
}

export enum ExtraCubeCost {
    // Extra cubes on a new station are free (rules v0.8.1).
    Free = 'free',
    // The first extra cube costs $1, the second $2, and so on, paid to the bank.
    Rising = 'rising',
    // Each extra cube costs $1, paid to the bank.
    Flat = 'flat'
}

export enum MarketSize {
    // One tile per player in round 1, then one more than the number of players (rules v0.8.2).
    SmallFirst = 'smallFirst',
    // One more tile than players every round (rules v0.8.1).
    PlusOne = 'plusOne',
    // One tile per player every round.
    Players = 'players'
}

export enum RouteToll {
    // Only a route's own station earns (rules v0.8.1).
    None = 'none',
    // Each other player's Power Station on a route also earns its owner $1 (rules v0.8.2).
    Flat = 'flat'
}

// Number settings accept any digit so bot studies can try values the option list doesn't offer.
export const ConduitGameConfig = Type.Object({
    cubesPerRound: Type.Optional(Type.String({ pattern: '^[0-9]$' })),
    routeTarget: Type.Optional(Type.Enum(RouteTarget)),
    startPlayer: Type.Optional(Type.Enum(StartPlayerRule)),
    minimumBids: Type.Optional(Type.String({ pattern: '^[0-9]$' })),
    marketDeal: Type.Optional(Type.Enum(MarketDeal)),
    extraCubeCost: Type.Optional(Type.Enum(ExtraCubeCost)),
    startingCash: Type.Optional(Type.String({ pattern: '^[0-9]{1,2}$' })),
    routeToll: Type.Optional(Type.Enum(RouteToll)),
    // How much more each player clockwise from the Start Player starts with.
    startingCashStep: Type.Optional(Type.String({ pattern: '^[0-9]$' })),
    marketSize: Type.Optional(Type.Enum(MarketSize))
})

// The designer is playtesting how many cubes move from reserve to supply each round.
export const ConduitGameConfigOptions: GameConfigOptions = [
    {
        id: 'cubesPerRound',
        type: ConfigOptionType.List,
        name: 'Cubes per round',
        description:
            'How many cubes each player moves from reserve to supply at the end of a round',
        default: String(DefaultCubesPerRound),
        options: [
            { name: '2', value: '2' },
            { name: '3', value: '3' },
            { name: '4', value: '4' }
        ]
    }
]

export function routeTargetOf(config: { routeTarget?: unknown }): RouteTarget {
    return config.routeTarget === RouteTarget.SameLetter
        ? RouteTarget.SameLetter
        : RouteTarget.NextLetter
}

export function startPlayerRuleOf(config: { startPlayer?: unknown }): StartPlayerRule {
    return config.startPlayer === StartPlayerRule.Richest
        ? StartPlayerRule.Richest
        : StartPlayerRule.Clockwise
}

export function marketDealOf(config: { marketDeal?: unknown }): MarketDeal {
    return config.marketDeal === MarketDeal.Shuffled ? MarketDeal.Shuffled : MarketDeal.Cycle
}

export function cubesPerRound(config: { cubesPerRound?: unknown }): number {
    return typeof config.cubesPerRound === 'string'
        ? Number(config.cubesPerRound)
        : DefaultCubesPerRound
}

export function minimumBidsOf(config: { minimumBids?: unknown }): number {
    return typeof config.minimumBids === 'string' ? Number(config.minimumBids) : DefaultMinimumBids
}

export function extraCubeCostOf(config: { extraCubeCost?: unknown }): ExtraCubeCost {
    return Object.values(ExtraCubeCost).includes(config.extraCubeCost as ExtraCubeCost)
        ? (config.extraCubeCost as ExtraCubeCost)
        : ExtraCubeCost.Free
}

// What a player pays for this many extra cubes on one new station.
export function extraCubesPrice(extraCubes: number, cost: ExtraCubeCost): number {
    switch (cost) {
        case ExtraCubeCost.Rising:
            return (extraCubes * (extraCubes + 1)) / 2
        case ExtraCubeCost.Flat:
            return extraCubes
        default:
            return 0
    }
}

export const DefaultStartingCash = 5
export const DefaultStartingCashStep = 1

// Rules v0.8.2: the Start Player starts with $5 and each player clockwise with $1 more than the
// one before. Seat 0 is the Start Player.
export function startingCashFor(
    config: { startingCash?: unknown; startingCashStep?: unknown },
    seat: number
): number {
    const base =
        typeof config.startingCash === 'string' ? Number(config.startingCash) : DefaultStartingCash
    const step =
        typeof config.startingCashStep === 'string'
            ? Number(config.startingCashStep)
            : DefaultStartingCashStep
    return base + step * seat
}

export function marketSizeOf(config: { marketSize?: unknown }): MarketSize {
    return Object.values(MarketSize).includes(config.marketSize as MarketSize)
        ? (config.marketSize as MarketSize)
        : MarketSize.SmallFirst
}

// Tiles in a round's market.
export function marketTiles(size: MarketSize, players: number, round: number): number {
    if (size === MarketSize.Players || (size === MarketSize.SmallFirst && round === 1)) {
        return players
    }
    return players + 1
}

export function routeTollOf(config: { routeToll?: unknown }): RouteToll {
    return config.routeToll === RouteToll.None ? RouteToll.None : RouteToll.Flat
}
