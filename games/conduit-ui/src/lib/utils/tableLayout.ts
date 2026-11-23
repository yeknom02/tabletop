import type { OffsetCoordinates, Point } from '@tabletop/common'
import type { Board } from '@tabletop/conduit'
import { boardBounds, boardSize, cellOrigin, type BoardBounds } from './boardLayout.js'

// Each auction spot has a tile and an L-shaped bid track of nine spaces: six up the left side from
// the bottom, then three along the top.
export const TrackCell = 30
export const SpotWidth = 4 * TrackCell + 16
export const SpotHeight = 6 * TrackCell + 34
export const SpotGap = 12
export const AuctionSpots = 6
export const AuctionWidth = AuctionSpots * SpotWidth + (AuctionSpots - 1) * SpotGap
export const TableMargin = 20
export const AuctionToBoardGap = 34
export const TileInSpot = 3 * TrackCell - 4

export function trackCellOrigin(index: number): Point {
    return index <= 5 ? { x: 0, y: (5 - index) * TrackCell } : { x: (index - 5) * TrackCell, y: 0 }
}

// SVG text sits on its alphabetic baseline, shifted by a share of its size to look centred.
export function centredTextShift(fontSize: number): number {
    return fontSize * 0.35
}

// Where the auction board and the grid sit in the table's one SVG, for a given board.
export interface TableGeometry {
    width: number
    height: number
    auction: Point
    grid: Point
    bounds: BoardBounds
}

export function tableGeometry(board: Board): TableGeometry {
    const bounds = boardBounds(board)
    const grid = boardSize(bounds)
    const width = Math.max(AuctionWidth, grid.width) + 2 * TableMargin
    return {
        width,
        height: SpotHeight + AuctionToBoardGap + grid.height + 2 * TableMargin,
        auction: { x: (width - AuctionWidth) / 2, y: TableMargin },
        grid: { x: (width - grid.width) / 2, y: TableMargin + SpotHeight + AuctionToBoardGap },
        bounds
    }
}

export function spotTileOrigin(slot: number, geometry: TableGeometry): Point {
    return {
        x: geometry.auction.x + slot * (SpotWidth + SpotGap) + 8 + TrackCell + 6,
        y: geometry.auction.y + 8 + TrackCell + 10
    }
}

export function cellTableOrigin(cell: OffsetCoordinates, geometry: TableGeometry): Point {
    const origin = cellOrigin(cell, geometry.bounds)
    return { x: geometry.grid.x + origin.x, y: geometry.grid.y + origin.y }
}
