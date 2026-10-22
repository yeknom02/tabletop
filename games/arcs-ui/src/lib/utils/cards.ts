import { Ambition, CourtCards, LeaderCards, LoreCards, NewActionName } from '@tabletop/arcs'

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

export const AmbitionNames: Readonly<Record<Ambition, string>> = {
    [Ambition.Tycoon]: 'Tycoon',
    [Ambition.Tyrant]: 'Tyrant',
    [Ambition.Warlord]: 'Warlord',
    [Ambition.Keeper]: 'Keeper',
    [Ambition.Empath]: 'Empath'
}

export const NewActionNames: Readonly<Record<NewActionName, string>> = {
    [NewActionName.Manufacture]: 'Manufacture',
    [NewActionName.Synthesize]: 'Synthesize',
    [NewActionName.Pressgang]: 'Pressgang',
    [NewActionName.Execute]: 'Execute',
    [NewActionName.Abduct]: 'Abduct',
    [NewActionName.Trade]: 'Trade',
    [NewActionName.Summon]: 'Summon',
    [NewActionName.Nurture]: 'Nurture',
    [NewActionName.Prune]: 'Prune',
    [NewActionName.Guide]: 'Guide',
    [NewActionName.Martyr]: 'Martyr',
    [NewActionName.Annex]: 'Annex'
}
