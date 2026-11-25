import type { Seats } from './botServer.js'

interface StoredSeats {
    bots: Seats
    plays: Record<string, boolean>
    // Set when the bots were seated in a new game they should start without waiting.
    fresh?: boolean
}

const storageKey = (gameId: string) => `conduit-bot-seats:${gameId}`

/** Each seat's bot, and whether it plays its own turns, kept per harness game. */
export class BotSeats {
    private bots: Seats = $state({})
    private plays: Record<string, boolean> = $state({})
    private readonly gameId: string
    private readonly preferred: string
    // Whether the bots took their seats just now, in a game they had never seen.
    readonly joined: boolean = false

    /** Seats `opponents` with the preferred bot, playing their own turns, if this game has no seats yet. */
    constructor(gameId: string, preferred: string, opponents: string[] = []) {
        this.gameId = gameId
        this.preferred = preferred
        const stored = localStorage.getItem(storageKey(gameId))
        if (!stored) {
            if (opponents.length === 0) return
            this.plays = Object.fromEntries(opponents.map((playerId) => [playerId, true]))
            this.joined = true
            this.save()
            return
        }
        const seats: StoredSeats = JSON.parse(stored)
        this.bots = seats.bots
        this.plays = seats.plays
        if (seats.fresh) {
            this.joined = true
            this.save()
        }
    }

    /** Seats bots in a game about to open; with a person, every other seat plays itself from the start. */
    static seat(gameId: string, bots: Seats, person?: string) {
        const plays = person
            ? Object.fromEntries(
                  Object.keys(bots)
                      .filter((playerId) => playerId !== person)
                      .map((playerId) => [playerId, true])
              )
            : {}
        const seats: StoredSeats = { bots, plays, ...(person ? { fresh: true } : {}) }
        localStorage.setItem(storageKey(gameId), JSON.stringify(seats))
    }

    bot(playerId: string): string {
        return this.bots[playerId] ?? this.preferred
    }

    playsItself(playerId: string): boolean {
        return this.plays[playerId] ?? false
    }

    setBot(playerId: string, spec: string) {
        this.bots[playerId] = spec
        this.save()
    }

    setPlaysItself(playerId: string, plays: boolean) {
        this.plays[playerId] = plays
        this.save()
    }

    all(playerIds: string[]): Seats {
        return Object.fromEntries(playerIds.map((playerId) => [playerId, this.bot(playerId)]))
    }

    private save() {
        const seats: StoredSeats = { bots: this.bots, plays: this.plays }
        localStorage.setItem(storageKey(this.gameId), JSON.stringify(seats))
    }
}
