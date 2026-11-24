import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'

export const DefaultCubesPerRound = 3
export const DefaultMinimumBids = 2

export type ConduitGameConfig = Type.Static<typeof ConduitGameConfig>
// Rule variants the designer is testing with bots. Only cubes per round is offered when creating a
// game; the rest take their defaults (the current printed rules, v0.8.3) unless a bot study sets
// them. A config without a setting means rules v0.8.3, not the rules it was created under.
export enum RouteTarget {
    NextLetter = 'next',
    SameLetter = 'same'
}

export enum StartPlayerRule {
    Clockwise = 'clockwise',
    Richest = 'richest'
}

// When bidding ends. Minimum: once every player has placed the minimum and every tile has a bid
// (rules v0.8.2). AllPass: from that point players may also pass, a player who passes is out for
// the round, and bidding ends when no one is left to bid. PassAfterOwn (rules v0.8.3): each player
// may pass once they have placed the minimum themselves, even if some tile has no bid; bidding
// ends when no one is left to bid.
export enum BiddingEnd {
    Minimum = 'minimum',
    AllPass = 'allPass',
    PassAfterOwn = 'passAfterOwn'
}

// When a station without cubes flips. AtOnce (rules v0.8.2): revenue removes a cube from every
// station, then every station left without cubes flips. Linger (rules v0.8.3): infrastructure loss
// first flips the stations that were already empty, then removes a cube from every other station,
// so a station stays face up, earning nothing, for one round after its last cube goes.
export enum EmptyStations {
    AtOnce = 'atOnce',
    Linger = 'linger'
}

export enum MarketDeal {
    // Fill the market from the A, B, C, D stacks in turn (rules v0.8.2).
    Cycle = 'cycle',
    // Shuffle every tile left after setup into one stack and deal from its top (rules v0.8.3).
    Shuffled = 'shuffled'
}

export enum ExtraCubeCost {
    // Extra cubes on a new station are free (rules v0.8.1).
    Free = 'free',
    // The first extra cube costs $1, the second $2, and so on, paid to the bank (rules v0.8.3).
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
    marketSize: Type.Optional(Type.Enum(MarketSize)),
    biddingEnd: Type.Optional(Type.Enum(BiddingEnd)),
    // Added to every tile's price, paid to the bank.
    basePrice: Type.Optional(Type.String({ pattern: '^[0-9]$' })),
    // Most cubes a new station may hold, the winning cube included; 4 when absent.
    stationCubeCap: Type.Optional(Type.String({ pattern: '^[1-9]$' })),
    emptyStations: Type.Optional(Type.Enum(EmptyStations))
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
    return config.marketDeal === MarketDeal.Cycle ? MarketDeal.Cycle : MarketDeal.Shuffled
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
        : ExtraCubeCost.Rising
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
export const DefaultStartingCashStep = 0

// Rules v0.8.3: every player starts with $5. Rules v0.8.2 gave each player clockwise from the Start
// Player (seat 0) $1 more than the one before (step 1).
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

export function biddingEndOf(config: { biddingEnd?: unknown }): BiddingEnd {
    return Object.values(BiddingEnd).includes(config.biddingEnd as BiddingEnd)
        ? (config.biddingEnd as BiddingEnd)
        : BiddingEnd.PassAfterOwn
}

export function emptyStationsOf(config: { emptyStations?: unknown }): EmptyStations {
    return config.emptyStations === EmptyStations.AtOnce
        ? EmptyStations.AtOnce
        : EmptyStations.Linger
}

export const DefaultBasePrice = 1
// The winning cube and up to three extras (rules v0.8.3); 9 is effectively no cap.
export const DefaultStationCubeCap = 4

export function basePriceOf(config: { basePrice?: unknown }): number {
    return typeof config.basePrice === 'string' ? Number(config.basePrice) : DefaultBasePrice
}

export function stationCubeCapOf(config: { stationCubeCap?: unknown }): number {
    return typeof config.stationCubeCap === 'string'
        ? Number(config.stationCubeCap)
        : DefaultStationCubeCap
}
