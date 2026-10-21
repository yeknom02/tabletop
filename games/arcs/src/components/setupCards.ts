import * as Type from 'typebox'
import { Clusters, type Cluster, type SystemId } from './map.js'

// Where one seat starts, as its setup card's A, B and C boxes: 3 ships and a city at A, 3 ships
// and a starport at B, and 2 ships at each C system.
export type SeatStart = {
    A: SystemId
    B: SystemId
    C: readonly SystemId[]
}

export type SetupCard = {
    id: SetupCardId
    name: string
    players: 2 | 3 | 4
    outOfPlay: readonly Cluster[]
    // Seat 1 is the player with initiative; later seats follow clockwise.
    seats: readonly SeatStart[]
}

export enum SetupCardId {
    TwoFrontiers = '2-frontiers',
    TwoMixUp1 = '2-mix-up-1',
    TwoHomelands = '2-homelands',
    TwoMixUp2 = '2-mix-up-2',
    ThreeMixUp = '3-mix-up',
    ThreeFrontiers = '3-frontiers',
    ThreeHomelands = '3-homelands',
    ThreeCoreConflict = '3-core-conflict',
    FourMixUp1 = '4-mix-up-1',
    FourMixUp2 = '4-mix-up-2',
    FourFrontiers = '4-frontiers',
    FourMixUp3 = '4-mix-up-3'
}

export const SetupCardIdSchema = Type.Enum(SetupCardId)

// Transcribed from the twelve setup cards (docs/map.md).
export const SetupCards: Readonly<Record<SetupCardId, SetupCard>> = {
    [SetupCardId.TwoFrontiers]: {
        id: SetupCardId.TwoFrontiers,
        name: 'Frontiers',
        players: 2,
        outOfPlay: [1, 6],
        seats: [
            { A: '5H', B: '4H', C: ['3G', '3H'] },
            { A: '3A', B: '5A', C: ['5G', '4A'] }
        ]
    },
    [SetupCardId.TwoMixUp1]: {
        id: SetupCardId.TwoMixUp1,
        name: 'Mix Up 1',
        players: 2,
        outOfPlay: [2, 5],
        seats: [
            { A: '4C', B: '3C', C: ['1G', '6A'] },
            { A: '6H', B: '3H', C: ['4G', '1C'] }
        ]
    },
    [SetupCardId.TwoHomelands]: {
        id: SetupCardId.TwoHomelands,
        name: 'Homelands',
        players: 2,
        outOfPlay: [1, 4],
        seats: [
            { A: '5A', B: '6A', C: ['5G', '5H'] },
            { A: '3H', B: '3A', C: ['3G', '2A'] }
        ]
    },
    [SetupCardId.TwoMixUp2]: {
        id: SetupCardId.TwoMixUp2,
        name: 'Mix Up 2',
        players: 2,
        outOfPlay: [1, 4],
        seats: [
            { A: '5C', B: '2A', C: ['3G', '6C'] },
            { A: '2C', B: '6A', C: ['5G', '3H'] }
        ]
    },
    [SetupCardId.ThreeMixUp]: {
        id: SetupCardId.ThreeMixUp,
        name: 'Mix Up',
        players: 3,
        outOfPlay: [1, 4],
        seats: [
            { A: '3H', B: '5C', C: ['2G'] },
            { A: '5H', B: '2A', C: ['3G'] },
            { A: '2H', B: '3A', C: ['5G'] }
        ]
    },
    [SetupCardId.ThreeFrontiers]: {
        id: SetupCardId.ThreeFrontiers,
        name: 'Frontiers',
        players: 3,
        outOfPlay: [2, 3],
        seats: [
            { A: '1H', B: '4H', C: ['6G'] },
            { A: '5H', B: '1C', C: ['5G'] },
            { A: '4C', B: '6A', C: ['1G'] }
        ]
    },
    [SetupCardId.ThreeHomelands]: {
        id: SetupCardId.ThreeHomelands,
        name: 'Homelands',
        players: 3,
        outOfPlay: [5, 6],
        seats: [
            { A: '2H', B: '3C', C: ['3G'] },
            { A: '1H', B: '2A', C: ['2G'] },
            { A: '1A', B: '4H', C: ['4G'] }
        ]
    },
    [SetupCardId.ThreeCoreConflict]: {
        id: SetupCardId.ThreeCoreConflict,
        name: 'Core Conflict',
        players: 3,
        outOfPlay: [3, 6],
        seats: [
            { A: '1H', B: '2C', C: ['1G'] },
            { A: '2H', B: '1C', C: ['2G'] },
            { A: '1A', B: '2A', C: ['4G'] }
        ]
    },
    [SetupCardId.FourMixUp1]: {
        id: SetupCardId.FourMixUp1,
        name: 'Mix Up 1',
        players: 4,
        outOfPlay: [3],
        seats: [
            { A: '4A', B: '6H', C: ['1G'] },
            { A: '4H', B: '5H', C: ['6G'] },
            { A: '5A', B: '1H', C: ['4G'] },
            { A: '6A', B: '1A', C: ['5G'] }
        ]
    },
    [SetupCardId.FourMixUp2]: {
        id: SetupCardId.FourMixUp2,
        name: 'Mix Up 2',
        players: 4,
        outOfPlay: [4],
        seats: [
            { A: '5H', B: '3A', C: ['2G'] },
            { A: '3H', B: '5C', C: ['1G'] },
            { A: '2H', B: '1H', C: ['3G'] },
            { A: '1A', B: '2A', C: ['5G'] }
        ]
    },
    [SetupCardId.FourFrontiers]: {
        id: SetupCardId.FourFrontiers,
        name: 'Frontiers',
        players: 4,
        outOfPlay: [5],
        seats: [
            { A: '1H', B: '3C', C: ['2G'] },
            { A: '2H', B: '6H', C: ['3G'] },
            { A: '4C', B: '2A', C: ['6G'] },
            { A: '1A', B: '6A', C: ['4G'] }
        ]
    },
    [SetupCardId.FourMixUp3]: {
        id: SetupCardId.FourMixUp3,
        name: 'Mix Up 3',
        players: 4,
        outOfPlay: [6],
        seats: [
            { A: '3H', B: '5C', C: ['1G'] },
            { A: '1A', B: '3A', C: ['2G'] },
            { A: '1H', B: '4H', C: ['3G'] },
            { A: '4A', B: '2C', C: ['5G'] }
        ]
    }
}

export function setupCardsFor(players: number): SetupCard[] {
    return Object.values(SetupCards).filter((card) => card.players === players)
}

export function clustersInPlay(card: SetupCard): Cluster[] {
    return Clusters.filter((cluster) => !card.outOfPlay.includes(cluster))
}
