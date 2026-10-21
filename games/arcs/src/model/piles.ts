import { DrawBag, HydratedDrawBag, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

// A face-down pile of cards: the Court deck, or the action discard pile. Its order is hidden from
// everyone; how many cards it holds is public. Cards are drawn from the top (the end of `items`).
export type CardPile = Type.Static<typeof CardPile>
export const CardPile = DrawBag(Type.String())

const ProjectedCardPile = Visibility.createProjectionSchema(CardPile)
const ProjectedCardPileValidator = Compile(ProjectedCardPile)

export function newCardPile(cards: readonly string[]): CardPile {
    return { items: [...cards], remaining: cards.length }
}

export class HydratedCardPile extends HydratedDrawBag<string, typeof ProjectedCardPile> {
    constructor(data: Type.Static<typeof ProjectedCardPile>) {
        super(data, ProjectedCardPileValidator)
    }

    putOnTop(cards: readonly string[]) {
        for (const card of cards) {
            this.addItem(card)
        }
    }

    // Bury: place on the bottom (glossary 23.1.3).
    putOnBottom(card: string) {
        this.items.unshift(card)
        this.remaining += 1
    }

    drawFromBottom(count: number): string[] {
        const drawn = this.items.splice(0, Math.min(count, this.remaining))
        this.remaining -= drawn.length
        return drawn
    }

    takeAll(): string[] {
        return this.remaining > 0 ? this.drawItems(this.remaining) : []
    }
}
