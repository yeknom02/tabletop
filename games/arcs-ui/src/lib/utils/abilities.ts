import {
    Ambition,
    BuildingKind,
    NewActionName,
    hasNewAction,
    Resources,
    shipsOf,
    type CardUse,
    type HydratedArcsGameState,
    type LoreUse,
    type NewActionChoice,
    type Resource,
    type StealTarget,
    type SystemId
} from '@tabletop/arcs'
import { cardName } from './cards.js'

// A choice a card ability could be used with; the session keeps those the rules allow.
export type AbilityOption =
    | { kind: 'card'; label: string; use: CardUse }
    | { kind: 'lore'; label: string; use: LoreUse }
    | { kind: 'new'; label: string; choice: NewActionChoice }
    | { kind: 'rifles'; label: string; system: SystemId; target: SystemId; defender: string }
    | { kind: 'ruthless'; label: string; ransack?: string; discard: Resource[] }
    | { kind: 'mythic'; label: string; resource: Resource }

type Context = {
    state: HydratedArcsGameState
    me: string
    name: (playerId: string) => string
}

const NewActionLabels: Record<NewActionName, string> = {
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

function systemsInPlay(state: HydratedArcsGameState): SystemId[] {
    return state.systems.map((system) => system.id).filter((id) => state.inPlay(id))
}

function slots(state: HydratedArcsGameState): { system: SystemId; slot: number }[] {
    return systemsInPlay(state).flatMap((system) =>
        state
            .buildingSlots(system)
            .flatMap((building, slot) => (building ? [{ system, slot }] : []))
    )
}

function rivalTargets(context: Context): { target: StealTarget; label: string }[] {
    const { state, me, name } = context
    return state.players
        .filter((player) => player.playerId !== me)
        .flatMap((player) => [
            ...player.resources.flatMap((resource, slot) =>
                resource
                    ? [
                          {
                              target: { playerId: player.playerId, slot },
                              label: `${name(player.playerId)}'s ${resource}`
                          }
                      ]
                    : []
            ),
            ...player.guildCards.map((cardId) => ({
                target: { playerId: player.playerId, cardId },
                label: `${name(player.playerId)}'s ${cardName(cardId)}`
            }))
        ])
}

const withDiscards = (discard: Resource[] | undefined) =>
    discard && discard.length > 0 ? `, discarding ${discard.join(' and ')}` : ''

const DiscardChoices: (Resource[] | undefined)[] = [
    undefined,
    ...Resources.map((resource) => [resource])
]

// Court cards' Prelude actions, with every choice each could take.
function courtCardOptions(context: Context): AbilityOption[] {
    const { state, me } = context
    const player = state.getPlayerState(me)
    const steals = rivalTargets(context)
    const plays = state.round.plays.flatMap((play) => (play.cardId ? [play.cardId] : []))
    return player.guildCards.flatMap((cardId) => {
        const title = cardName(cardId)
        const uses: { use: CardUse; label: string }[] = [{ use: { cardId }, label: title }]
        for (const system of systemsInPlay(state)) {
            uses.push({ use: { cardId, system }, label: `${title}: ${system}` })
        }
        for (const { target, label } of steals) {
            for (const discard of DiscardChoices) {
                uses.push({
                    use: { cardId, steal: [target], discard },
                    label: `${title}: steal ${label}${withDiscards(discard)}`
                })
            }
        }
        for (const actionCardId of plays) {
            uses.push({ use: { cardId, actionCardId }, label: `${title}: claim ${actionCardId}` })
        }
        for (const resource of Resources) {
            uses.push({
                use: { cardId, discard: [resource] },
                label: `${title}: discard ${resource}`
            })
        }
        for (const first of Resources) {
            for (const second of Resources) {
                uses.push({
                    use: { cardId, discard: [first, second] },
                    label: `${title}${withDiscards([first, second])}`
                })
            }
        }
        return uses.map(({ use, label }) => ({ kind: 'card' as const, label, use }))
    })
}

function loreOptions(context: Context): AbilityOption[] {
    const { state, me, name } = context
    const player = state.getPlayerState(me)
    const court = state.court.map((slot) => slot.cardId)
    return player.lore.flatMap((cardId) => {
        const title = cardName(cardId)
        const uses: { use: LoreUse; label: string }[] = [
            { use: { cardId, clear: true }, label: `${title}: discard to clear Outrage` }
        ]
        for (const discard of Resources) {
            for (const gain of Resources) {
                uses.push({
                    use: { cardId, discard, gain },
                    label: `${title}: ${discard} for ${gain}`
                })
            }
        }
        for (const trophy of player.trophies) {
            for (const influence of court) {
                uses.push({
                    use: { cardId, trophy, influence },
                    label: `${title}: return a ${trophy.kind} to influence ${cardName(influence)}`
                })
            }
        }
        for (const captive of Object.keys(player.captives)) {
            for (const secure of court) {
                uses.push({
                    use: { cardId, captive, secure },
                    label: `${title}: return ${name(captive)}'s agent to secure ${cardName(secure)}`
                })
            }
        }
        for (const ambition of Object.values(Ambition)) {
            uses.push({ use: { cardId, ambition }, label: `${title}: declare ${ambition}` })
        }
        return uses.map(({ use, label }) => ({ kind: 'lore' as const, label, use }))
    })
}

function newActionOptions(context: Context): AbilityOption[] {
    const { state, me, name } = context
    const player = state.getPlayerState(me)
    const rivals = state.turnManager.turnOrder.filter((playerId) => playerId !== me)
    return Object.values(NewActionName)
        .filter((actionName) => hasNewAction(state, me, actionName))
        .flatMap((actionName) => {
            const title = NewActionLabels[actionName]
            const choices: { choice: NewActionChoice; label: string }[] = []
            const add = (choice: Omit<NewActionChoice, 'name'>, label: string) =>
                choices.push({ choice: { name: actionName, ...choice }, label: `${title}${label}` })
            for (const discard of DiscardChoices) {
                add({ discard }, withDiscards(discard))
            }
            for (const [owner, count] of Object.entries(player.captives)) {
                add({ captives: { [owner]: count } }, `: ${count} of ${name(owner)}'s agents`)
                for (const gain of Resources) {
                    add(
                        { captives: { [owner]: 1 }, gains: [gain] },
                        `: ${name(owner)}'s agent for ${gain}`
                    )
                }
            }
            for (const courtCardId of state.court.map((slot) => slot.cardId)) {
                add({ courtCardId }, `: ${cardName(courtCardId)}`)
            }
            for (const { system, slot } of slots(state)) {
                add({ system, slot }, `: ${system}`)
                for (const give of Resources) {
                    add({ system, slot, give }, `: ${system}, giving ${give}`)
                }
                for (const cityType of Resources) {
                    add({ system, slot, cityType }, `: ${system} for ${cityType}`)
                }
            }
            for (const system of systemsInPlay(state)) {
                for (const target of rivals) {
                    for (const targetDamaged of [false, true]) {
                        add(
                            { system, target, targetDamaged },
                            `: ${system}, a ${targetDamaged ? 'damaged' : 'fresh'} ship of ${name(target)}'s`
                        )
                    }
                }
                add({ system }, `: ${system}`)
                for (const to of state.adjacent(system)) {
                    for (const [owner, ships] of Object.entries(state.system(system).ships)) {
                        add(
                            { system, to, ships: { [owner]: ships } },
                            `: ${name(owner)}'s ships from ${system} to ${to}`
                        )
                    }
                }
            }
            return choices.map(({ choice, label }) => ({ kind: 'new' as const, label, choice }))
        })
}

function rifleOptions(context: Context): AbilityOption[] {
    const { state, me, name } = context
    return systemsInPlay(state).flatMap((system) =>
        shipsOf(state.system(system), me).fresh === 0
            ? []
            : state.adjacent(system).flatMap((target) =>
                  state.defendersIn(me, target).map((defender) => ({
                      kind: 'rifles' as const,
                      label: `Fire Rifles from ${system} at ${name(defender)} in ${target}`,
                      system,
                      target,
                      defender
                  }))
              )
    )
}

function followUpOptions(context: Context): AbilityOption[] {
    const { state } = context
    const last = state.turn?.lastBuildingAction
    if (!last) return []
    const building = state.buildingAt(last.system, last.slot)
    const options: AbilityOption[] = DiscardChoices.flatMap((discard) => [
        {
            kind: 'ruthless' as const,
            label: `Ruthless: hit it to go again${withDiscards(discard)}`,
            discard: discard ?? []
        },
        ...state.court.map((slot) => ({
            kind: 'ruthless' as const,
            label: `Ruthless: destroy it, Ransack ${cardName(slot.cardId)}${withDiscards(discard)}`,
            ransack: slot.cardId,
            discard: discard ?? []
        }))
    ])
    if (building?.kind === BuildingKind.City || last.kind === 'tax') {
        for (const resource of Resources) {
            options.push({
                kind: 'mythic',
                label: `Mythic: make ${last.system} a ${resource} planet`,
                resource
            })
        }
    }
    return options
}

// Every ability option to check against the rules.
export function abilityCandidates(context: Context): AbilityOption[] {
    return [
        ...courtCardOptions(context),
        ...loreOptions(context),
        ...newActionOptions(context),
        ...rifleOptions(context),
        ...followUpOptions(context)
    ]
}
