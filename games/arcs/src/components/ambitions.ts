import * as Type from 'typebox'

// The three ambition markers. Each starts on its blue side; at the end of each chapter the
// lowest-Power marker not yet flipped turns to its gold side.
export type AmbitionMarkerSide = { first: number; second: number }

export const AmbitionMarkerSides: readonly {
    blue: AmbitionMarkerSide
    gold: AmbitionMarkerSide
}[] = [
    { blue: { first: 5, second: 3 }, gold: { first: 9, second: 4 } },
    { blue: { first: 3, second: 2 }, gold: { first: 6, second: 3 } },
    { blue: { first: 2, second: 0 }, gold: { first: 4, second: 2 } }
]

export const AmbitionMarkerIdSchema = Type.Union([
    Type.Literal(0),
    Type.Literal(1),
    Type.Literal(2)
])
export type AmbitionMarkerId = Type.Static<typeof AmbitionMarkerIdSchema>
export const AmbitionMarkerIds: readonly AmbitionMarkerId[] = [0, 1, 2]

// Power needed to end the game at a chapter's end, by player count.
export const PowerToWin: Readonly<Record<number, number>> = { 2: 33, 3: 30, 4: 27 }

export const LastChapter = 5
