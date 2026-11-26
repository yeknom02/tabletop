import { assert } from '@tabletop/common'
import sheet from '$lib/images/tiles.webp'

// One sheet holds every tile: faces 1-64 in order, then the back. Each 256px frame sits in a
// 260px cell whose 2px border repeats the frame's edge.
export const TileSheetUrl = sheet
export const TileFrameSize = 256
const Gutter = 2
const Cell = TileFrameSize + 2 * Gutter
const Columns = 13
const Faces = 64
export const TileSheetWidth = Columns * Cell
export const TileSheetHeight = Math.ceil((Faces + 1) / Columns) * Cell

// The frame of a tile's face, or of the back when no tile is given.
export function tileFrame(tileId?: number): { x: number; y: number } {
    if (tileId !== undefined) {
        assert(
            Number.isInteger(tileId) && tileId >= 1 && tileId <= Faces,
            `No art for tile ${tileId}`
        )
    }
    const index = tileId === undefined ? Faces : tileId - 1
    return {
        x: (index % Columns) * Cell + Gutter,
        y: Math.floor(index / Columns) * Cell + Gutter
    }
}
