import { assert, assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionCardIdSchema } from '../components/actionCards.js'
import {
    AgentsPerPlayer,
    CitiesPerPlayer,
    openResourceSlots,
    ResourceSlotRaidCosts,
    ShipsPerPlayer,
    StarportsPerPlayer
} from '../components/playerBoard.js'
import { Resource, ResourceSchema } from '../components/resources.js'
import { Trophy } from './pieces.js'

export type ArcsPlayerState = Type.Static<typeof ArcsPlayerState>
export const ArcsPlayerState = Type.Object({
    ...PlayerState.properties,
    // Action cards in hand: only their owner sees them (rule 22.6.1).
    hand: Visibility.protect(Type.Array(ActionCardIdSchema), { policy: Visibility.Policy.Owner }),
    handCount: Type.Integer({ minimum: 0 }),
    power: Type.Integer(),
    // Pieces still in the player's supply. Cities wait on the board's city slots, leftmost first.
    citiesOnBoard: Type.Integer({ minimum: 0, maximum: CitiesPerPlayer }),
    starports: Type.Integer({ minimum: 0 }),
    ships: Type.Integer({ minimum: 0 }),
    agents: Type.Integer({ minimum: 0 }),
    // A resource or nothing in each resource slot, left to right.
    resources: Type.Array(Type.Union([ResourceSchema, Type.Null()])),
    // Resource types with an agent on their Outrage slot.
    outrage: Type.Array(ResourceSchema),
    trophies: Type.Array(Trophy),
    // Captured agents by their owner.
    captives: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
    guildCards: Type.Array(Type.String()),
    lore: Type.Array(Type.String()),
    leader: Type.Optional(Type.String())
})

export const ArcsProjectedPlayerState = Visibility.createProjectionSchema(ArcsPlayerState)
export type ArcsProjectedPlayerState = Type.Static<typeof ArcsProjectedPlayerState>
const ArcsProjectedPlayerStateValidator = Compile(ArcsProjectedPlayerState)

export function newPlayerState(playerId: string, color: Color): ArcsPlayerState {
    return {
        playerId,
        color,
        hand: [],
        handCount: 0,
        power: 0,
        citiesOnBoard: CitiesPerPlayer,
        starports: StarportsPerPlayer,
        ships: ShipsPerPlayer,
        agents: AgentsPerPlayer,
        resources: ResourceSlotRaidCosts.map(() => null),
        outrage: [],
        trophies: [],
        captives: {},
        guildCards: [],
        lore: []
    }
}

export class HydratedArcsPlayerState
    extends Hydratable<typeof ArcsProjectedPlayerState>
    implements ArcsProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare hand?: string[]
    declare handCount: number
    declare power: number
    declare citiesOnBoard: number
    declare starports: number
    declare ships: number
    declare agents: number
    declare resources: (Resource | null)[]
    declare outrage: Resource[]
    declare trophies: Trophy[]
    declare captives: Record<string, number>
    declare guildCards: string[]
    declare lore: string[]
    declare leader?: string

    constructor(data: ArcsProjectedPlayerState) {
        super(data, ArcsProjectedPlayerStateValidator)
    }

    knownHand(): string[] {
        assertExists(this.hand, `Player ${this.playerId}'s hand is hidden`)
        return this.hand
    }

    takeIntoHand(cards: readonly string[]) {
        this.knownHand().push(...cards)
        this.handCount += cards.length
    }

    removeFromHand(cardId: string) {
        const hand = this.knownHand()
        const index = hand.indexOf(cardId)
        assert(index >= 0, `Player ${this.playerId} has no ${cardId} in hand`)
        hand.splice(index, 1)
        this.handCount -= 1
    }

    hasInHand(cardId: string): boolean {
        return this.knownHand().includes(cardId)
    }

    openSlots(): number {
        return openResourceSlots(this.citiesOnBoard)
    }

    resourceCount(resource: Resource): number {
        return this.resources.filter((held) => held === resource).length
    }

    // Gains a resource into the leftmost open empty slot. Returns false when every open slot is full
    // and nothing is gained.
    gainResource(resource: Resource): boolean {
        const slot = this.resources.findIndex(
            (held, index) => held === null && index < this.openSlots()
        )
        if (slot < 0) {
            return false
        }
        this.resources[slot] = resource
        return true
    }

    emptySlots(): number {
        return this.resources.filter((held, index) => held === null && index < this.openSlots())
            .length
    }

    // Gaining into full slots means discarding a resource: one held, or the one gained (rule 9.2.1).
    canGain(resource: Resource, discard?: Resource): boolean {
        return this.canGainAll([resource], discard === undefined ? [] : [discard])
    }

    // Returns the resource discarded to make room, if any.
    gain(resource: Resource, discard?: Resource): Resource | undefined {
        return this.gainAll([resource], discard === undefined ? [] : [discard])[0]
    }

    // Gaining several at once discards exactly what can't be held, from what is held and gained.
    canGainAll(gains: readonly Resource[], discards: readonly Resource[]): boolean {
        const held = this.resources.filter(
            (resource, index): resource is Resource => resource !== null && index < this.openSlots()
        )
        const pool = [...held, ...gains]
        if (discards.length !== Math.max(0, pool.length - this.openSlots())) {
            return false
        }
        for (const discard of discards) {
            const index = pool.indexOf(discard)
            if (index < 0) {
                return false
            }
            pool.splice(index, 1)
        }
        return true
    }

    // New resources fill the leftmost empty slots. Returns the resources discarded.
    gainAll(gains: readonly Resource[], discards: readonly Resource[]): Resource[] {
        assert(this.canGainAll(gains, discards), `Player ${this.playerId} cannot gain those`)
        const kept = [...gains]
        for (const discard of discards) {
            const index = kept.indexOf(discard)
            if (index >= 0) {
                kept.splice(index, 1)
            } else {
                this.removeResource(discard)
            }
        }
        for (const resource of kept) {
            this.gainResource(resource)
        }
        return [...discards]
    }

    removeResource(resource: Resource) {
        const slot = this.resources.lastIndexOf(resource)
        assert(slot >= 0, `Player ${this.playerId} has no ${resource}`)
        this.resources[slot] = null
    }

    // Resources left in slots a returning city covers are discarded, after sliding the rest left.
    // Returns the resources discarded.
    compactResources(): Resource[] {
        const held = this.resources.filter((resource): resource is Resource => resource !== null)
        const kept = held.slice(0, this.openSlots())
        this.resources = ResourceSlotRaidCosts.map((_, index) => kept[index] ?? null)
        return held.slice(this.openSlots())
    }

    captiveCount(): number {
        return Object.values(this.captives).reduce((total, count) => total + count, 0)
    }

    capture(owner: string, count: number = 1) {
        this.captives[owner] = (this.captives[owner] ?? 0) + count
    }
}
