import { Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { ActionCardIdSchema, StandardAction } from '../components/actionCards.js'
import { SystemIdSchema } from '../components/map.js'
import { ResourceCounts, resourceCounts } from '../components/resources.js'

// How a card was played this round (rules 5.1.1 and 5.2.2).
export enum PlayKind {
    Lead = 'lead',
    Surpass = 'surpass',
    Copy = 'copy',
    Pivot = 'pivot'
}

// One player's card play this round. A face-up card is public; a face-down card (Copy, or an
// extra card played to seize the initiative) is never shown to anyone else, so only the count of
// face-down cards is public.
export type CardPlay = Type.Static<typeof CardPlay>
export const CardPlay = Type.Object({
    playerId: Type.String(),
    kind: Type.Enum(PlayKind),
    cardId: Type.Optional(ActionCardIdSchema),
    faceDown: Visibility.protect(Type.Array(ActionCardIdSchema), {
        policy: Visibility.Policy.Owner
    }),
    faceDownCount: Type.Integer({ minimum: 0 }),
    // The lead card's number is zeroed when its ambition is declared.
    zeroed: Type.Boolean()
})

// A Union placed beside a face-up played card: at the end of the round its holder takes the card
// into hand and the Union is discarded.
export type UnionClaim = Type.Static<typeof UnionClaim>
export const UnionClaim = Type.Object({
    playerId: Type.String(),
    unionId: Type.String(),
    actionCardId: ActionCardIdSchema
})

export type RoundState = Type.Static<typeof RoundState>
export const RoundState = Type.Object({
    // Who took the round's first turn: turns go clockwise from them.
    leader: Type.String(),
    plays: Type.Array(CardPlay),
    // Set when someone seizes the initiative; nobody else can this round (rule 5.2.3.1).
    seizedBy: Type.Optional(Type.String()),
    // Whether an ambition was declared this round (Galactic Bards can declare only if not).
    declared: Type.Boolean(),
    unions: Type.Array(UnionClaim),
    // Players who passed the initiative in a row without playing a card (rule 5.1.2.1).
    passes: Type.Integer({ minimum: 0 })
})

export function newRound(leader: string, passes: number = 0): RoundState {
    return { leader, plays: [], passes, declared: false, unions: [] }
}

// What the player taking their turn has left to do (rules 8.1 and 9.1).
export type TurnRecord = Type.Static<typeof TurnRecord>
export const TurnRecord = Type.Object({
    playerId: Type.String(),
    // Action pips left on the played card, or 1 for Copy and Pivot.
    pips: Type.Integer({ minimum: 0 }),
    // The Prelude lasts until the first pip is spent.
    prelude: Type.Boolean(),
    // Resources spent in the Prelude, returned to the supply when it ends (rule 8.1.2).
    spent: ResourceCounts,
    // A Weapon spent this turn lets pips take Battle actions (rule 9.1).
    weaponSpent: Type.Boolean(),
    // Cities taxed this turn, as `<system>:<slot>` (rule 7.1.2).
    taxed: Type.Array(Type.String()),
    // Starports that built a ship this turn, as `<system>:<slot>` (rule 7.2.1).
    starportsBuilt: Type.Array(Type.String()),
    // Court cards secured during this Prelude, whose Prelude actions can't be used in it.
    securedInPrelude: Type.Array(Type.String()),
    // Whether the player has taken any action yet (Lattice Spies must come first).
    acted: Type.Boolean(),
    // Once-per-turn card abilities used this turn.
    usedCards: Type.Array(Type.String()),
    // Standard actions paid for with pips, and leaders' extra actions taken (by leader).
    pipActionsTaken: Type.Array(Type.Enum(StandardAction)),
    bonusesUsed: Type.Array(Type.String()),
    // An extra action taken first commits the pip to its partner action.
    owed: Type.Optional(Type.Enum(StandardAction)),
    // The tax or ship build just taken, which Ruthless can repeat and Mythic can follow.
    lastBuildingAction: Type.Optional(
        Type.Object({
            kind: Type.Union([Type.Literal('tax'), Type.Literal('buildShip')]),
            system: SystemIdSchema,
            slot: Type.Integer({ minimum: 0 }),
            copyOrPivotPip: Type.Boolean()
        })
    )
})

export function newTurnRecord(playerId: string, pips: number): TurnRecord {
    return {
        playerId,
        pips,
        prelude: true,
        spent: resourceCounts(),
        weaponSpent: false,
        taxed: [],
        starportsBuilt: [],
        securedInPrelude: [],
        acted: false,
        usedCards: [],
        pipActionsTaken: [],
        bonusesUsed: []
    }
}
