import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { MachineState } from './states.js'
import { isBuyTile } from '../actions/buyTile.js'
import { isPayRevenue } from '../actions/payRevenue.js'
import { isLoseInfrastructure } from '../actions/loseInfrastructure.js'
import { StationLetter, stationTile } from '../components/tiles.js'
import { type ConduitProjectedState, Rounds } from '../model/gameState.js'
import { startTestGame, type TestSession } from '../testing/table.js'

const letters = (tileIds: (number | undefined)[]) =>
    tileIds.map((tileId) => (tileId === undefined ? '-' : stationTile(tileId).letter))

// Each bidder in turn bids on the next spot along, wrapping around, until bidding ends.
function bidAround(session: TestSession) {
    let spot = 0
    while (session.state.machineState === MachineState.Bidding) {
        session.bid(spot % session.state.market.length)
        spot += 1
    }
}

// Rewrites the track of the tile on offer and hands the offer to its new bottom cube.
function setOfferTrack(session: TestSession, bids: string[]) {
    session.edit((draft) => {
        const slot = draft.market.findIndex((candidate) => candidate.tileId !== undefined)
        draft.market[slot].bids = bids
        draft.activePlayerIds = [bids[0]]
        const turn = draft.turnManager.series.at(-1)
        assertExists(turn, 'The offer is a turn')
        turn.playerId = bids[0]
    })
}

function player(state: ConduitProjectedState, playerId: string) {
    const found = state.players.find((candidate) => candidate.playerId === playerId)
    assertExists(found, `Player ${playerId} is in the game`)
    return found
}

function firstLegalPlacement(session: TestSession) {
    const state = session.hydrated()
    const placement = state.pendingPlacement()
    assertExists(placement, 'A tile is waiting to be placed')
    const [option] = state.grid().legalPlacements(placement.tileId, placement.faceUp)
    return { cell: option.cell, rotation: option.rotations[0] }
}

function placeAnywhere(session: TestSession, extraCubes = 0) {
    const { cell, rotation } = firstLegalPlacement(session)
    session.place(cell, rotation, extraCubes)
}

// Buys or passes every remaining tile and places it, until the round's revenue has been paid.
function resolveAll(session: TestSession, decide: (session: TestSession) => 'buy' | 'pass') {
    while (
        session.state.machineState === MachineState.Offering ||
        session.state.machineState === MachineState.Placing
    ) {
        if (session.state.machineState === MachineState.Offering) {
            const choice = decide(session)
            if (choice === 'buy' && session.hydrated().canAfford(session.activePlayerId())) {
                session.buy()
            } else {
                session.pass()
            }
        } else {
            placeAnywhere(session)
        }
    }
}

describe('setup', () => {
    it('builds the cross, deals cubes and cash, and fills the market', () => {
        const session = startTestGame(4)
        const state = session.state
        expect(letters(state.board.stations.map((station) => station.tileId))).toEqual([
            'A',
            'B',
            'C',
            'D'
        ])
        expect(state.board.stations.map((station) => station.cell)).toEqual([
            { col: 0, row: -1 },
            { col: 1, row: 0 },
            { col: 0, row: 1 },
            { col: -1, row: 0 }
        ])
        expect(letters(state.market.map((slot) => slot.tileId))).toEqual(['A', 'B', 'C', 'D', 'A'])
        expect(state.nextLetter).toBe(StationLetter.B)
        expect(state.stacks.A.remaining).toBe(13)
        expect(state.stacks.B.remaining).toBe(14)
        for (const seat of state.players) {
            expect([seat.cash, seat.supply, seat.reserve]).toEqual([5, 5, 10])
        }
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.activePlayerIds).toEqual([state.turnManager.turnOrder[0]])
    })

    it('carries the next market on from where the last one stopped', () => {
        const state = startTestGame(4).hydrated()
        expect(letters(state.fillMarket())).toEqual(['B', 'C', 'D', 'A', 'B'])
    })

    it('puts one more tile than players in the market', () => {
        expect(startTestGame(3).state.market).toHaveLength(4)
        expect(startTestGame(5).state.market).toHaveLength(6)
    })
})

describe('bidding', () => {
    it('goes clockwise from the Start Player, one cube from supply at a time', () => {
        const session = startTestGame(3)
        const order = session.state.turnManager.turnOrder
        session.bid(0)
        expect(session.activePlayerId()).toBe(order[1])
        session.bid(0)
        session.bid(1)
        expect(session.state.market[0].bids).toEqual([order[0], order[1]])
        expect(player(session.state, order[0]).supply).toBe(4)
        expect(session.activePlayerId()).toBe(order[0])
    })

    it('ends once every player has three bids and every tile has a bid', () => {
        const session = startTestGame(3)
        bidAround(session)
        expect(session.state.market.map((slot) => slot.bids.length)).toEqual([3, 2, 2, 2])
        expect(session.state.machineState).toBe(MachineState.Offering)
    })

    it('goes on past three bids while a tile has none', () => {
        const session = startTestGame(3)
        for (let bid = 0; bid < 9; bid++) {
            session.bid(bid % 3)
        }
        expect(session.state.machineState).toBe(MachineState.Bidding)
        session.bid(3)
        expect(session.state.machineState).toBe(MachineState.Offering)
    })

    it('skips a player with an empty supply, who is then done bidding', () => {
        const session = startTestGame(3)
        const [first, second, third] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            player(draft, second).supply = 0
        })
        session.bid(0)
        expect(session.activePlayerId()).toBe(third)
        for (let bid = 0; bid < 5; bid++) {
            session.bid(bid % 4)
        }
        expect(session.state.machineState).toBe(MachineState.Offering)
        expect(player(session.state, first).supply).toBe(2)
    })

    it('refuses a full track', () => {
        const session = startTestGame(3)
        session.edit((draft) => {
            draft.market[0].bids = Array.from({ length: 9 }, () => 'p1')
        })
        expect(() => session.bid(0)).toThrow()
    })
})

describe('offers', () => {
    it('charges a dollar a cube, paying the other bidders and returning their cubes', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0', 'p1', 'p0', 'p2'])
        const before = session.state
        session.buy()
        const after = session.state
        expect(player(after, 'p0').cash).toBe(player(before, 'p0').cash - 4)
        expect(player(after, 'p1').cash).toBe(player(before, 'p1').cash + 1)
        expect(player(after, 'p2').cash).toBe(player(before, 'p2').cash + 1)
        expect(player(after, 'p0').supply).toBe(player(before, 'p0').supply + 1)
        expect(player(after, 'p1').supply).toBe(player(before, 'p1').supply + 1)
        const bought = session.actions.at(-1)
        expect(isBuyTile(bought) && bought.metadata).toMatchObject({
            price: 4,
            payments: [
                { playerId: 'p1', amount: 1 },
                { playerId: 'p2', amount: 1 }
            ]
        })
        expect(session.state.machineState).toBe(MachineState.Placing)
        expect(session.activePlayerId()).toBe('p0')
    })

    it('puts the winning cube and any extra cubes on the placed station', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        const supply = player(session.state, 'p0').supply
        placeAnywhere(session, 2)
        const placed = session.state.board.stations.at(-1)
        expect(placed).toMatchObject({ ownerId: 'p0', cubes: 3, faceUp: true })
        expect(player(session.state, 'p0').supply).toBe(supply - 2)
    })

    it('cannot place more extra cubes than the supply holds', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        const { cell, rotation } = firstLegalPlacement(session)
        const supply = player(session.state, 'p0').supply
        expect(() => session.place(cell, rotation, supply + 1)).toThrow()
    })

    it('pays a dollar per pass, taking an unbroken run of the passer’s cubes together', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0', 'p0', 'p1', 'p0'])
        const cash = player(session.state, 'p0').cash
        const supply = player(session.state, 'p0').supply
        session.pass()
        expect(session.state.market[0].bids).toEqual(['p1', 'p0'])
        expect(player(session.state, 'p0').cash).toBe(cash + 1)
        expect(player(session.state, 'p0').supply).toBe(supply + 2)
        expect(session.activePlayerId()).toBe('p1')
        session.pass()
        expect(session.activePlayerId()).toBe('p0')
        session.pass()
        expect(player(session.state, 'p0').cash).toBe(cash + 2)
    })

    it('must pass a tile the player cannot afford', () => {
        const session = startTestGame(3)
        bidAround(session)
        setOfferTrack(session, ['p0', 'p1', 'p2'])
        session.edit((draft) => {
            player(draft, 'p0').cash = 2
        })
        expect(() => session.buy()).toThrow()
        session.pass()
    })

    it('has the Start Player place a tile everyone passed, face down', () => {
        const session = startTestGame(3)
        bidAround(session)
        const startPlayer = session.state.turnManager.turnOrder[0]
        setOfferTrack(session, ['p1'])
        session.pass()
        expect(session.state.machineState).toBe(MachineState.Placing)
        expect(session.activePlayerId()).toBe(startPlayer)
        const { cell } = firstLegalPlacement(session)
        expect(() => session.place(cell, 0, 1)).toThrow()
        session.place(cell, 0)
        expect(session.state.board.stations.at(-1)).toMatchObject({ faceUp: false, cubes: 0 })
        expect(session.state.board.stations.at(-1)?.ownerId).toBeUndefined()
    })
})

describe('revenue and infrastructure loss', () => {
    function roundWithOneStation(cubesPerRound?: '2' | '3' | '4') {
        const session = startTestGame(3, cubesPerRound ? { cubesPerRound } : {})
        bidAround(session)
        setOfferTrack(session, ['p0'])
        session.buy()
        placeAnywhere(session)
        resolveAll(session, () => 'pass')
        return session
    }

    it('pays each Power Station its best route and moves a cube to the reserve', () => {
        const session = roundWithOneStation()
        const paid = session.actions.find(isPayRevenue)
        expect(paid?.metadata).toMatchObject({ revenues: [{ playerId: 'p0' }] })
    })

    it('flips stations left without cubes but never the permanent cross', () => {
        const session = roundWithOneStation()
        const owned = session.state.board.stations.slice(4).find((station) => station.faceUp)
        expect(owned).toBeUndefined()
        expect(session.state.board.stations.slice(0, 4).every((s) => s.faceUp)).toBe(true)
        const lost = session.actions.find(isLoseInfrastructure)
        expect(lost?.metadata).toMatchObject({ roundEnded: true })
    })

    it('refills supplies, passes the Start Player marker and fills the next market', () => {
        const session = startTestGame(3)
        const [first, second] = session.state.turnManager.turnOrder
        bidAround(session)
        resolveAll(session, () => 'pass')
        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(session.state.turnManager.turnOrder[0]).toBe(second)
        expect(session.activePlayerId()).toBe(second)
        expect(player(session.state, first).reserve).toBe(8)
        expect(letters(session.state.market.map((slot) => slot.tileId))).toEqual([
            'A',
            'B',
            'C',
            'D'
        ])
    })

    it('refills as many cubes as the game option says', () => {
        const session = startTestGame(3, { cubesPerRound: '3' })
        bidAround(session)
        resolveAll(session, () => 'pass')
        expect(session.state.players.every((seat) => seat.reserve === 7)).toBe(true)
    })
})

describe('the end of the game', () => {
    function playRounds(session: TestSession) {
        while (session.state.machineState !== MachineState.EndOfGame) {
            bidAround(session)
            resolveAll(session, (offer) =>
                offer.activePlayerId() === offer.state.turnManager.turnOrder[0] ? 'buy' : 'pass'
            )
        }
    }

    it('pays out after the fifth round until no cubes remain', () => {
        const session = startTestGame(3)
        playRounds(session)
        const state = session.hydrated()
        expect(state.round).toBe(Rounds)
        expect(state.cubesOnBoard()).toBe(0)
        const refills = session.actions
            .filter(isLoseInfrastructure)
            .map((action) => action.metadata)
        expect(refills.filter((metadata) => metadata?.roundEnded)).toHaveLength(Rounds)
        expect(refills.at(Rounds - 1)).toMatchObject({ refills: [] })
    })

    it('ranks by cash, then by cubes in supply, sharing a tie that remains', () => {
        const session = startTestGame(3)
        const state = session.hydrated()
        state.players.forEach((seat, index) => {
            seat.cash = 10
            seat.supply = index === 2 ? 4 : 6
        })
        expect(state.leadingPlayerIds()).toEqual(['p0', 'p1'])
        state.getPlayerState('p2').cash = 11
        expect(state.leadingPlayerIds()).toEqual(['p2'])
    })
})
