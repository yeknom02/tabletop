import type { Point } from '@tabletop/common'

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
