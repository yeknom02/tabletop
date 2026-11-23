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

// Where the auction board and the grid sit in the table's one SVG, for a given board. On a phone
// the auction spots wrap into rows, so the table is narrow enough to show at a readable size.
export interface TableGeometry {
    width: number
    height: number
    auctionColumns: number
    auction: Point
    grid: Point
    bounds: BoardBounds
}

export function auctionSize(columns: number): { width: number; height: number } {
    const rows = Math.ceil(AuctionSpots / columns)
    return {
        width: columns * SpotWidth + (columns - 1) * SpotGap,
        height: rows * SpotHeight + (rows - 1) * SpotGap
    }
}

export function spotOrigin(slot: number, columns: number): Point {
    return {
        x: (slot % columns) * (SpotWidth + SpotGap),
        y: Math.floor(slot / columns) * (SpotHeight + SpotGap)
    }
}

export function tableGeometry(board: Board, auctionColumns: number): TableGeometry {
    const bounds = boardBounds(board)
    const grid = boardSize(bounds)
    const auction = auctionSize(auctionColumns)
    const width = Math.max(auction.width, grid.width) + 2 * TableMargin
    return {
        width,
        height: auction.height + AuctionToBoardGap + grid.height + 2 * TableMargin,
        auctionColumns,
        auction: { x: (width - auction.width) / 2, y: TableMargin },
        grid: { x: (width - grid.width) / 2, y: TableMargin + auction.height + AuctionToBoardGap },
        bounds
    }
}

export function spotTileOrigin(slot: number, geometry: TableGeometry): Point {
    const spot = spotOrigin(slot, geometry.auctionColumns)
    return {
        x: geometry.auction.x + spot.x + 8 + TrackCell + 6,
        y: geometry.auction.y + spot.y + 8 + TrackCell + 10
    }
}

export function cellTableOrigin(cell: OffsetCoordinates, geometry: TableGeometry): Point {
    const origin = cellOrigin(cell, geometry.bounds)
    return { x: geometry.grid.x + origin.x, y: geometry.grid.y + origin.y }
}
