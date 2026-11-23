import type { OffsetCoordinates } from '@tabletop/common'
import {
    BaseLetters,
    MarketDeal,
    nextLetter,
    RouteTarget,
    RouteToll,
    Rounds,
    stationEarnings,
    tileIdsOfLetter,
    type BaseLetter,
    Grid,
    revenueFor,
    stationTile,
    type Board,
    type HydratedConduitGameState,
    type PlacedStation
} from '../../../src/index.js'

export type PlacementChoice = { cell: OffsetCoordinates; rotation: number }

// What every Power Station would earn if revenue were paid now, tolls included, summed per owner.
export function revenueByOwner(
    board: Board,
    routeTarget: RouteTarget,
    routeToll: RouteToll = RouteToll.None
): Map<string, number> {
    const totals = new Map<string, number>()
    const add = (playerId: string, amount: number) =>
        totals.set(playerId, (totals.get(playerId) ?? 0) + amount)
    for (const earning of stationEarnings(board, routeTarget, routeToll)) {
        add(earning.ownerId, earning.amount)
        for (const toll of earning.tolls) add(toll.playerId, toll.amount)
    }
    return totals
}

export function placementChoices(
    state: HydratedConduitGameState,
    tileId: number,
    faceUp: boolean
): PlacementChoice[] {
    return state
        .grid()
        .legalPlacements(tileId, faceUp)
        .flatMap((option) => option.rotations.map((rotation) => ({ cell: option.cell, rotation })))
}

export type PlacementEffect = {
    choice: PlacementChoice
    // Change in what each player's stations would earn now, the new station included.
    gain: Map<string, number>
    // What the new station alone would earn per payout, for a face-up tile.
    stationPayout: number
}

export function placementEffects(
    state: HydratedConduitGameState,
    tileId: number,
    faceUp: boolean,
    ownerId: string | undefined,
    routeTarget: RouteTarget,
    routeToll: RouteToll = RouteToll.None
): PlacementEffect[] {
    const before = revenueByOwner(state.board, routeTarget, routeToll)
    return placementChoices(state, tileId, faceUp).map((choice) => {
        const station: PlacedStation = {
            cell: choice.cell,
            tileId,
            rotation: choice.rotation,
            faceUp,
            cubes: faceUp ? 1 : 0,
            ...(faceUp && ownerId ? { ownerId } : {})
        }
        const board: Board = { stations: [...state.board.stations, station] }
        const after = revenueByOwner(board, routeTarget, routeToll)
        const gain = new Map<string, number>()
        for (const player of state.players) {
            const id = player.playerId
            gain.set(id, (after.get(id) ?? 0) - (before.get(id) ?? 0))
        }
        const stationPayout = faceUp
            ? revenueFor(new Grid(board).bestRoute(choice.cell, routeTarget))
            : 0
        return { choice, gain, stationPayout }
    })
}

export function letterOf(tileId: number): string {
    return stationTile(tileId).letter
}

// The letter a station's route must end at.
export function destinationLetter(tileId: number, routeTarget: RouteTarget): BaseLetter {
    const letter = stationTile(tileId).letter
    const target = routeTarget === RouteTarget.SameLetter ? letter : nextLetter(letter)
    const base = BaseLetters.find((candidate) => candidate === target)
    if (!base) throw Error(`No base letter ${target}`)
    return base
}

// Tiles of each letter nobody has seen: not on the board and not in the market. Public knowledge
// in either market deal, since every dealt tile is turned face up.
export function unseenByLetter(state: HydratedConduitGameState): Map<BaseLetter, number> {
    const seen = new Set([
        ...state.board.stations.map((station) => station.tileId),
        ...state.market.flatMap((slot) => (slot.tileId === undefined ? [] : [slot.tileId]))
    ])
    return new Map(
        BaseLetters.map((letter) => [
            letter,
            tileIdsOfLetter(letter).filter((tileId) => !seen.has(tileId)).length
        ])
    )
}

// The chance that the next market holds at least one tile of a letter. The cycle deals every
// letter whenever the market has four or more spots; the shuffled stack is a draw without
// replacement from the unseen tiles.
export function nextMarketChance(
    state: HydratedConduitGameState,
    letter: BaseLetter,
    marketDeal: MarketDeal
): number {
    if (state.round >= Rounds) return 0
    const spots = state.players.length + 1
    if (marketDeal === MarketDeal.Cycle) {
        const start = BaseLetters.indexOf(state.nextLetter)
        const dealt = Array.from({ length: spots }, (_, i) => BaseLetters[(start + i) % 4])
        return dealt.includes(letter) && state.stacks[letter].remaining > 0 ? 1 : 0
    }
    const unseen = unseenByLetter(state)
    const total = [...unseen.values()].reduce((sum, count) => sum + count, 0)
    const others = total - (unseen.get(letter) ?? 0)
    let none = 1
    for (let draw = 0; draw < spots; draw++) none *= Math.max(0, others - draw) / (total - draw)
    return 1 - none
}
