import { StationLetter } from '@tabletop/conduit'

// The outline of a station tile's central emblem, a few units outside the printed shape, centred
// on (0, 0) in the tile's printed orientation (tile = 100 units). Read from the art: A is a
// chamfered square, B a chamfered diamond, C a hexagon with a point at the top, D an octagon.
export function emblemOutline(letter: StationLetter): string {
    const points = emblemPoints(letter)
    return points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')
}

function emblemPoints(letter: StationLetter): [number, number][] {
    switch (letter) {
        case StationLetter.A:
            return chamfered(25, 5)
        case StationLetter.B:
            return turned45(chamfered(23, 3))
        case StationLetter.C:
            return Array.from({ length: 6 }, (_, index) => {
                const angle = ((-90 + index * 60) * Math.PI) / 180
                return [32 * Math.cos(angle), 32 * Math.sin(angle)] as [number, number]
            })
        default:
            return chamfered(31, 12)
    }
}

// A square of half-width `half` with each corner cut back by `cut`.
function chamfered(half: number, cut: number): [number, number][] {
    const near = half - cut
    return [
        [-near, -half],
        [near, -half],
        [half, -near],
        [half, near],
        [near, half],
        [-near, half],
        [-half, near],
        [-half, -near]
    ]
}

function turned45(points: [number, number][]): [number, number][] {
    const c = Math.SQRT1_2
    return points.map(([x, y]) => [c * (x - y), c * (x + y)])
}

function round(value: number): number {
    return Math.round(value * 100) / 100
}
