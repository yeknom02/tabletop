import {
    assertExists,
    BaseGameInitializer,
    Game,
    type GameInitializer,
    HydratedTurnManager,
    Prng,
    shuffle,
    type StartingPositionAssignment,
    type UninitializedGameState
} from '@tabletop/common'
import { actionDeckFor, Ambition } from '../components/actionCards.js'
import { AmbitionMarkerSides } from '../components/ambitions.js'
import { CourtCards, LeaderCards, LoreCards } from '../components/cardData.js'
import { PlanetKinds, Planets, SystemIds, planetOf } from '../components/map.js'
import { Resource, resourceCounts, ResourceTokensPerType } from '../components/resources.js'
import { setupCardsFor } from '../components/setupCards.js'
import {
    type AmbitionResource,
    type ArcsGameState,
    HydratedArcsGameState,
    type ArcsProjectedState
} from '../model/gameState.js'
import { newCardPile } from '../model/piles.js'
import { newPlayerState } from '../model/playerState.js'
import { newRound } from '../model/round.js'
import { ArcsColors } from './colors.js'
import { LeadersAndLore, lorePerPlayer } from './config.js'
import { MachineState } from './states.js'

// Court row size by player count (rule 3.1.1.8).
const CourtRowSize: Readonly<Record<number, number>> = { 2: 3, 3: 4, 4: 4 }

// Two players: the out-of-play planets' resources go on these ambitions (rule 3.1.1.11).
const AmbitionForResource: Readonly<Record<Resource, Ambition>> = {
    [Resource.Material]: Ambition.Tycoon,
    [Resource.Fuel]: Ambition.Tycoon,
    [Resource.Weapon]: Ambition.Warlord,
    [Resource.Relic]: Ambition.Keeper,
    [Resource.Psionic]: Ambition.Empath
}

export class ArcsGameInitializer
    extends BaseGameInitializer<ArcsProjectedState, HydratedArcsGameState>
    implements GameInitializer<ArcsProjectedState, HydratedArcsGameState>
{
    readonly supportsStartingPositions = true

    initializeGameState(
        game: Game,
        state: UninitializedGameState,
        assignment?: StartingPositionAssignment
    ): HydratedArcsGameState {
        const prng = new Prng(state.prng)
        assertExists(state.protectedPrng, 'Shuffling the decks requires protectedPrng')
        const protectedPrng = new Prng(state.protectedPrng)
        const playerCount = game.players.length

        const colors = structuredClone(ArcsColors)
        shuffle(colors, prng.random)
        // Seat one has the initiative; the others follow clockwise (rule 3.1.1.2).
        const turnManager = HydratedTurnManager.generate(
            game.players.map((player, index) => ({ playerId: player.id, color: colors[index] })),
            prng.random,
            assignment
        )
        const initiative = turnManager.turnOrder[0]
        const leadersAndLore =
            Object.values(LeadersAndLore).find((value) => value === game.config?.leadersAndLore) ??
            LeadersAndLore.OneLore

        const setupCards = setupCardsFor(playerCount)
        const setupCard = setupCards[Math.floor(prng.random() * setupCards.length)]
        assertExists(setupCard, `Arcs has no setup card for ${playerCount} players`)

        const courtCards = CourtCards.map((card) => card.id)
        shuffle(courtCards, protectedPrng.random)
        const rowSize = CourtRowSize[playerCount]
        const court = courtCards.splice(0, rowSize).map((cardId) => ({ cardId, agents: {} }))

        const actionCards = actionDeckFor(playerCount)
        shuffle(actionCards, protectedPrng.random)

        const supply = resourceCounts(ResourceTokensPerType)
        const ambitionResources: AmbitionResource[] = []
        if (playerCount === 2) {
            for (const cluster of setupCard.outOfPlay) {
                for (const kind of PlanetKinds) {
                    const resource = Planets[cluster][kind].resource
                    supply[resource] -= 1
                    ambitionResources.push({ ambition: AmbitionForResource[resource], resource })
                }
            }
        }

        const arcsState: ArcsGameState = Object.assign(state, {
            players: turnManager.turnOrder.map((playerId) => {
                const index = game.players.findIndex((player) => player.id === playerId)
                return newPlayerState(playerId, colors[index])
            }),
            machineState: MachineState.PlayingCard,
            turnManager,
            leadersAndLore,
            splitDiscards: game.config?.splitDiscards === true,
            setupCard: setupCard.id,
            outOfPlay: [...setupCard.outOfPlay],
            systems: SystemIds.map((id) => ({
                id,
                ships: {},
                slots: Array.from({ length: planetOf(id)?.slots ?? 0 }, () => null),
                extraBuildings: []
            })),
            supply,
            court,
            courtDeck: newCardPile(courtCards),
            courtDiscard: [],
            actionDiscard: newCardPile([]),
            faceUpDiscard: [],
            ambitionMarkers: AmbitionMarkerSides.map(() => ({ flipped: false })),
            ambitionResources,
            planetTypes: {},
            chapter: 1,
            initiative,
            round: newRound(initiative)
        })

        const hydrated = new HydratedArcsGameState(arcsState)
        const lore = lorePerPlayer(leadersAndLore)
        if (lore === 0) {
            hydrated.deal(actionCards)
            turnManager.turnOrder.forEach((playerId, seat) => hydrated.placeStart(playerId, seat))
            hydrated.machineState =
                playerCount === 2 ? MachineState.Mulligan : MachineState.PlayingCard
        } else {
            const leaders = LeaderCards.map((card) => card.id)
            shuffle(leaders, prng.random)
            const loreCards = LoreCards.map((card) => card.id)
            shuffle(loreCards, prng.random)
            // Hands are dealt after the draft (rule 3.1.2.5 follows Leaders & Lore setup).
            hydrated.actionDiscard.putOnTop(actionCards)
            hydrated.draft = {
                leaders: leaders.slice(0, playerCount + 1),
                lore: loreCards.slice(0, playerCount * lore + 1),
                lorePerPlayer: lore,
                drafter: hydrated.draftOrder()[0]
            }
            hydrated.machineState = MachineState.Drafting
        }
        return hydrated
    }
}
