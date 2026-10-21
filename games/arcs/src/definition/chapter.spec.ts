import { describe, expect, it } from 'vitest'
import { Ambition } from '../components/actionCards.js'
import { Resource } from '../components/resources.js'
import { TrophyKind } from '../model/pieces.js'
import type { ArcsProjectedState } from '../model/gameState.js'
import { startTestGame } from '../util/testHelper.js'

function scoring(count: number, setup: (state: ArcsProjectedState, players: string[]) => void) {
    const session = startTestGame(count)
    const players = [...session.state.turnManager.turnOrder]
    session.edit((state) => {
        for (const player of state.players) {
            player.resources = player.resources.map(() => null)
        }
        setup(state, players)
    })
    return { state: session.hydrated(), players }
}

function give(state: ArcsProjectedState, playerId: string, resources: Resource[]) {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    if (player) {
        player.resources = player.resources.map((_, index) => resources[index] ?? null)
    }
}

describe('scoring an ambition', () => {
    it('gives first place the high value and second the low', () => {
        const { state, players } = scoring(3, (draft, [a, b]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Tycoon
            give(draft, a, [Resource.Fuel, Resource.Material])
            give(draft, b, [Resource.Fuel])
        })
        const [a, b] = players
        expect(state.scoreAmbition(Ambition.Tycoon)).toEqual([
            { ambition: Ambition.Tycoon, playerId: a, place: 1, power: 5 },
            { ambition: Ambition.Tycoon, playerId: b, place: 2, power: 3 }
        ])
    })

    it('adds up every marker in the box, and counts Guild card suits', () => {
        const { state, players } = scoring(3, (draft, [a]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Keeper
            draft.ambitionMarkers[1].ambition = Ambition.Keeper
            const player = draft.players.find((candidate) => candidate.playerId === a)
            player?.guildCards.push('BC21')
        })
        expect(state.scoreAmbition(Ambition.Keeper)).toEqual([
            { ambition: Ambition.Keeper, playerId: players[0], place: 1, power: 8 }
        ])
    })

    it('gives tied first places second place, and nothing to a tied second', () => {
        const tiedFirst = scoring(3, (draft, [a, b, c]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Empath
            give(draft, a, [Resource.Psionic])
            give(draft, b, [Resource.Psionic])
            give(draft, c, [])
        })
        expect(tiedFirst.state.scoreAmbition(Ambition.Empath).map((award) => award.power)).toEqual([
            3, 3
        ])
        const tiedSecond = scoring(3, (draft, [a, b, c]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Empath
            give(draft, a, [Resource.Psionic, Resource.Psionic])
            give(draft, b, [Resource.Psionic])
            give(draft, c, [Resource.Psionic])
        })
        expect(tiedSecond.state.scoreAmbition(Ambition.Empath)).toHaveLength(1)
    })

    it('needs at least one of the measure to place', () => {
        const { state } = scoring(3, (draft) => {
            draft.ambitionMarkers[0].ambition = Ambition.Warlord
        })
        expect(state.scoreAmbition(Ambition.Warlord)).toEqual([])
    })

    it('adds the city bonus to an untied first place', () => {
        const { state, players } = scoring(3, (draft, [a, b]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Tyrant
            const winner = draft.players.find((candidate) => candidate.playerId === a)
            if (winner) {
                winner.captives = { [b]: 1 }
                winner.citiesOnBoard = 0
            }
        })
        expect(state.scoreAmbition(Ambition.Tyrant)[0].power).toBe(5 + 5)
        expect(players).toHaveLength(3)
    })

    it('counts the two-player ambition resources as a third player', () => {
        const { state, players } = scoring(2, (draft, [a]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Tycoon
            draft.ambitionResources = [
                { ambition: Ambition.Tycoon, resource: Resource.Fuel },
                { ambition: Ambition.Tycoon, resource: Resource.Material }
            ]
            give(draft, a, [Resource.Fuel])
        })
        // The ambition boxes take first place; the player is second.
        expect(state.scoreAmbition(Ambition.Tycoon)).toEqual([
            { ambition: Ambition.Tycoon, playerId: players[0], place: 2, power: 3 }
        ])
    })
})

describe('cleaning up a chapter', () => {
    it('returns Trophies and Captives once their ambitions were scored', () => {
        const { state, players } = scoring(3, (draft, [a, b]) => {
            draft.ambitionMarkers[0].ambition = Ambition.Warlord
            draft.ambitionMarkers[1].ambition = Ambition.Tyrant
            const player = draft.players.find((candidate) => candidate.playerId === a)
            const rival = draft.players.find((candidate) => candidate.playerId === b)
            if (player && rival) {
                player.trophies = [
                    { owner: b, kind: TrophyKind.Ship },
                    { owner: b, kind: TrophyKind.City }
                ]
                player.captives = { [b]: 2 }
                rival.ships -= 1
                rival.agents -= 2
            }
        })
        const [a, b] = players
        const rival = state.getPlayerState(b)
        const citiesBefore = rival.citiesOnBoard
        const shipsBefore = rival.ships
        state.cleanUpChapter()
        expect(state.getPlayerState(a).trophies).toEqual([])
        expect(state.getPlayerState(a).captives).toEqual({})
        expect(rival.ships).toBe(shipsBefore + 1)
        expect(rival.citiesOnBoard).toBe(citiesBefore + 1)
        expect(rival.agents).toBe(10)
    })

    it('flips the lowest marker each chapter', () => {
        const { state } = scoring(3, () => {})
        state.cleanUpChapter()
        state.cleanUpChapter()
        expect(state.ambitionMarkers.map((marker) => marker.flipped)).toEqual([false, true, true])
        // The 3/2 marker is now 6/3, worth more than the 5/3 one, so it is taken first.
        expect(state.availableMarker()).toBe(1)
    })
})

describe('the end of the game', () => {
    it('ends when someone reaches the Power target, the earliest in turn order winning ties', () => {
        const { state, players } = scoring(4, (draft, [, b, c]) => {
            for (const player of draft.players) {
                player.power = player.playerId === b || player.playerId === c ? 27 : 10
            }
        })
        expect(state.gameIsOver()).toBe(true)
        expect(state.winner()).toBe(players[1])
    })

    it('ends after chapter 5', () => {
        const { state } = scoring(3, (draft) => {
            draft.chapter = 5
        })
        expect(state.gameIsOver()).toBe(true)
    })
})
