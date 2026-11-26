import type { StationLetter } from '@tabletop/conduit'
import { CellSize } from './boardLayout.js'
import { TileArtSize, emblemPath } from './tileArt.js'

// The ring's 4.5-unit stroke sits this far outside the emblem, leaving an even 3-unit gap.
const RingOffset = 5.25

export function emblemRing(letter: StationLetter): string {
    const scale = CellSize / TileArtSize
    return emblemPath(letter, RingOffset / scale, scale)
}
