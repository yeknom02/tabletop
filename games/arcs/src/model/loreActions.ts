import { assert, assertExists } from '@tabletop/common'
import { Ambition } from '../components/actionCards.js'
import { Lore } from '../components/personas.js'
import type { HydratedArcsGameState } from './gameState.js'
import { NewActionName, type NewActionChoice, type NewActionResult } from './newActionTypes.js'
import { BuildingKind, shipsOf, TrophyKind } from './pieces.js'

// Lore cards' new actions: the building or system each acts on, and its own conditions; paying
// for it is checked separately.
export function canTakeLoreAction(
    state: HydratedArcsGameState,
    playerId: string,
    choice: NewActionChoice
): boolean {
    const turn = state.currentTurn()
    const at =
        choice.system === undefined || choice.slot === undefined
            ? null
            : state.buildingAt(choice.system, choice.slot)
    const controls = choice.system !== undefined && state.controller(choice.system) === playerId
    switch (choice.name) {
        // Tool-Priests: once per turn, a ship at any city the player controls.
        case NewActionName.Summon:
            return (
                at?.kind === BuildingKind.City &&
                controls &&
                !turn.usedCards.includes(Lore.ToolPriests) &&
                state.getPlayerState(playerId).ships > 0
            )
        // Living Structures: tax a Loyal city.
        case NewActionName.Nurture:
            return (
                choice.system !== undefined &&
                choice.slot !== undefined &&
                at?.kind === BuildingKind.City &&
                at.owner === playerId &&
                state.canTax(
                    playerId,
                    choice.system,
                    choice.slot,
                    choice.discard ?? [],
                    false,
                    choice.cityType
                )
            )
        // Living Structures: a Loyal starport in a slot becomes a Loyal city, or the reverse.
        case NewActionName.Prune: {
            if (
                choice.system === undefined ||
                choice.slot === undefined ||
                at?.owner !== playerId
            ) {
                return false
            }
            const player = state.getPlayerState(playerId)
            const inSlot = choice.slot < state.system(choice.system).slots.length
            return (
                inSlot &&
                (at.kind === BuildingKind.Starport
                    ? player.citiesOnBoard > 0
                    : player.starports > 0)
            )
        }
        // Tyrant's Authority, while Tyrant is declared: a building the player controls becomes
        // a Loyal one of the same kind.
        case NewActionName.Annex: {
            if (!at || at.owner === playerId || !controls) {
                return false
            }
            const player = state.getPlayerState(playerId)
            return (
                state.isDeclared(Ambition.Tyrant) &&
                (at.kind === BuildingKind.City ? player.citiesOnBoard > 0 : player.starports > 0)
            )
        }
        // Force Beams: any ships between a system with a fresh Loyal starport and one adjacent.
        case NewActionName.Guide: {
            const from = choice.system
            const to = choice.to
            const ships = Object.entries(choice.ships ?? {})
            if (from === undefined || to === undefined || !state.adjacent(from).includes(to)) {
                return false
            }
            const port = (id: typeof from) =>
                state
                    .buildingSlots(id)
                    .some(
                        (building) =>
                            building?.owner === playerId &&
                            building.kind === BuildingKind.Starport &&
                            !building.damaged
                    )
            const present = state.system(from).ships
            return (
                (port(from) || port(to)) &&
                ships.some(([, count]) => count.fresh + count.damaged > 0) &&
                ships.every(([owner, count]) => {
                    const there = present[owner] ?? { fresh: 0, damaged: 0 }
                    return count.fresh <= there.fresh && count.damaged <= there.damaged
                })
            )
        }
        // Survival Overrides: a fresh Loyal ship destroyed, taking a non-Loyal ship with it.
        case NewActionName.Martyr: {
            if (
                choice.system === undefined ||
                shipsOf(state.system(choice.system), playerId).fresh === 0
            ) {
                return false
            }
            if (choice.target === undefined) {
                return choice.targetDamaged === undefined
            }
            const target = shipsOf(state.system(choice.system), choice.target)
            return (
                choice.target !== playerId &&
                (choice.targetDamaged ? target.damaged > 0 : target.fresh > 0)
            )
        }
        default:
            return false
    }
}

export function takeLoreAction(
    state: HydratedArcsGameState,
    playerId: string,
    choice: NewActionChoice
): NewActionResult {
    assert(canTakeLoreAction(state, playerId, choice), `${playerId} cannot ${choice.name}`)
    const result: NewActionResult = { gained: [], discarded: [], captured: {} }
    const system = choice.system
    assertExists(system, 'A lore action names a system')
    switch (choice.name) {
        case NewActionName.Summon:
            state.currentTurn().usedCards.push(Lore.ToolPriests)
            state.placeShipFromSupply(system, playerId)
            break
        case NewActionName.Nurture: {
            const taxed = state.tax(
                playerId,
                system,
                choice.slot ?? 0,
                choice.discard ?? [],
                false,
                choice.cityType
            )
            result.gained = taxed.gained
            result.discarded = taxed.discarded
            break
        }
        case NewActionName.Prune:
        case NewActionName.Annex:
            replaceBuilding(state, playerId, system, choice.slot ?? 0)
            break
        case NewActionName.Guide: {
            const to = choice.to
            assertExists(to, 'Guide names where the ships go')
            for (const [owner, count] of Object.entries(choice.ships ?? {})) {
                if (count.fresh + count.damaged > 0) {
                    state.removeShips(system, owner, count.fresh, count.damaged)
                    state.addShips(to, owner, count.fresh, count.damaged)
                }
            }
            break
        }
        case NewActionName.Martyr: {
            state.removeShips(system, playerId, 1, 0)
            state.getPlayerState(playerId).ships += 1
            if (choice.target !== undefined) {
                state.removeShips(
                    system,
                    choice.target,
                    choice.targetDamaged ? 0 : 1,
                    choice.targetDamaged ? 1 : 0
                )
                state.getPlayerState(playerId).trophies.push({
                    owner: choice.target,
                    kind: TrophyKind.Ship
                })
            }
            break
        }
    }
    return result
}

// Prune and Annex: the building leaves for its owner's supply (a city for their board) and a
// Loyal one takes its place, damaged if it was. Prune swaps the kind; Annex keeps it.
function replaceBuilding(
    state: HydratedArcsGameState,
    playerId: string,
    id: Parameters<HydratedArcsGameState['system']>[0],
    slot: number
) {
    const old = state.building(id, slot)
    const prune = old.owner === playerId
    const kind = prune
        ? old.kind === BuildingKind.City
            ? BuildingKind.Starport
            : BuildingKind.City
        : old.kind
    state.returnPiece(
        old.owner,
        old.kind === BuildingKind.City ? TrophyKind.City : TrophyKind.Starport
    )
    const player = state.getPlayerState(playerId)
    if (kind === BuildingKind.City) {
        player.citiesOnBoard -= 1
    } else {
        player.starports -= 1
    }
    state.setBuildingAt(id, slot, { owner: playerId, kind, damaged: old.damaged })
}
