// PROTOTYPE: candidate bid tables for the contract menu. Throwaway; see VariantSwitcher.svelte.
import {
    Bonus,
    BonusOrder,
    BonusScope,
    bidRank,
    bidValue,
    Contract,
    contractDefinition,
    Goal,
    isBird,
    Partnership,
    PlayableContracts,
    PointsToWin,
    type BidChoice
} from '@tabletop/koenigrufen'
import { bonusGoal, bonusName } from '$lib/utils/announcementText.js'
import { bidKey, bidName, bidValueText } from '$lib/utils/contractText.js'

export type Tag = { text: string; tone: 'gold' | 'muted' | 'warn' }

export type BidRow = {
    key: string
    choice: BidChoice
    contract: Contract
    name: string
    value: string
    // A numeric value for bars and bands; Besserrufer counts its least bird.
    worth: number
    teams: string
    teamGlyph: string
    goal: string
    goalShort: string
    talon: string
    tags: Tag[]
    details: string
}

const Details: Record<Contract, string> = {
    [Contract.Rufer]:
        'Call a King; its holder is your secret partner. If the King lies in the talon, give up or play alone.',
    [Contract.Trischaken]:
        'Forehand leads; must beat, Pagat only as last trump. Last trick takes the talon. The two highest pay 1 to the two lowest; 36+ pays 2 to each; no trick is paid 2 by each.',
    [Contract.Piccolo]:
        'You lead; must beat, Pagat only as last trump. Ends as soon as you take a second trick.',
    [Contract.Zwiccolo]:
        'You lead; must beat, Pagat only as last trump. Ends as soon as you take a third trick.',
    [Contract.Bettel]:
        'You lead; must beat, Pagat only as last trump. Ends as soon as you take a trick.',
    [Contract.Solorufer]:
        'Call a King without the talon; it goes to the defenders unseen. If the King lies there, you take that half.',
    [Contract.Besserrufer]: 'Call a King.',
    [Contract.Farbendreier]:
        'Trumps don’t win: play one only when out of suit cards, and never lead one by choice.',
    [Contract.Dreier]: 'Take 3 talon cards and play alone.',
    [Contract.Sechserdreier]:
        'Forehand’s opening call, instead of Mein Spiel. Take the whole talon unseen; lose double.',
    [Contract.Farbensolo]:
        'Trumps don’t win, as in Farbendreier. The talon goes to the defenders unseen.',
    [Contract.PiccoloOuvert]: 'Piccolo with every hand laid open from the second trick.',
    [Contract.BettelOuvert]: 'Bettel with every hand laid open from the second trick.',
    [Contract.Solodreier]: 'The talon goes to the defenders unseen. Bonuses count double.'
}

const Teams: Record<Partnership, [string, string]> = {
    [Partnership.CallKing]: ['2 v 2', '●● ○○'],
    [Partnership.Alone]: ['1 v 3', '● ○○○'],
    [Partnership.Individual]: ['Each alone', '● ● ● ●']
}

function goal(contract: Contract): [string, string] {
    const definition = contractDefinition(contract)
    switch (definition.goal) {
        case Goal.TakePoints:
            return [`${PointsToWin}+ card points`, `${PointsToWin}+ points`]
        case Goal.AvoidPoints:
            return ['Fewest card points', 'Fewest points']
        case Goal.TakeTricks: {
            const tricks = definition.tricksToTake ?? 0
            return tricks === 0
                ? ['No tricks', 'No tricks']
                : [
                      `Exactly ${tricks} ${tricks === 1 ? 'trick' : 'tricks'}`,
                      `${tricks} ${tricks === 1 ? 'trick' : 'tricks'}`
                  ]
        }
    }
}

function talon(contract: Contract): string {
    const definition = contractDefinition(contract)
    if (definition.talonCards > 0) {
        return `Take ${definition.talonCards}`
    }
    switch (definition.goal) {
        case Goal.TakePoints:
            return 'To defenders'
        case Goal.AvoidPoints:
            return 'Last trick'
        case Goal.TakeTricks:
            return 'Unused'
    }
}

function tags(contract: Contract): Tag[] {
    const definition = contractDefinition(contract)
    const result: Tag[] = []
    if (definition.forehandOpening) {
        result.push({ text: 'Opening only', tone: 'muted' })
    } else if (definition.forehandOnly) {
        result.push({ text: 'Forehand only', tone: 'muted' })
    }
    if (definition.bonusesDoubled) {
        result.push({ text: 'Bonuses ×2', tone: 'gold' })
    }
    if (definition.bonuses === BonusScope.None) {
        result.push({ text: 'No bonuses', tone: 'warn' })
    }
    if (definition.bonuses === BonusScope.ValatOnly) {
        result.push({ text: 'Valat only', tone: 'warn' })
    }
    if (!definition.trumpsWin) {
        result.push({ text: 'No trumps', tone: 'warn' })
    }
    if (definition.ouvert) {
        result.push({ text: 'Open hands', tone: 'muted' })
    }
    return result
}

function details(choice: BidChoice): string {
    const base = Details[choice.contract]
    return choice.bird === undefined
        ? base
        : `${base} The ${bonusName(choice.bird)} is announced with the bid: ${bonusGoal(choice.bird).replace(/^W/, 'w')}`
}

function birdTags(bird: Bonus | undefined): Tag[] {
    return bird === undefined ? [] : [{ text: `${bonusName(bird)} announced`, tone: 'gold' }]
}

const Choices: BidChoice[] = PlayableContracts.flatMap((contract) =>
    contractDefinition(contract).namesBird
        ? BonusOrder.filter(isBird).map((bird) => ({ contract, bird }))
        : [{ contract }]
).toSorted((a, b) => bidRank(a) - bidRank(b))

export const AllRows: BidRow[] = Choices.map((choice) => {
    const { contract } = choice
    const [goalLong, goalShort] = goal(contract)
    const [teams, teamGlyph] = Teams[contractDefinition(contract).partnership]
    return {
        key: bidKey(choice),
        choice,
        contract,
        name: bidName(choice),
        value: bidValueText(choice),
        worth: bidValue(choice),
        teams,
        teamGlyph,
        goal: goalLong,
        goalShort,
        talon: talon(contract),
        tags: [...birdTags(choice.bird), ...tags(contract)],
        details: details(choice)
    }
})

export type VariantProps = {
    choices: readonly BidChoice[]
    onchoose: (choice: BidChoice) => void
}

export function rowsFor(choices: readonly BidChoice[]): BidRow[] {
    const keys = choices.map(bidKey)
    return AllRows.filter((row) => keys.includes(row.key))
}

// Variants E–H: Besserrufer as one row, its bird picked inside it.
export type BirdOption = {
    key: string
    choice: BidChoice
    name: string
    value: number
    goal: string
    open: boolean
}

export type GroupedRow = BidRow & { birds: BirdOption[] }

const BirdRows = AllRows.flatMap((row) =>
    row.choice.bird === undefined ? [] : [{ row, bird: row.choice.bird }]
)

const BesserruferDetails =
    'Call a King and name a bird with the bid. The bird is announced for your side and its value adds to the game.'

function besserruferRow(birds: BirdOption[]): GroupedRow {
    const open = birds.filter((bird) => bird.open)
    const low = open[0] ?? birds[0]
    const high = open.at(-1) ?? low
    const [goalLong, goalShort] = goal(Contract.Besserrufer)
    const [teams, teamGlyph] = Teams[Partnership.CallKing]
    return {
        key: 'besserrufer',
        choice: low.choice,
        contract: Contract.Besserrufer,
        name: contractDefinition(Contract.Besserrufer).name,
        value: low === high ? String(low.value) : `${low.value}–${high.value}`,
        worth: low.value,
        teams,
        teamGlyph,
        goal: goalLong,
        goalShort,
        talon: talon(Contract.Besserrufer),
        tags: [{ text: 'Names a bird', tone: 'gold' }, ...tags(Contract.Besserrufer)],
        details: BesserruferDetails,
        birds
    }
}

// Open choices with the Besserrufer birds folded into one row, placed at its cheapest open bird.
export function groupedRowsFor(choices: readonly BidChoice[]): GroupedRow[] {
    const keys = choices.map(bidKey)
    const birds: BirdOption[] = BirdRows.map(({ row, bird }) => ({
        key: row.key,
        choice: row.choice,
        name: bonusName(bird),
        value: row.worth,
        goal: bonusGoal(bird),
        open: keys.includes(row.key)
    }))
    const firstOpen = birds.find((bird) => bird.open)?.key
    return AllRows.flatMap((row): GroupedRow[] => {
        if (row.key === firstOpen) {
            return [besserruferRow(birds)]
        }
        return row.choice.bird === undefined && keys.includes(row.key)
            ? [{ ...row, birds: [] }]
            : []
    })
}
