import * as Type from 'typebox'

export enum Suit {
    Administration = 'administration',
    Aggression = 'aggression',
    Construction = 'construction',
    Mobilization = 'mobilization'
}

export const Suits: readonly Suit[] = Object.values(Suit)

export enum Ambition {
    Tycoon = 'tycoon',
    Tyrant = 'tyrant',
    Warlord = 'warlord',
    Keeper = 'keeper',
    Empath = 'empath'
}

export const Ambitions: readonly Ambition[] = Object.values(Ambition)
export const AmbitionSchema = Type.Enum(Ambition)

export enum StandardAction {
    Tax = 'tax',
    Build = 'build',
    Move = 'move',
    Repair = 'repair',
    Influence = 'influence',
    Secure = 'secure',
    Battle = 'battle'
}

export const SuitActions: Readonly<Record<Suit, readonly StandardAction[]>> = {
    [Suit.Administration]: [StandardAction.Tax, StandardAction.Repair, StandardAction.Influence],
    [Suit.Aggression]: [StandardAction.Battle, StandardAction.Move, StandardAction.Secure],
    [Suit.Construction]: [StandardAction.Build, StandardAction.Repair],
    [Suit.Mobilization]: [StandardAction.Move, StandardAction.Influence]
}

// Action pips on the cards numbered 1 to 7 of each suit.
const SuitPips: Readonly<Record<Suit, readonly number[]>> = {
    [Suit.Administration]: [4, 4, 3, 3, 3, 2, 1],
    [Suit.Aggression]: [3, 3, 2, 2, 2, 2, 1],
    [Suit.Construction]: [4, 4, 3, 3, 2, 2, 1],
    [Suit.Mobilization]: [4, 4, 3, 3, 2, 2, 1]
}

// The ambition a "2" to "6" card lets its leader declare. "1" cards have none; "7" cards any.
const NumberAmbitions: Readonly<Record<number, Ambition>> = {
    2: Ambition.Tycoon,
    3: Ambition.Tyrant,
    4: Ambition.Warlord,
    5: Ambition.Keeper,
    6: Ambition.Empath
}

export type ActionCardId = `${Suit}-${number}`
export const ActionCardIdSchema = Type.String({ pattern: '^[a-z]+-[1-7]$' })

export type ActionCard = {
    id: ActionCardId
    suit: Suit
    number: number
    pips: number
}

export const ActionCards: readonly ActionCard[] = Suits.flatMap((suit) =>
    SuitPips[suit].map((pips, index) => ({
        id: `${suit}-${index + 1}` satisfies ActionCardId,
        suit,
        number: index + 1,
        pips
    }))
)

const ActionCardsById: ReadonlyMap<string, ActionCard> = new Map(
    ActionCards.map((card) => [card.id, card])
)

export function actionCard(id: string): ActionCard {
    const card = ActionCardsById.get(id)
    if (!card) {
        throw new Error(`Unknown action card ${id}`)
    }
    return card
}

// With 2 or 3 players, the "1" and "7" cards stay in the box.
export function actionDeckFor(players: number): ActionCardId[] {
    return ActionCards.filter((card) => players === 4 || (card.number > 1 && card.number < 7)).map(
        (card) => card.id
    )
}

// The ambitions a card's leader may declare: one for "2" to "6", all for "7", none for "1".
export function declarableAmbitions(card: ActionCard): readonly Ambition[] {
    if (card.number === 7) {
        return Ambitions
    }
    const ambition = NumberAmbitions[card.number]
    return ambition ? [ambition] : []
}

// A card played to seize the initiative by Surpassing: only the "7"s.
export const SeizingNumber = 7
