import {
    assert,
    assertExists,
    DrawBag,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedDrawBag,
    HydratedRoundManager,
    HydratedTurnManager,
    OffsetCoordinates,
    PrngState,
    RoundManager,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { BaseLetters, type BaseLetter, StationLetter } from '../components/tiles.js'
import {
    BiddingEnd,
    EmptyStations,
    MarketSize,
    marketTiles,
    RouteTarget,
    RouteToll,
    StartPlayerRule
} from '../definition/gameConfig.js'
import { Board, Grid, type PlacedStation, type Route } from './board.js'
import { ConduitPlayerState, HydratedConduitPlayerState } from './playerState.js'

export const Rounds = 5
export const BidTrackSpaces = 9

export type StationStack = Type.Static<typeof StationStack>
export const StationStack = DrawBag(Type.Integer())

const StationStackValidator = Compile(StationStack)

export class HydratedStationStack
    extends HydratedDrawBag<number, typeof StationStack>
    implements StationStack
{
    constructor(data: StationStack) {
        super(data, StationStackValidator)
    }
}

export type Stacks = Type.Static<typeof Stacks>
export const Stacks = Type.Object({
    [StationLetter.A]: StationStack,
    [StationLetter.B]: StationStack,
    [StationLetter.C]: StationStack,
    [StationLetter.D]: StationStack
})

export const BaseLetterSchema = Type.Union([
    Type.Literal(StationLetter.A),
    Type.Literal(StationLetter.B),
    Type.Literal(StationLetter.C),
    Type.Literal(StationLetter.D)
])

// A spot on the auction board. Bids list the cube owners from the bottom of the track up.
export type MarketSlot = Type.Static<typeof MarketSlot>
export const MarketSlot = Type.Object({
    tileId: Type.Optional(Type.Integer()),
    bids: Type.Array(Type.String()),
    buyerId: Type.Optional(Type.String())
})

export type Payment = Type.Static<typeof Payment>
export const Payment = Type.Object({
    playerId: Type.String(),
    amount: Type.Integer()
})

export type StationRevenue = Type.Static<typeof StationRevenue>
export const StationRevenue = Type.Object({
    playerId: Type.String(),
    tileId: Type.Integer(),
    route: Type.Array(OffsetCoordinates),
    amount: Type.Integer(),
    // Tolls paid to other players' Power Stations on the route, in the route-toll variant.
    tolls: Type.Optional(Type.Array(Payment))
})

export interface Offer {
    slot: number
    tileId: number
    playerId: string
    price: number
}

// A station whose equally good routes would pay tolls to different players: its owner chooses
// among them before revenue (designer ruling, 2026-11-25). Each option is one route for each
// distinct set of players its tolls would pay.
export type RouteOption = Type.Static<typeof RouteOption>
export const RouteOption = Type.Object({
    cells: Type.Array(OffsetCoordinates),
    // The players the route's tolls would pay, one entry per station passed.
    tolls: Type.Array(Type.String())
})

export type RouteChoice = Type.Static<typeof RouteChoice>
export const RouteChoice = Type.Object({
    tileId: Type.Integer(),
    playerId: Type.String(),
    options: Type.Array(RouteOption),
    chosen: Type.Optional(Type.Integer({ minimum: 0 }))
})

export interface PendingPlacement {
    slot: number
    tileId: number
    playerId: string
    faceUp: boolean
}

export type ConduitGameState = Type.Static<typeof ConduitGameState>
export const ConduitGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(ConduitPlayerState),
            machineState: Type.Enum(MachineState),
            roundManager: RoundManager,
            stacks: Stacks,
            // In the shuffled-market variant, every tile left after setup in one stack.
            deck: Type.Optional(StationStack),
            nextLetter: BaseLetterSchema,
            market: Type.Array(MarketSlot),
            board: Board,
            // Added to every tile's price in the base-price variant.
            basePrice: Type.Optional(Type.Integer({ minimum: 0 })),
            // Players out of this round's bidding, in the bid-until-all-pass variant.
            bidPasses: Type.Optional(Type.Array(Type.String())),
            // Routes owners are choosing, or have chosen, for the revenue about to be paid.
            routeChoices: Type.Optional(Type.Array(RouteChoice))
        })
    ])
)

export const ConduitGameStateValidator = Compile(ConduitGameState)

export const ConduitProjectedState = Visibility.createProjectionSchema(ConduitGameState)
export type ConduitProjectedState = Type.Static<typeof ConduitProjectedState>
const ConduitProjectedStateValidator = Compile(ConduitProjectedState)

export class HydratedConduitGameState
    extends HydratableGameState<typeof ConduitProjectedState, HydratedConduitPlayerState>
    implements ConduitProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedConduitPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare roundManager: HydratedRoundManager
    declare stacks: Stacks
    declare deck?: StationStack
    declare nextLetter: BaseLetter
    declare market: MarketSlot[]
    declare board: Board
    declare basePrice?: number
    declare bidPasses?: string[]
    declare routeChoices?: RouteChoice[]

    constructor(data: ConduitProjectedState) {
        super(data, ConduitProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedConduitPlayerState(player))
        this.roundManager = new HydratedRoundManager(data.roundManager)
    }

    get round(): number {
        return this.roundManager.series.length
    }

    // After the fifth round, revenue and infrastructure loss repeat until no cubes are left.
    isPayingOut(): boolean {
        return this.round >= Rounds
    }

    startPlayerId(): string {
        return this.turnManager.turnOrder[0]
    }

    grid(): Grid {
        return new Grid(this.board)
    }

    // The market is drawn from the stacks in letter order, carrying on from where the last fill
    // stopped, or from the top of the one shuffled stack.
    fillMarket(size: MarketSize = MarketSize.SmallFirst): number[] {
        this.roundManager.startRound(this.actionCount)
        const count = marketTiles(size, this.players.length, this.round)
        const tileIds = Array.from({ length: count }, () => this.drawNextTile())
        this.market = tileIds.map((tileId) => ({ tileId, bids: [] }))
        if (this.bidPasses) this.bidPasses = []
        return tileIds
    }

    private drawNextTile(): number {
        if (this.deck) {
            const deck = new HydratedStationStack(this.deck)
            assert(!deck.isEmpty(), 'The stack has run out')
            const tileId = deck.draw()
            this.deck = deck.dehydrate()
            return tileId
        }
        const letter = this.nextLetter
        this.nextLetter = BaseLetters[(BaseLetters.indexOf(letter) + 1) % BaseLetters.length]
        const stack = new HydratedStationStack(this.stacks[letter])
        assert(!stack.isEmpty(), `The ${letter} stack has run out`)
        const tileId = stack.draw()
        this.stacks[letter] = stack.dehydrate()
        return tileId
    }

    bidsBy(playerId: string): number {
        return this.market.reduce(
            (total, slot) => total + slot.bids.filter((bidder) => bidder === playerId).length,
            0
        )
    }

    biddableSlots(): number[] {
        return this.market
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => slot.tileId !== undefined && slot.bids.length < BidTrackSpaces)
            .map(({ index }) => index)
    }

    canBid(playerId: string): boolean {
        return (
            this.getPlayerState(playerId).supply > 0 &&
            this.biddableSlots().length > 0 &&
            !this.bidPasses?.includes(playerId)
        )
    }

    // Every player has placed the minimum (two cubes in rules v0.8.1, three before), or has no
    // cube left, and every tile has a bid.
    isMinimumBiddingDone(minimumBids: number): boolean {
        const everyPlayerDone = this.players.every(
            (player) => this.bidsBy(player.playerId) >= minimumBids || player.supply === 0
        )
        return everyPlayerDone && this.market.every((slot) => slot.bids.length > 0)
    }

    // Bidding goes on until the minimum is done. A player with an empty supply is skipped, so
    // bidding also ends once no one can bid (designer rulings). In the bid-until-all-pass variant
    // it goes on past the minimum until everyone has passed or cannot bid; in rules v0.8.3 each
    // player may pass once they have placed the minimum themselves.
    isBiddingOver(minimumBids: number, end: BiddingEnd = BiddingEnd.Minimum): boolean {
        const anyoneCanBid = this.players.some((player) => this.canBid(player.playerId))
        if (end !== BiddingEnd.Minimum) return !anyoneCanBid
        return this.isMinimumBiddingDone(minimumBids) || !anyoneCanBid
    }

    canPassBid(playerId: string, minimumBids: number, end: BiddingEnd): boolean {
        switch (end) {
            case BiddingEnd.AllPass:
                return this.isMinimumBiddingDone(minimumBids) && this.canBid(playerId)
            case BiddingEnd.PassAfterOwn:
                return this.bidsBy(playerId) >= minimumBids && this.canBid(playerId)
            default:
                return false
        }
    }

    passBid(playerId: string) {
        this.bidPasses = [...(this.bidPasses ?? []), playerId]
    }

    placeBid(playerId: string, slot: number) {
        assert(this.biddableSlots().includes(slot), `Slot ${slot} cannot take a bid`)
        this.getPlayerState(playerId).takeFromSupply(1)
        this.market[slot].bids.push(playerId)
    }

    private unresolvedSlot(): number | undefined {
        const index = this.market.findIndex((slot) => slot.tileId !== undefined)
        return index < 0 ? undefined : index
    }

    currentOffer(): Offer | undefined {
        const slot = this.unresolvedSlot()
        if (slot === undefined) {
            return undefined
        }
        const { tileId, bids, buyerId } = this.market[slot]
        if (tileId === undefined || buyerId !== undefined || bids.length === 0) {
            return undefined
        }
        return { slot, tileId, playerId: bids[0], price: bids.length + (this.basePrice ?? 0) }
    }

    // A bought tile is placed face up by its buyer. A tile no one bought goes face down, placed by
    // the Start Player.
    pendingPlacement(): PendingPlacement | undefined {
        const slot = this.unresolvedSlot()
        if (slot === undefined) {
            return undefined
        }
        const { tileId, bids, buyerId } = this.market[slot]
        assertExists(tileId, 'An unresolved slot holds its tile')
        if (buyerId !== undefined) {
            return { slot, tileId, playerId: buyerId, faceUp: true }
        }
        if (bids.length === 0) {
            return { slot, tileId, playerId: this.startPlayerId(), faceUp: false }
        }
        return undefined
    }

    isResolutionOver(): boolean {
        return this.unresolvedSlot() === undefined
    }

    // The price is one dollar per cube on the track, plus the base price if any, paid to the bank. Each other player's cube earns its owner a
    // dollar and goes back to their supply; each of the buyer's own goes to the bank. The bottom
    // cube will go onto the tile; the buyer's other cubes go back to their supply (designer ruling).
    buyTile(playerId: string): Payment[] {
        const offer = this.currentOffer()
        assertExists(offer, 'A tile is on offer')
        assert(offer.playerId === playerId, `Player ${playerId} is not being offered the tile`)
        const buyer = this.getPlayerState(playerId)
        buyer.pay(offer.price)

        const slot = this.market[offer.slot]
        const [, ...others] = slot.bids
        const payments = new Map<string, number>()
        for (const bidderId of others) {
            payments.set(bidderId, (payments.get(bidderId) ?? 0) + 1)
            this.getPlayerState(bidderId).returnToSupply(1)
            if (bidderId !== playerId) {
                this.getPlayerState(bidderId).earn(1)
            }
        }
        slot.bids = []
        slot.buyerId = playerId
        return [...payments.entries()]
            .filter(([bidderId]) => bidderId !== playerId)
            .map(([bidderId, amount]) => ({ playerId: bidderId, amount }))
    }

    // Passing takes a dollar from the bank and returns the passer's bottom cube, along with any of
    // their cubes directly above it, to their supply (designer ruling). Returns the cubes removed.
    passTile(playerId: string): number {
        const offer = this.currentOffer()
        assertExists(offer, 'A tile is on offer')
        assert(offer.playerId === playerId, `Player ${playerId} is not being offered the tile`)
        const slot = this.market[offer.slot]
        const run = slot.bids.findIndex((bidderId) => bidderId !== playerId)
        const removed = run < 0 ? slot.bids.length : run
        slot.bids.splice(0, removed)
        const passer = this.getPlayerState(playerId)
        passer.returnToSupply(removed)
        passer.earn(1)
        return removed
    }

    canAfford(playerId: string): boolean {
        const offer = this.currentOffer()
        return offer !== undefined && this.getPlayerState(playerId).cash >= offer.price
    }

    // Extra cubes are free unless the variant being tested charges for them (extraCubesPrice).
    placeTile(
        playerId: string,
        cell: OffsetCoordinates,
        rotation: number,
        extraCubes: number,
        extraPrice = 0
    ) {
        const placement = this.pendingPlacement()
        assertExists(placement, 'A tile is waiting to be placed')
        assert(placement.playerId === playerId, `Player ${playerId} is not placing the tile`)
        const face = { tileId: placement.tileId, rotation, faceUp: placement.faceUp }
        assert(this.grid().isLegalPlacement(face, cell), 'The tile cannot go there')
        assert(placement.faceUp || extraCubes === 0, 'A face-down tile takes no cubes')

        const station: PlacedStation = { cell, ...face, cubes: 0 }
        if (placement.faceUp) {
            const player = this.getPlayerState(playerId)
            assert(player.cash >= extraPrice, 'The player cannot pay for the extra cubes')
            player.pay(extraPrice)
            player.takeFromSupply(extraCubes)
            station.ownerId = playerId
            station.cubes = 1 + extraCubes
        }
        this.board.stations.push(station)
        this.market[placement.slot] = { bids: [] }
    }

    // The stations whose owners must choose a route before revenue: those whose equally good
    // routes would pay tolls to different players. Owners choose in turn order from the Start
    // Player; one owner's stations in board order. Without tolls there is nothing to choose.
    findRouteChoices(routeTarget: RouteTarget, routeToll: RouteToll): RouteChoice[] {
        if (routeToll !== RouteToll.Flat) return []
        const grid = this.grid()
        const choices: RouteChoice[] = []
        for (const station of this.ownedStations()) {
            const ownerId = station.ownerId
            if (ownerId === undefined) continue
            const options = new Map<string, RouteOption>()
            for (const route of grid.bestRoutes(station.cell, routeTarget)) {
                const tolls = tollPayees(grid, route.cells, ownerId).toSorted()
                const key = tolls.join(',')
                if (!options.has(key)) options.set(key, { cells: route.cells, tolls })
            }
            if (options.size > 1) {
                choices.push({
                    tileId: station.tileId,
                    playerId: ownerId,
                    options: [...options.values()]
                })
            }
        }
        const order = this.turnManager.turnOrder
        return choices.toSorted((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId))
    }

    pendingRouteChoice(): RouteChoice | undefined {
        return this.routeChoices?.find((choice) => choice.chosen === undefined)
    }

    chooseRoute(playerId: string, tileId: number, option: number) {
        const choice = this.pendingRouteChoice()
        assertExists(choice, 'A route is waiting to be chosen')
        assert(choice.playerId === playerId, `Player ${playerId} is not choosing a route`)
        assert(choice.tileId === tileId, `Tile ${tileId} is not the route being chosen`)
        assert(option >= 0 && option < choice.options.length, `No route option ${option}`)
        choice.chosen = option
    }

    // The routes owners chose, by station tile.
    chosenRoutes(): Map<number, OffsetCoordinates[]> {
        return new Map(
            (this.routeChoices ?? []).flatMap((choice) =>
                choice.chosen === undefined
                    ? []
                    : [[choice.tileId, choice.options[choice.chosen].cells] as const]
            )
        )
    }

    ownedStations(): PlacedStation[] {
        return this.board.stations.filter((station) => station.ownerId !== undefined)
    }

    // Each Power Station pays $1 plus $1 per station on its route, then loses a cube to its owner's
    // reserve. A station with no route earns nothing but still loses the cube. With the route toll,
    // every other player's Power Station on the route also earns its owner $1. Every station's
    // earnings are worked out before any cube is removed. When empty stations linger (rules
    // v0.8.3), the cube comes off during infrastructure loss instead.
    payRevenue(
        routeTarget: RouteTarget,
        routeToll = RouteToll.None,
        emptyStations = EmptyStations.AtOnce
    ): StationRevenue[] {
        const earnings = stationEarnings(this.board, routeTarget, routeToll, this.chosenRoutes())
        this.routeChoices = undefined
        for (const { station, ownerId, amount, tolls } of earnings) {
            const owner = this.getPlayerState(ownerId)
            owner.earn(amount)
            for (const toll of tolls) {
                this.getPlayerState(toll.playerId).earn(toll.amount)
            }
            if (emptyStations === EmptyStations.AtOnce) {
                station.cubes -= 1
                owner.retireCube()
            }
        }
        return earnings.map(({ station, ownerId, route, amount, tolls }) => ({
            playerId: ownerId,
            tileId: station.tileId,
            route: route?.cells ?? [],
            amount,
            ...(tolls.length > 0 ? { tolls } : {})
        }))
    }

    // Stations left without cubes flip face down, the setup cross included, so the cross flips at
    // the end of round 1 (rules v0.8.2). When empty stations linger (rules v0.8.3), every other
    // station then loses a cube to its owner's reserve; one left empty stays face up with no owner
    // (no cube marks it) until the next infrastructure loss. Returns the tiles flipped.
    loseInfrastructure(emptyStations = EmptyStations.AtOnce): number[] {
        const flipped = this.board.stations.filter(
            (station) => station.faceUp && station.cubes === 0
        )
        for (const station of flipped) {
            station.faceUp = false
            delete station.ownerId
        }
        if (emptyStations === EmptyStations.Linger) {
            for (const station of this.board.stations) {
                if (station.cubes === 0) continue
                station.cubes -= 1
                if (station.ownerId !== undefined) {
                    this.getPlayerState(station.ownerId).retireCube()
                }
                if (station.cubes === 0) delete station.ownerId
            }
        }
        return flipped.map((station) => station.tileId)
    }

    cubesOnBoard(): number {
        return this.board.stations.reduce((total, station) => total + station.cubes, 0)
    }

    // The round ends with every player moving cubes from reserve to supply, except after the fifth
    // round, and the Start Player marker passing clockwise.
    endRound(cubesPerRound: number, startPlayerRule: StartPlayerRule): Payment[] {
        this.roundManager.endRound(this.actionCount)
        const refills = this.isPayingOut()
            ? []
            : this.players.map((player) => ({
                  playerId: player.playerId,
                  amount: player.refillSupply(cubesPerRound)
              }))
        this.turnManager.newFirstPlayer(this.nextStartPlayerId(startPlayerRule))
        return refills
    }

    // The marker passes clockwise. In the variant being tested it goes to the player with the most
    // cash, the first of them clockwise from the current Start Player's left on a tie.
    private nextStartPlayerId(rule: StartPlayerRule): string {
        const next = this.turnManager.nextPlayer(this.startPlayerId())
        if (rule === StartPlayerRule.Clockwise) {
            return next
        }
        const order = this.turnManager.turnOrder
        const fromNext = [
            ...order.slice(order.indexOf(next)),
            ...order.slice(0, order.indexOf(next))
        ]
        const most = Math.max(...this.players.map((player) => player.cash))
        const richest = fromNext.find((playerId) => this.getPlayerState(playerId).cash === most)
        assertExists(richest, 'Someone has the most cash')
        return richest
    }

    // Most cash wins; ties go to the most cubes in supply, and players still tied share the win.
    leadingPlayerIds(): string[] {
        const rank = (player: HydratedConduitPlayerState) => [player.cash, player.supply]
        const best = this.players.reduce((leader, player) =>
            compareRanks(rank(player), rank(leader)) > 0 ? player : leader
        )
        return this.players
            .filter((player) => compareRanks(rank(player), rank(best)) === 0)
            .map((player) => player.playerId)
    }
}

export function revenueFor(route: Route | undefined): number {
    return route ? 1 + route.stations : 0
}

export interface StationEarning {
    station: PlacedStation
    ownerId: string
    route: Route | undefined
    amount: number
    tolls: Payment[]
}

// What each owned station would earn if revenue were paid now. A toll goes to every Power Station
// (face up, with a cube) on the route that another player owns, the destination included; the
// unowned setup tiles never collect.
// A station's owner's chosen route, where they had a choice, replaces the one the search finds.
export function stationEarnings(
    board: Board,
    routeTarget: RouteTarget,
    routeToll: RouteToll = RouteToll.None,
    chosen: ReadonlyMap<number, OffsetCoordinates[]> = new Map()
): StationEarning[] {
    const grid = new Grid(board)
    return board.stations.flatMap((station) => {
        const ownerId = station.ownerId
        if (ownerId === undefined) {
            return []
        }
        const cells = chosen.get(station.tileId)
        const route = cells
            ? {
                  cells,
                  stations: cells.filter((cell) => grid.stationAt(cell)?.faceUp).length
              }
            : grid.bestRoute(station.cell, routeTarget)
        const tolls =
            routeToll === RouteToll.Flat && route
                ? tollPayees(grid, route.cells, ownerId).map((playerId) => ({
                      playerId,
                      amount: 1
                  }))
                : []
        return [{ station, ownerId, route, amount: revenueFor(route), tolls }]
    })
}

// The players a route's tolls pay: the owner of each other player's Power Station it passes (face
// up, with a cube), the destination included.
function tollPayees(grid: Grid, cells: OffsetCoordinates[], ownerId: string): string[] {
    return cells.slice(1).flatMap((cell) => {
        const passed = grid.stationAt(cell)
        return passed?.ownerId !== undefined &&
            passed.ownerId !== ownerId &&
            passed.faceUp &&
            passed.cubes > 0
            ? [passed.ownerId]
            : []
    })
}

function compareRanks(a: number[], b: number[]): number {
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) {
            return a[index] - b[index]
        }
    }
    return 0
}
