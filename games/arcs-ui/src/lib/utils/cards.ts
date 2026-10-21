import { CourtCards, LeaderCards, LoreCards } from '@tabletop/arcs'

export function cardName(cardId: string): string {
    return (
        [...CourtCards, ...LoreCards, ...LeaderCards].find((card) => card.id === cardId)?.name ??
        cardId
    )
}

// An action card's name, such as "Aggression 4".
export function actionCardName(cardId: string): string {
    const [suit, number] = cardId.split('-')
    return `${suit.charAt(0).toUpperCase()}${suit.slice(1)} ${number}`
}
