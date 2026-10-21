// A player board: five city slots along the top, six resource slots below them, and an Outrage
// slot per resource. Cities leave the board from the left as they're built, uncovering resource
// slots and then bonuses for winning ambitions.

export const ShipsPerPlayer = 15
export const AgentsPerPlayer = 10
export const CitiesPerPlayer = 5
export const StarportsPerPlayer = 5
export const StartingHandSize = 6

// Raid cost, in keys, of each resource slot from left to right.
export const ResourceSlotRaidCosts: readonly number[] = [3, 1, 1, 2, 1, 3]

// Ancient Holdings' slot follows the six on the board, with a raid cost of 4.
export const HoldingsSlot = 6
const HoldingsRaidCost = 4

export function slotRaidCost(slot: number): number | undefined {
    return slot === HoldingsSlot ? HoldingsRaidCost : ResourceSlotRaidCosts[slot]
}

// Resource slots open with every city still on the board.
const AlwaysOpenSlots = 2

// The resource slots each city slot covers, from the left. Cities 4 and 5 cover the bonuses.
const SlotsUnderCities: readonly number[] = [1, 1, 2, 0, 0]

// How many resource slots are open with this many cities still on the board.
export function openResourceSlots(citiesOnBoard: number): number {
    const built = CitiesPerPlayer - citiesOnBoard
    return SlotsUnderCities.slice(0, built).reduce((open, slots) => open + slots, AlwaysOpenSlots)
}

// Extra Power for winning an ambition outright: +2 once the fourth city has left the board, +5
// once the fifth has too.
export function wonAmbitionBonus(citiesOnBoard: number): number {
    const built = CitiesPerPlayer - citiesOnBoard
    return built >= 5 ? 5 : built >= 4 ? 2 : 0
}
