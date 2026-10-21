import * as Type from 'typebox'

// The three battle dice (rule 2.5.2), 6 of each.
export enum Die {
    Assault = 'assault',
    Skirmish = 'skirmish',
    Raid = 'raid'
}

export const DiceOfEachKind = 6

// The symbols a rolled face can show (rule 7.7.1.4).
export enum DieSymbol {
    Hit = 'hit',
    SelfHit = 'selfHit',
    Intercept = 'intercept',
    BuildingHit = 'buildingHit',
    Key = 'key'
}

export const DieSchema = Type.Enum(Die)

const { Hit, SelfHit, Intercept, BuildingHit, Key } = DieSymbol

// The six faces of each die, from the printed dice.
export const DieFaces: Readonly<Record<Die, readonly (readonly DieSymbol[])[]>> = {
    [Die.Assault]: [
        [],
        [SelfHit, Hit],
        [Intercept, Hit],
        [SelfHit, Hit, Hit],
        [Hit, Hit],
        [SelfHit, Hit]
    ],
    [Die.Skirmish]: [[], [], [], [Hit], [Hit], [Hit]],
    [Die.Raid]: [
        [Intercept, Key, Key],
        [SelfHit, Key],
        [Intercept],
        [SelfHit, BuildingHit],
        [BuildingHit, Key],
        [SelfHit, BuildingHit]
    ]
}
