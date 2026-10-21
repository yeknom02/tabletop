import type { GameAction } from '@tabletop/common'
import {
    isAssignHits,
    isBattle,
    isBelovedInfluence,
    isBoldInfluence,
    isBuildBuilding,
    isBuildShip,
    isDealHands,
    isDraftCard,
    isDrawActionCard,
    isDrawArchive,
    isDrawCourtCard,
    isEndBattle,
    isEndChapter,
    isEndTurn,
    isFarsee,
    isFireRifles,
    isFollowCard,
    isGainOnDeclaring,
    isGiveGuildCard,
    isInfluence,
    isKeepHand,
    isKeepLore,
    isLeadCard,
    isMoveInBySensors,
    isMoveShips,
    isMythic,
    isPassInitiative,
    isRaid,
    isRansack,
    isRedrawHand,
    isRepair,
    isReroll,
    isResolveConnected,
    isRollDice,
    isRuthless,
    isSecure,
    isSpendWeapon,
    isSwapWithRival,
    isTakeNewAction,
    isTax,
    isUseCard,
    isUseFarseers,
    isUseLore,
    PlayKind,
    type Resource
} from '@tabletop/arcs'
import { actionCardName, cardName } from './cards.js'

type Names = { name: (playerId: string) => string }

const list = (items: readonly string[]) =>
    items.length <= 1
        ? (items[0] ?? '')
        : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

const paidWith = (via?: Resource, token?: Resource) =>
    via ? ` with ${token && token !== via ? `${token} as ${via}` : via}` : ''

const gainedText = (gained: readonly Resource[], discarded: readonly Resource[] = []) =>
    [
        gained.length > 0 ? `gaining ${list(gained)}` : '',
        discarded.length > 0 ? `discarding ${list(discarded)}` : ''
    ]
        .filter(Boolean)
        .join(', ')

const withClause = (clause: string) => (clause ? `, ${clause}` : '')

// What an Action did, told from its input and metadata alone.
export function describeAction(action: GameAction, { name }: Names): string {
    const who = action.playerId ? name(action.playerId) : ''
    if (isDraftCard(action)) return `${who} drafted ${cardName(action.cardId)}`
    if (isKeepHand(action)) return `${who} kept their hand`
    if (isRedrawHand(action)) return `${who} drew a new hand`
    if (isLeadCard(action)) {
        return `${who} led ${actionCardName(action.cardId)}${action.declare ? ` and declared ${action.declare}` : ''}`
    }
    if (isPassInitiative(action)) return `${who} passed the initiative`
    if (isFollowCard(action)) {
        const card =
            action.playKind === PlayKind.Copy ? 'a card face down' : actionCardName(action.cardId)
        const kind =
            action.playKind === PlayKind.Copy
                ? 'copied with'
                : `${action.playKind === PlayKind.Surpass ? 'surpassed' : 'pivoted'} with`
        return `${who} ${kind} ${card}${action.declare ? `, declaring ${action.declare}` : ''}`
    }
    if (isSpendWeapon(action)) return `${who} spent a Weapon so their actions may battle`
    if (isTax(action)) {
        const result = action.metadata
        return `${who} taxed ${action.system}${paidWith(action.via, action.token)}${withClause(
            [
                result ? gainedText(result.gained, result.discarded) : '',
                result?.captured ? `capturing ${name(result.captured)}'s agent` : ''
            ]
                .filter(Boolean)
                .join(', ')
        )}`
    }
    if (isBuildBuilding(action)) {
        return `${who} built a ${action.building} in ${action.system}${paidWith(action.via, action.token)}${action.metadata?.damaged ? ', damaged' : ''}`
    }
    if (isBuildShip(action)) {
        return `${who} built a ship in ${action.system}${paidWith(action.via, action.token)}${action.metadata?.damaged ? ', damaged' : ''}`
    }
    if (isMoveShips(action)) {
        const count = action.fresh + action.damaged
        const captured = Object.entries(action.metadata?.captured ?? {}).map(
            ([capturer, agents]) =>
                `${name(capturer)} captured ${agents} agent${agents === 1 ? '' : 's'}`
        )
        return `${who} moved ${count} ship${count === 1 ? '' : 's'} from ${action.from} to ${action.path[action.path.length - 1]}${paidWith(action.via, action.token)}${withClause(list(captured))}`
    }
    if (isRepair(action)) {
        return `${who} repaired a ${action.slot === undefined ? 'ship' : 'building'} in ${action.system}${paidWith(action.via, action.token)}`
    }
    if (isInfluence(action))
        return `${who} influenced ${cardName(action.cardId)}${paidWith(action.via, action.token)}`
    if (isSecure(action)) {
        const captured = Object.entries(action.metadata?.captured ?? {}).map(
            ([owner, count]) => `${count} of ${name(owner)}'s agents`
        )
        return `${who} secured ${cardName(action.cardId)}${paidWith(action.via, action.token)}${withClause(captured.length > 0 ? `capturing ${list(captured)}` : '')}`
    }
    if (isBattle(action)) {
        const rolled = action.metadata?.rolled.length ?? 0
        return `${who} battled ${name(action.defender)} in ${action.system}${rolled > 0 ? `, rolling ${rolled} ${rolled === 1 ? 'die' : 'dice'}` : ''}`
    }
    if (isFireRifles(action))
        return `${who} fired Galactic Rifles from ${action.system} at ${name(action.defender)} in ${action.target}`
    if (isMoveInBySensors(action)) {
        const ships = action.moves.reduce((sum, move) => sum + move.fresh, 0)
        return `${who} moved ${ships} ship${ships === 1 ? '' : 's'} in with Predictive Sensors`
    }
    if (isRollDice(action)) return `${who} rolled ${action.metadata?.rolled.length ?? 0} dice`
    if (isReroll(action))
        return `${who} rerolled ${action.dice.length} ${action.dice.length === 1 ? 'die' : 'dice'}`
    if (isAssignHits(action)) {
        const result = action.metadata
        if (!result) return `${who} assigned hits`
        const parts = [
            result.defenderShipsDestroyed > 0
                ? `destroyed ${result.defenderShipsDestroyed} ship${result.defenderShipsDestroyed === 1 ? '' : 's'}`
                : '',
            result.buildingsDestroyed.length > 0
                ? `destroyed ${list(result.buildingsDestroyed.map((kind) => `a ${kind}`))}`
                : '',
            result.attackerShipsDestroyed > 0
                ? `lost ${result.attackerShipsDestroyed} ship${result.attackerShipsDestroyed === 1 ? '' : 's'}`
                : '',
            result.outraged.length > 0 ? `provoked ${list(result.outraged)} Outrage` : ''
        ].filter(Boolean)
        return parts.length > 0 ? `${who} ${list(parts)}` : `${who} assigned hits`
    }
    if (isRansack(action)) {
        const trophies = Object.values(action.metadata?.trophies ?? {}).reduce(
            (sum, count) => sum + count,
            0
        )
        return `${who} ransacked ${cardName(action.cardId)}${trophies > 0 ? `, taking ${trophies} agent${trophies === 1 ? '' : 's'} as Trophies` : ''}`
    }
    if (isRaid(action)) {
        const stolen =
            action.metadata?.resource ??
            (action.metadata?.cardId ? cardName(action.metadata.cardId) : 'something')
        return `${who} raided ${stolen}${action.metadata?.discarded ? `, discarding ${action.metadata.discarded}` : ''}`
    }
    if (isEndBattle(action)) return `${who} stopped raiding`
    if (isBelovedInfluence(action)) {
        return action.cardId
            ? `${who} influenced ${cardName(action.cardId)} (Beloved)`
            : `${who} declined to influence`
    }
    if (isGiveGuildCard(action))
        return `${who} gave ${cardName(action.cardId)} to ${name(action.to)}`
    if (isDrawCourtCard(action)) {
        return action.metadata?.cardId
            ? `Connected: secured ${cardName(action.metadata.cardId)} from the Court deck`
            : 'Connected: the Court deck is empty'
    }
    if (isResolveConnected(action)) return `${who} resolved the card drawn`
    if (isGainOnDeclaring(action))
        return action.resource
            ? `${who} gained ${action.resource} (Ambitious)`
            : `${who} gained nothing`
    if (isBoldInfluence(action))
        return `${who} influenced ${action.cardIds.length} Court card${action.cardIds.length === 1 ? '' : 's'} (Bold)`
    if (isFarsee(action)) return `${who} looked at ${name(action.rival)}'s hand`
    if (isSwapWithRival(action))
        return action.give ? `${who} swapped a card with them` : `${who} swapped nothing`
    if (isUseCard(action)) {
        const result = action.metadata
        const clause = result
            ? [
                  gainedText(result.gained, result.discarded),
                  result.stolen.length > 0
                      ? `stealing ${list(result.stolen.map((item) => (item.startsWith('BC') ? cardName(item) : item)))}`
                      : '',
                  result.shipsPlaced > 0
                      ? `placing ${result.shipsPlaced} ship${result.shipsPlaced === 1 ? '' : 's'}`
                      : '',
                  result.seized ? 'seizing the initiative' : ''
              ]
                  .filter(Boolean)
                  .join(', ')
            : ''
        return `${who} used ${cardName(action.cardId)}${withClause(clause)}`
    }
    if (isUseFarseers(action)) return `${who} used Farseers, drawing ${action.metadata?.drawn ?? 0}`
    if (isUseLore(action))
        return `${who} used ${cardName(action.cardId)}${action.clear ? ' to clear Outrage' : ''}`
    if (isTakeNewAction(action)) {
        const result = action.metadata
        return `${who} took ${action.name}${paidWith(action.via, action.token)}${withClause(result ? gainedText(result.gained, result.discarded) : '')}`
    }
    if (isRuthless(action))
        return `${who} hit the building to go again (Ruthless)${action.metadata?.destroyed ? ', destroying it' : ''}`
    if (isMythic(action)) return `${who} made the planet ${action.resource} (Mythic)`
    if (isEndTurn(action))
        return action.returnTo
            ? `${who} returned 3 ships to ${action.returnTo} and ended their turn`
            : `${who} ended their turn`
    if (isDealHands(action)) return 'Hands were dealt'
    if (isDrawArchive(action)) return 'The Archivist drew 5 lore'
    if (isKeepLore(action)) return `${who} kept ${list(action.cardIds.map(cardName))}`
    if (isDrawActionCard(action)) return `${name(action.drawer)} drew an action card`
    if (isEndChapter(action)) {
        const awards = (action.metadata?.awards ?? []).filter((award) => award.power > 0)
        const scored = awards.map(
            (award) => `${name(award.playerId)} ${award.power} for ${award.ambition}`
        )
        return `The chapter ended${withClause(list(scored))}${action.metadata?.gameOver ? '. The game is over' : ''}`
    }
    return action.type
}
