import {
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState,
    shuffle,
    Visibility
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import {
    actionCard,
    type ActionCard,
    Ambition,
    AmbitionSchema,
    declarableAmbitions,
    SeizingNumber,
    StandardAction,
    SuitActions
} from '../components/actionCards.js'
import {
    AmbitionMarkerSides,
    type AmbitionMarkerSide,
    LastChapter,
    PowerToWin
} from '../components/ambitions.js'
import {
    CourtCards,
    LeaderSetups,
    LoreCards,
    type LeaderSetup,
    type LeaderStart
} from '../components/cardData.js'
import {
    adjacentSystems,
    clusterOf,
    Clusters,
    isGate,
    planetOf,
    type Cluster,
    type SystemId
} from '../components/map.js'
import { Cartels, Court, LoyalCards } from '../components/courtCards.js'
import { Leader, Lore } from '../components/personas.js'
import { DiceOfEachKind, Die, DieSymbol } from '../components/dice.js'
import {
    HoldingsSlot,
    slotRaidCost,
    StartingHandSize,
    wonAmbitionBonus
} from '../components/playerBoard.js'
import { Resource, ResourceCounts, ResourceSchema } from '../components/resources.js'
import { SetupCardId, SetupCardIdSchema, SetupCards } from '../components/setupCards.js'
import { LeadersAndLore } from '../definition/config.js'
import {
    BuildingKind,
    buildingsIn,
    shipsOf,
    SystemState,
    TrophyKind,
    type Building,
    type ShipCount,
    type StealTarget
} from './pieces.js'
import {
    BattleState,
    BattleStep,
    hitShips,
    anyRerolls,
    noRerolls,
    RailgunHit,
    type SensorsMove,
    rollDie,
    shipHitCapacity,
    type RolledDie,
    symbolsRolled,
    type BuildingHits,
    type ShipHits
} from './battle.js'
import { canResolveVox, isVox, resolveVox, type VoxChoice, type VoxResult } from './courtEffects.js'
import { canAffordDeclaration, Declaration, stepsOnDeclaring } from './declaration.js'
import { CardPile, HydratedCardPile } from './piles.js'
import { ArcsPlayerState, HydratedArcsPlayerState } from './playerState.js'
import {
    newRound,
    newTurnRecord,
    PlayKind,
    RoundState,
    TurnRecord,
    type CardPlay
} from './round.js'

export type CourtSlot = Type.Static<typeof CourtSlot>
export const CourtSlot = Type.Object({
    cardId: Type.String(),
    // Agents on the card by player.
    agents: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
})

export type AmbitionMarker = Type.Static<typeof AmbitionMarker>
export const AmbitionMarker = Type.Object({
    flipped: Type.Boolean(),
    // The ambition box the marker sits in; absent while it's available.
    ambition: Type.Optional(AmbitionSchema)
})

// Two players: resources in the ambition boxes count as a third player's (rule 6.2.1.4).
export type AmbitionResource = Type.Static<typeof AmbitionResource>
export const AmbitionResource = Type.Object({ ambition: AmbitionSchema, resource: ResourceSchema })

export enum DraftKind {
    Leader = 'leader',
    Lore = 'lore'
}

export type DraftState = Type.Static<typeof DraftState>
export const DraftState = Type.Object({
    leaders: Type.Array(Type.String()),
    lore: Type.Array(Type.String()),
    lorePerPlayer: Type.Integer({ minimum: 1 }),
    // The player to pick next.
    drafter: Type.String()
})

export type ArcsGameState = Type.Static<typeof ArcsGameState>
export const ArcsGameState = Type.Object({
    ...Type.Omit(GameState, ['players', 'machineState']).properties,
    players: Type.Array(ArcsPlayerState),
    machineState: Type.Enum(MachineState),
    leadersAndLore: Type.Enum(LeadersAndLore),
    splitDiscards: Type.Boolean(),
    setupCard: Type.Optional(SetupCardIdSchema),
    outOfPlay: Type.Array(Type.Integer({ minimum: 1, maximum: 6 })),
    systems: Type.Array(SystemState),
    supply: ResourceCounts,
    court: Type.Array(CourtSlot),
    courtDeck: CardPile,
    courtDiscard: Type.Array(Type.String()),
    actionDiscard: CardPile,
    // Face-up plays, kept apart from the face-down pile under the split discards option.
    faceUpDiscard: Type.Array(Type.String()),
    ambitionMarkers: Type.Array(AmbitionMarker),
    ambitionResources: Type.Array(AmbitionResource),
    chapter: Type.Integer({ minimum: 1 }),
    initiative: Type.String(),
    round: RoundState,
    turn: Type.Optional(TurnRecord),
    draft: Type.Optional(DraftState),
    battle: Type.Optional(BattleState),
    // Archivist, Learned: the 5 lore drawn after setup, 2 of which they keep.
    archive: Type.Optional(
        Type.Object({ playerId: Type.String(), cards: Type.Array(Type.String()) })
    ),
    // Planets whose type the Shaper's Mythic changed, by system.
    planetTypes: Type.Record(Type.String(), ResourceSchema),
    // Abilities set off by an ambition just declared, being resolved.
    declaration: Type.Optional(Declaration)
})

export const ArcsGameStateValidator = Compile(ArcsGameState)
export const ArcsProjectedState = Visibility.createProjectionSchema(ArcsGameState)
export type ArcsProjectedState = Type.Static<typeof ArcsProjectedState>
const ArcsProjectedStateValidator = Compile(ArcsProjectedState)

// What scoring one ambition gave each player, for the history.
export type AmbitionAward = Type.Static<typeof AmbitionAward>
export const AmbitionAward = Type.Object({
    ambition: AmbitionSchema,
    playerId: Type.String(),
    place: Type.Union([Type.Literal(1), Type.Literal(2)]),
    power: Type.Integer({ minimum: 0 })
})

// The base game's start, without leaders: resources come from the A and B planets instead.
const BaseSetup: LeaderSetup = {
    resources: [Resource.Material, Resource.Material],
    A: { building: 'city', ships: 3 },
    B: { building: 'starport', ships: 3 },
    C: { ships: 2 }
}

export type ChapterEnd = Type.Static<typeof ChapterEnd>
export const ChapterEnd = Type.Object({
    awards: Type.Array(AmbitionAward),
    gameOver: Type.Boolean()
})

// A Rival of the two-player dummy, which counts for places but gains nothing.
const AmbitionDummy = '#ambition-boxes'

// Leaders who gain second place's Power for first place in an ambition, and nothing for second.
const SecondPlaceOnly: Partial<Record<string, Ambition>> = {
    [Leader.Elder]: Ambition.Tyrant,
    [Leader.Warrior]: Ambition.Empath,
    [Leader.Archivist]: Ambition.Tycoon
}

// The extra resource some leaders gain for a tax made with a Copy or Pivot's pip.
const CopyOrPivotTaxBonus: Partial<Record<string, Resource>> = {
    [Leader.Mystic]: Resource.Psionic,
    [Leader.FuelDrinker]: Resource.Fuel,
    [Leader.Agitator]: Resource.Weapon
}

// Leaders' extra actions on a Copy or Pivot turn, and the pip action each goes with.
const LeaderBonuses: readonly {
    leader: Leader
    action: StandardAction
    partner: StandardAction
    before: boolean
}[] = [
    {
        leader: Leader.Warrior,
        action: StandardAction.Move,
        partner: StandardAction.Battle,
        before: true
    },
    {
        leader: Leader.Feastbringer,
        action: StandardAction.Influence,
        partner: StandardAction.Secure,
        before: true
    },
    {
        leader: Leader.Noble,
        action: StandardAction.Influence,
        partner: StandardAction.Influence,
        before: false
    }
]

// Archivist, Learned: lore drawn after setup, and kept.
const ArchiveDraw = 5
const ArchiveKeep = 2

// Ships an eliminated player places (rule 22.2.1).
const EliminatedFleet = 3

export class HydratedArcsGameState
    extends HydratableGameState<typeof ArcsProjectedState, HydratedArcsPlayerState>
    implements ArcsProjectedState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedArcsPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare leadersAndLore: LeadersAndLore
    declare splitDiscards: boolean
    declare setupCard?: SetupCardId
    declare outOfPlay: number[]
    declare systems: SystemState[]
    declare supply: ResourceCounts
    declare court: CourtSlot[]
    declare courtDeck: HydratedCardPile
    declare courtDiscard: string[]
    declare actionDiscard: HydratedCardPile
    declare faceUpDiscard: string[]
    declare ambitionMarkers: AmbitionMarker[]
    declare ambitionResources: AmbitionResource[]
    declare chapter: number
    declare initiative: string
    declare round: RoundState
    declare turn?: TurnRecord
    declare draft?: DraftState
    declare battle?: BattleState
    declare planetTypes: Record<string, Resource>
    declare archive?: { playerId: string; cards: string[] }
    declare declaration?: Declaration

    constructor(data: ArcsProjectedState) {
        super(data, ArcsProjectedStateValidator)
        this.players = data.players.map((player) => new HydratedArcsPlayerState(player))
        this.courtDeck = new HydratedCardPile(data.courtDeck)
        this.actionDiscard = new HydratedCardPile(data.actionDiscard)
    }

    // ----- The map -----

    clustersInPlay(): Cluster[] {
        return Clusters.filter((cluster) => !this.outOfPlay.includes(cluster))
    }

    system(id: SystemId): SystemState {
        const system = this.systems.find((candidate) => candidate.id === id)
        assertExists(system, `No system ${id}`)
        return system
    }

    // A planet's type: printed, unless the Shaper's Mythic changed it.
    planetType(id: SystemId): Resource | undefined {
        return this.planetTypes[id] ?? planetOf(id)?.resource
    }

    inPlay(id: SystemId): boolean {
        return this.clustersInPlay().includes(clusterOf(id))
    }

    adjacent(id: SystemId): SystemId[] {
        return adjacentSystems(id, this.clustersInPlay())
    }

    // The owner with more fresh ships than every other, if any (rule 4.6.3).
    controller(id: SystemId): string | undefined {
        const fresh = Object.entries(this.system(id).ships)
            .map(([owner, count]) => ({ owner, fresh: count.fresh }))
            .filter((entry) => entry.fresh > 0)
            .sort((a, b) => b.fresh - a.fresh)
        if (fresh.length === 0 || (fresh.length > 1 && fresh[1].fresh === fresh[0].fresh)) {
            return undefined
        }
        return fresh[0].owner
    }

    controlledByOther(id: SystemId, playerId: string): boolean {
        const controller = this.controller(id)
        return controller !== undefined && controller !== playerId
    }

    hasLoyalPiece(id: SystemId, playerId: string): boolean {
        const system = this.system(id)
        const ships = shipsOf(system, playerId)
        return (
            ships.fresh + ships.damaged > 0 ||
            buildingsIn(system).some((building) => building.owner === playerId)
        )
    }

    addShips(id: SystemId, owner: string, fresh: number, damaged: number = 0) {
        const system = this.system(id)
        const ships = shipsOf(system, owner)
        system.ships[owner] = { fresh: ships.fresh + fresh, damaged: ships.damaged + damaged }
    }

    removeShips(id: SystemId, owner: string, fresh: number, damaged: number) {
        const system = this.system(id)
        const ships = shipsOf(system, owner)
        assert(
            ships.fresh >= fresh && ships.damaged >= damaged,
            `Not enough of ${owner}'s ships in ${id}`
        )
        const left = { fresh: ships.fresh - fresh, damaged: ships.damaged - damaged }
        if (left.fresh + left.damaged === 0) {
            delete system.ships[owner]
        } else {
            system.ships[owner] = left
        }
    }

    // Places a ship from the player's supply. Returns false if the supply is empty.
    placeShipFromSupply(id: SystemId, playerId: string, damaged: boolean = false): boolean {
        const player = this.getPlayerState(playerId)
        if (player.ships === 0) {
            return false
        }
        player.ships -= 1
        this.addShips(id, playerId, damaged ? 0 : 1, damaged ? 1 : 0)
        return true
    }

    emptySlot(id: SystemId): number {
        return this.system(id).slots.findIndex((slot) => slot === null)
    }

    // A system's building slots, then its buildings outside slots; buildings are addressed by
    // their index here.
    buildingSlots(id: SystemId): (Building | null)[] {
        const system = this.system(id)
        return [...system.slots, ...system.extraBuildings]
    }

    buildingAt(id: SystemId, slot: number): Building | null {
        return this.buildingSlots(id)[slot] ?? null
    }

    setBuildingAt(id: SystemId, slot: number, building: Building | null) {
        const system = this.system(id)
        if (slot < system.slots.length) {
            system.slots[slot] = building
            return
        }
        const outside = slot - system.slots.length
        assert(outside < system.extraBuildings.length, `${id} has no building ${slot}`)
        system.extraBuildings[outside] = building
    }

    // Puts a building from the player's supply into the first empty slot, or outside the slots.
    // Cities come off the player board from the left.
    placeBuilding(
        id: SystemId,
        playerId: string,
        kind: BuildingKind,
        damaged: boolean = false,
        outside: boolean = false
    ) {
        const slot = this.emptySlot(id)
        assert(outside || slot >= 0, `${id} has no empty building slot`)
        const player = this.getPlayerState(playerId)
        if (kind === BuildingKind.City) {
            assert(player.citiesOnBoard > 0, `${playerId} has no city to build`)
            player.citiesOnBoard -= 1
        } else {
            assert(player.starports > 0, `${playerId} has no starport to build`)
            player.starports -= 1
        }
        const building = { owner: playerId, kind, damaged }
        if (outside) {
            this.system(id).extraBuildings.push(building)
        } else {
            this.system(id).slots[slot] = building
        }
    }

    building(id: SystemId, slot: number): Building {
        const building = this.buildingAt(id, slot)
        assertExists(building, `No building in ${id} slot ${slot}`)
        return building
    }

    // ----- Setup -----

    // Places a seat's starting pieces from its setup card, as the leader card says or, without
    // leaders, 3 ships and a city at A, 3 ships and a starport at B, 2 ships at each C (rules
    // 3.1.2.3–3.1.2.4 and 11.1.4–11.1.5). Starting resources fill the two leftmost slots.
    placeStart(playerId: string, seat: number, setup: LeaderSetup = BaseSetup) {
        assertExists(this.setupCard, 'The game has no setup card')
        const start = SetupCards[this.setupCard].seats[seat]
        assertExists(start, `The setup card has no seat ${seat + 1}`)
        const place = (id: SystemId, pieces: LeaderStart) => {
            for (let ship = 0; ship < pieces.ships; ship++) {
                this.placeShipFromSupply(id, playerId)
            }
            if (pieces.building) {
                this.placeBuilding(
                    id,
                    playerId,
                    pieces.building === 'city' ? BuildingKind.City : BuildingKind.Starport
                )
            }
        }
        place(start.A, setup.A)
        place(start.B, setup.B)
        for (const id of start.C) {
            place(id, setup.C)
        }
        const resources =
            setup === BaseSetup
                ? [start.A, start.B].map((id) => planetOf(id)?.resource)
                : setup.resources
        for (const resource of resources) {
            assertExists(resource, 'Starting systems A and B are planets')
            this.gainAllFromSupply(playerId, [resource], [])
        }
    }

    // ----- Leaders & Lore draft (rule 11.1) -----

    // Picks go in reverse turn order: from the player to the right of the initiative,
    // counterclockwise, round and round until everyone has their leader and lore.
    draftOrder(): string[] {
        return [...this.roundOrder()].reverse()
    }

    needsFromDraft(playerId: string, kind: DraftKind): boolean {
        assertExists(this.draft, 'No draft is in progress')
        const player = this.getPlayerState(playerId)
        return kind === DraftKind.Leader
            ? player.leader === undefined
            : player.lore.length < this.draft.lorePerPlayer
    }

    draftDone(playerId: string): boolean {
        return (
            !this.needsFromDraft(playerId, DraftKind.Leader) &&
            !this.needsFromDraft(playerId, DraftKind.Lore)
        )
    }

    canDraft(playerId: string, cardId: string, kind: DraftKind): boolean {
        const draft = this.draft
        if (!draft || draft.drafter !== playerId || !this.needsFromDraft(playerId, kind)) {
            return false
        }
        return (kind === DraftKind.Leader ? draft.leaders : draft.lore).includes(cardId)
    }

    draftCard(playerId: string, cardId: string, kind: DraftKind) {
        assert(this.canDraft(playerId, cardId, kind), `${playerId} cannot draft ${cardId}`)
        const draft = this.draft
        assertExists(draft, 'No draft is in progress')
        const player = this.getPlayerState(playerId)
        if (kind === DraftKind.Leader) {
            draft.leaders.splice(draft.leaders.indexOf(cardId), 1)
            player.leader = cardId
        } else {
            draft.lore.splice(draft.lore.indexOf(cardId), 1)
            this.gainLore(playerId, [cardId])
        }
        const order = this.draftOrder()
        const start = order.indexOf(playerId)
        const next = [...order.slice(start + 1), ...order.slice(0, start + 1)].find(
            (candidate) => !this.draftDone(candidate)
        )
        draft.drafter = next ?? playerId
    }

    draftComplete(): boolean {
        return this.players.every((player) => this.draftDone(player.playerId))
    }

    // Everyone sets up from their leader, then any leader's extra setup steps run in turn order
    // (rule 11.1.4–11.1.6).
    finishDraft() {
        this.turnManager.turnOrder.forEach((playerId, seat) => {
            const leader = this.getPlayerState(playerId).leader
            assertExists(leader, `${playerId} has no leader`)
            const setup = LeaderSetups[leader]
            assertExists(setup, `No setup for leader ${leader}`)
            this.placeStart(playerId, seat, setup)
        })
        for (const playerId of this.turnManager.turnOrder) {
            const player = this.getPlayerState(playerId)
            switch (player.leader) {
                // Mystic, Cryptic: agents on the Material and Fuel Outrage slots.
                case Leader.Mystic:
                    this.outrageAtSetup(player, [Resource.Material, Resource.Fuel])
                    break
                // Overseer, Hated: scrap 2 ships and 3 agents.
                case Leader.Overseer:
                    player.ships -= 2
                    player.agents -= 3
                    break
                // Anarchist, Decentralized: scrap the 2 leftmost cities.
                case Leader.Anarchist:
                    player.citiesOnBoard -= 2
                    break
                // Quartermaster, Greedy: an agent on the Material Outrage slot.
                case Leader.Quartermaster:
                    this.outrageAtSetup(player, [Resource.Material])
                    break
            }
        }
        this.draft = undefined
    }

    // Ancient Holdings brings its own resource slot.
    gainLore(playerId: string, cardIds: readonly string[]) {
        const player = this.getPlayerState(playerId)
        player.lore.push(...cardIds)
        if (cardIds.includes(Lore.AncientHoldings) && player.resources.length === HoldingsSlot) {
            player.resources.push(null)
        }
    }

    // ----- Archivist, Learned -----

    archivist(): string | undefined {
        return this.players.find((player) => player.leader === Leader.Archivist)?.playerId
    }

    // Draws 5 lore from those nobody has, at random.
    drawArchive() {
        const playerId = this.archivist()
        assertExists(playerId, 'There is an Archivist')
        const held = new Set(this.players.flatMap((player) => player.lore))
        const deck = LoreCards.map((card) => card.id).filter((cardId) => !held.has(cardId))
        shuffle(deck, this.getProtectedPrng().random)
        this.archive = { playerId, cards: deck.slice(0, ArchiveDraw) }
    }

    canKeepLore(playerId: string, cardIds: readonly string[]): boolean {
        const archive = this.archive
        return (
            archive?.playerId === playerId &&
            cardIds.length === Math.min(ArchiveKeep, archive.cards.length) &&
            new Set(cardIds).size === cardIds.length &&
            cardIds.every((cardId) => archive.cards.includes(cardId))
        )
    }

    // The rest are scrapped.
    keepLore(playerId: string, cardIds: readonly string[]) {
        assert(this.canKeepLore(playerId, cardIds), `${playerId} cannot keep those`)
        this.gainLore(playerId, cardIds)
        this.archive = undefined
    }

    private outrageAtSetup(player: HydratedArcsPlayerState, resources: readonly Resource[]) {
        for (const resource of resources) {
            player.outrage.push(resource)
            player.agents -= 1
        }
    }

    // ----- Players and turn order -----

    // Turn order for the round: clockwise from its leader (glossary 23.1.32).
    roundOrder(): string[] {
        const order = this.turnManager.turnOrder
        const start = order.indexOf(this.round.leader)
        return [...order.slice(start), ...order.slice(0, start)]
    }

    nextClockwise(playerId: string, predicate: (playerId: string) => boolean): string | undefined {
        const order = this.turnManager.turnOrder
        const start = order.indexOf(playerId)
        for (let offset = 1; offset <= order.length; offset++) {
            const candidate = order[(start + offset) % order.length]
            if (predicate(candidate)) {
                return candidate
            }
        }
        return undefined
    }

    hasCards(playerId: string): boolean {
        return this.getPlayerState(playerId).handCount > 0
    }

    // The next player to take a turn this round, if any: clockwise from the leader, skipping
    // anyone who played already or has no cards.
    nextTurnPlayer(): string | undefined {
        const played = new Set(this.round.plays.map((play) => play.playerId))
        return this.roundOrder().find(
            (playerId) => !played.has(playerId) && this.hasCards(playerId)
        )
    }

    activate(playerId: string) {
        this.activePlayerIds = [playerId]
    }

    // ----- Playing cards -----

    leadPlay(): CardPlay | undefined {
        return this.round.plays.find((play) => play.kind === PlayKind.Lead)
    }

    leadCard(): ActionCard | undefined {
        const cardId = this.leadPlay()?.cardId
        return cardId ? actionCard(cardId) : undefined
    }

    leadNumber(): number {
        const lead = this.leadPlay()
        assertExists(lead?.cardId, 'No card leads the round')
        return lead.zeroed ? 0 : actionCard(lead.cardId).number
    }

    availableMarker(): number | undefined {
        // The highest-Power available marker is taken first (rule 5.1.3.1).
        const available = this.ambitionMarkers
            .map((marker, index) => ({ marker, index }))
            .filter(({ marker }) => marker.ambition === undefined)
            .sort((a, b) => this.markerSide(b.index).first - this.markerSide(a.index).first)
        return available[0]?.index
    }

    markerSide(index: number): AmbitionMarkerSide {
        const sides = AmbitionMarkerSides[index]
        return this.ambitionMarkers[index].flipped ? sides.gold : sides.blue
    }

    canDeclare(card: ActionCard, ambition: Ambition): boolean {
        return declarableAmbitions(card).includes(ambition) && this.availableMarker() !== undefined
    }

    canLead(playerId: string, cardId: string, declare?: Ambition): boolean {
        if (this.leadPlay() || playerId !== this.initiative) {
            return false
        }
        const player = this.getPlayerState(playerId)
        if (!player.hasInHand(cardId)) {
            return false
        }
        return (
            declare === undefined ||
            (this.canDeclare(actionCard(cardId), declare) && canAffordDeclaration(this, playerId))
        )
    }

    lead(playerId: string, cardId: string, declare?: Ambition) {
        assert(this.canLead(playerId, cardId, declare), `${playerId} cannot lead ${cardId}`)
        const player = this.getPlayerState(playerId)
        player.removeFromHand(cardId)
        // Secret Order declares Keeper and Empath without the zero marker.
        const secret =
            this.holds(playerId, Court.SecretOrder) &&
            (declare === Ambition.Keeper || declare === Ambition.Empath)
        this.round.plays.push({
            playerId,
            kind: PlayKind.Lead,
            cardId,
            faceDown: [],
            faceDownCount: 0,
            zeroed: declare !== undefined && !secret
        })
        this.round.passes = 0
        this.startTurn(playerId, actionCard(cardId).pips)
        if (declare !== undefined) {
            this.declareAmbition(declare, playerId)
        }
    }

    // Queues whatever the declaration sets off for the declarer to resolve.
    declareAmbition(ambition: Ambition, playerId: string) {
        const marker = this.availableMarker()
        assertExists(marker, 'Every ambition marker is placed')
        const wasDeclared = this.ambitionMarkers.some((placed) => placed.ambition === ambition)
        this.ambitionMarkers[marker].ambition = ambition
        this.round.declared = true
        const steps = stepsOnDeclaring(this, playerId, wasDeclared)
        if (steps.length === 0) {
            return
        }
        if (this.declaration) {
            this.declaration.steps.push(...steps)
        } else {
            this.declaration = { playerId, ambition, steps }
        }
    }

    canSeize(playerId: string): boolean {
        return playerId !== this.initiative && this.round.seizedBy === undefined
    }

    // How a follower may play a card (rule 5.2.2): Surpass the lead suit with a higher number,
    // Pivot with another suit, or Copy with any card face down.
    canFollow(
        playerId: string,
        cardId: string,
        kind: PlayKind,
        seizeWith?: string,
        declare?: Ambition
    ): boolean {
        const lead = this.leadCard()
        if (!lead || kind === PlayKind.Lead || this.nextTurnPlayer() !== playerId) {
            return false
        }
        const player = this.getPlayerState(playerId)
        if (!player.hasInHand(cardId)) {
            return false
        }
        if (seizeWith !== undefined) {
            if (seizeWith === cardId || !player.hasInHand(seizeWith) || !this.canSeize(playerId)) {
                return false
            }
        }
        const card = actionCard(cardId)
        // Galactic Bards: a Surpass or Pivot may declare its card's ambition, if none has been
        // declared this round, without the zero marker.
        if (
            declare !== undefined &&
            (kind === PlayKind.Copy ||
                !this.holds(playerId, Court.GalacticBards) ||
                this.round.declared ||
                !this.canDeclare(card, declare) ||
                !canAffordDeclaration(this, playerId))
        ) {
            return false
        }
        switch (kind) {
            case PlayKind.Surpass:
                return card.suit === lead.suit && card.number > this.leadNumber()
            case PlayKind.Pivot:
                return card.suit !== lead.suit
            case PlayKind.Copy:
                return true
        }
    }

    follow(
        playerId: string,
        cardId: string,
        kind: PlayKind,
        seizeWith?: string,
        declare?: Ambition
    ) {
        assert(
            this.canFollow(playerId, cardId, kind, seizeWith, declare),
            `${playerId} cannot play ${cardId}`
        )
        const player = this.getPlayerState(playerId)
        player.removeFromHand(cardId)
        const faceDown: string[] = kind === PlayKind.Copy ? [cardId] : []
        if (seizeWith !== undefined) {
            player.removeFromHand(seizeWith)
            faceDown.push(seizeWith)
        }
        const card = actionCard(cardId)
        const seizes =
            seizeWith !== undefined ||
            (kind === PlayKind.Surpass && card.number === SeizingNumber && this.canSeize(playerId))
        if (seizes) {
            this.round.seizedBy = playerId
        }
        this.round.plays.push({
            playerId,
            kind,
            cardId: kind === PlayKind.Copy ? undefined : cardId,
            faceDown,
            faceDownCount: faceDown.length,
            zeroed: false
        })
        const pips = kind === PlayKind.Surpass ? card.pips : 1
        this.startTurn(playerId, pips)
        if (declare !== undefined) {
            this.declareAmbition(declare, playerId)
        }
    }

    // The initiative holder skips their turn: the next player clockwise with cards takes the
    // initiative and the round ends (rule 5.1.2).
    canPassInitiative(playerId: string): boolean {
        return playerId === this.initiative && this.leadPlay() === undefined
    }

    passInitiative(playerId: string): string | undefined {
        assert(this.canPassInitiative(playerId), `${playerId} cannot pass the initiative`)
        const next = this.nextClockwise(playerId, (candidate) => this.hasCards(candidate))
        this.round = newRound(next ?? playerId, this.round.passes + 1)
        if (next) {
            this.initiative = next
        }
        return next
    }

    // An initiative holder with no cards must pass it on (rule 5.1.2). It isn't a choice, so it
    // doesn't count towards everyone passing in a row.
    forfeitInitiative(): boolean {
        const next = this.nextClockwise(this.initiative, (candidate) => this.hasCards(candidate))
        if (!next) {
            return false
        }
        this.initiative = next
        this.round = newRound(next, this.round.passes)
        return true
    }

    // Everyone with cards passed in a row (rule 5.1.2.1).
    everyonePassed(): boolean {
        const holding = this.players.filter((player) => player.handCount > 0).length
        return holding === 0 || this.round.passes >= holding
    }

    // ----- Turns -----

    startTurn(playerId: string, pips: number) {
        this.turn = newTurnRecord(playerId, pips)
    }

    currentTurn(): TurnRecord {
        assertExists(this.turn, 'No turn is in progress')
        return this.turn
    }

    turnPlay(): CardPlay {
        const turn = this.currentTurn()
        const play = this.round.plays.find((candidate) => candidate.playerId === turn.playerId)
        assertExists(play, `${turn.playerId} has not played a card`)
        return play
    }

    // The standard actions the turn's pips can take: the played card's suit, or the lead card's
    // for Copy (rule 5.2.2.2), plus Battle once a Weapon is spent (rule 9.1).
    pipActions(): readonly StandardAction[] {
        const play = this.turnPlay()
        const suitCard = play.kind === PlayKind.Copy ? this.leadCard() : play.cardId
        const card = typeof suitCard === 'string' ? actionCard(suitCard) : suitCard
        assertExists(card, 'The turn has no card to act with')
        const actions = [...SuitActions[card.suit]]
        if (this.currentTurn().weaponSpent && !actions.includes(StandardAction.Battle)) {
            actions.push(StandardAction.Battle)
        }
        return actions
    }

    // Resources whose Prelude action takes a standard action (rule 9.1).
    resourceActions(resource: Resource): readonly StandardAction[] {
        switch (resource) {
            case Resource.Material:
                return [StandardAction.Build, StandardAction.Repair]
            case Resource.Fuel:
                return [StandardAction.Move]
            case Resource.Relic:
                return [StandardAction.Secure]
            case Resource.Psionic: {
                const lead = this.leadCard()
                return lead ? SuitActions[lead.suit] : []
            }
            case Resource.Weapon:
                return []
        }
    }

    // Spends a token for a resource's Prelude action: that resource, unless Outraged, or any
    // resource for a player with its Loyal card, who also ignores its Outrage (rule 7.7.4.1.1).
    canSpendResource(playerId: string, resource: Resource, token: Resource = resource): boolean {
        const turn = this.turn
        const player = this.getPlayerState(playerId)
        if (turn?.playerId !== playerId || !turn.prelude || player.resourceCount(token) === 0) {
            return false
        }
        return (
            this.holds(playerId, LoyalCards[resource]) ||
            (token === resource && !player.outrage.includes(resource))
        )
    }

    holds(playerId: string, cardId: string): boolean {
        return this.getPlayerState(playerId).guildCards.includes(cardId)
    }

    isLeader(playerId: string, leader: Leader): boolean {
        return this.getPlayerState(playerId).leader === leader
    }

    hasLore(playerId: string, lore: Lore): boolean {
        return this.getPlayerState(playerId).lore.includes(lore)
    }

    // Whether the turn can take this action, paid with a pip or a resource.
    canPay(
        playerId: string,
        action: StandardAction,
        via: Resource | undefined,
        token: Resource | undefined = via,
        bonus: boolean = false
    ): boolean {
        const turn = this.turn
        if (turn?.playerId !== playerId || this.machineState !== MachineState.TakingActions) {
            return false
        }
        if (bonus) {
            return (
                via === undefined &&
                token === undefined &&
                this.bonusSource(playerId, action) !== undefined
            )
        }
        if (via === undefined) {
            return (
                token === undefined &&
                turn.pips > 0 &&
                this.pipActions().includes(action) &&
                (turn.owed === undefined || turn.owed === action)
            )
        }
        return (
            this.canSpendResource(playerId, via, token ?? via) &&
            this.resourceActions(via).includes(action)
        )
    }

    pay(
        playerId: string,
        action: StandardAction,
        via: Resource | undefined,
        token: Resource | undefined = via,
        bonus: boolean = false
    ) {
        assert(
            this.canPay(playerId, action, via, token, bonus),
            `${playerId} cannot ${action} that way`
        )
        const turn = this.currentTurn()
        turn.acted = true
        turn.lastBuildingAction = undefined
        if (bonus) {
            const source = this.bonusSource(playerId, action)
            assertExists(source, 'An extra action has a source')
            turn.bonusesUsed.push(source.leader)
            if (!turn.pipActionsTaken.includes(source.partner)) {
                turn.owed = source.partner
            }
        } else if (token === undefined) {
            turn.pips -= 1
            turn.pipActionsTaken.push(action)
            if (turn.owed === action) {
                turn.owed = undefined
            }
            this.endPrelude()
        } else {
            this.getPlayerState(playerId).removeResource(token)
            turn.spent[token] += 1
        }
    }

    // A leader's extra action on a Copy or Pivot turn, if one is open: the Warrior's move and the
    // Feastbringer's influence go with the pip's battle or secure, before or after it; the
    // Noble's second influence follows the first.
    bonusSource(
        playerId: string,
        action: StandardAction
    ): { leader: Leader; partner: StandardAction } | undefined {
        const turn = this.turn
        if (turn?.playerId !== playerId || this.machineState !== MachineState.TakingActions) {
            return undefined
        }
        const kind = this.turnPlay().kind
        if (kind !== PlayKind.Copy && kind !== PlayKind.Pivot) {
            return undefined
        }
        const bonus = LeaderBonuses.find(
            (candidate) =>
                candidate.action === action &&
                this.isLeader(playerId, candidate.leader) &&
                !turn.bonusesUsed.includes(candidate.leader)
        )
        if (!bonus) {
            return undefined
        }
        const after = turn.pipActionsTaken.includes(bonus.partner)
        const before =
            bonus.before &&
            turn.owed === undefined &&
            turn.pips > 0 &&
            this.pipActions().includes(bonus.partner)
        return after || before ? { leader: bonus.leader, partner: bonus.partner } : undefined
    }

    // A spent Weapon lets this turn's pips battle (rule 9.1).
    spendWeapon(playerId: string, token: Resource = Resource.Weapon) {
        assert(
            this.canSpendResource(playerId, Resource.Weapon, token),
            `${playerId} cannot spend a Weapon`
        )
        const turn = this.currentTurn()
        turn.acted = true
        this.getPlayerState(playerId).removeResource(token)
        turn.spent[token] += 1
        turn.weaponSpent = true
    }

    // Resources spent in the Prelude go back to the supply when it ends (rule 8.1.2).
    endPrelude() {
        const turn = this.currentTurn()
        if (!turn.prelude) {
            return
        }
        turn.prelude = false
        for (const resource of Object.values(Resource)) {
            this.supply[resource] += turn.spent[resource]
            turn.spent[resource] = 0
        }
    }

    endTurn() {
        if (this.turn) {
            this.endPrelude()
        }
        this.turn = undefined
    }

    // ----- Standard actions -----

    // Tax: a Loyal city, or a Rival city the player controls; the Rival loses an agent to the
    // player's Captives (rule 7.1).
    // Whether the player may tax this slot: a Loyal city, or a Rival city they control (rule 7.1),
    // as their leader allows. Once per city per turn.
    canTaxSlot(playerId: string, id: SystemId, slot: number): boolean {
        // Warlord's Cruelty: while Warlord is declared, a city can be taxed again.
        const again =
            this.hasLore(playerId, Lore.WarlordsCruelty) && this.isDeclared(Ambition.Warlord)
        if (!again && this.currentTurn().taxed.includes(`${id}:${slot}`)) {
            return false
        }
        const building = this.buildingAt(id, slot)
        const controls = this.controller(id) === playerId
        // Anarchist, Inspiring: with Loyal ships there, Rival cities ignoring control, and empty
        // slots like Loyal cities. Principled: never Loyal cities.
        if (this.isLeader(playerId, Leader.Anarchist)) {
            const ships = shipsOf(this.system(id), playerId)
            const present = ships.fresh + ships.damaged > 0
            if (building === null) {
                return present && slot < this.system(id).slots.length
            }
            return (
                building?.kind === BuildingKind.City &&
                building.owner !== playerId &&
                (controls || present)
            )
        }
        if (building?.kind !== BuildingKind.City) {
            return false
        }
        // Upstart, Callow: only cities they control.
        if (this.isLeader(playerId, Leader.Upstart) && !controls) {
            return false
        }
        return building.owner === playerId || controls || this.empathsBond(playerId)
    }

    // Empath's Bond, while Empath is declared: any city taxed, any starport used, as if Loyal.
    empathsBond(playerId: string): boolean {
        return this.hasLore(playerId, Lore.EmpathsBond) && this.isDeclared(Ambition.Empath)
    }

    // The resources taxing a city can give: its planet's type, or for a Gate Station city, any
    // type of the cities in its cluster.
    cityTypes(id: SystemId): Resource[] {
        if (!isGate(id)) {
            const planetType = this.planetType(id)
            return planetType === undefined ? [] : [planetType]
        }
        const types = this.systems
            .filter(
                (system) =>
                    clusterOf(system.id) === clusterOf(id) &&
                    !isGate(system.id) &&
                    buildingsIn(system).some((building) => building.kind === BuildingKind.City)
            )
            .flatMap((system) => this.cityTypes(system.id))
        return [...new Set(types)]
    }

    // What taxing gains: the planet's resource, plus the leader's extra one for a tax made with the
    // pip of a Copy or Pivot (Mystic, Fuel-Drinker, Agitator).
    taxGains(
        playerId: string,
        id: SystemId,
        copyOrPivotPip: boolean,
        cityType?: Resource
    ): Resource[] {
        const types = this.cityTypes(id)
        const chosen = cityType ?? (types.length === 1 ? types[0] : undefined)
        const gains = chosen !== undefined && types.includes(chosen) ? [chosen] : []
        const leader = this.getPlayerState(playerId).leader
        const extra = leader === undefined ? undefined : CopyOrPivotTaxBonus[leader]
        if (copyOrPivotPip && extra !== undefined) {
            gains.push(extra)
        }
        return gains
    }

    // Whether the action about to be paid is the single pip of a Copy or Pivot.
    copyOrPivotPip(via: Resource | undefined): boolean {
        const kind = this.turnPlay().kind
        return via === undefined && (kind === PlayKind.Copy || kind === PlayKind.Pivot)
    }

    canTax(
        playerId: string,
        id: SystemId,
        slot: number,
        discard: readonly Resource[] = [],
        copyOrPivotPip: boolean = false,
        cityType?: Resource
    ): boolean {
        // A Gate Station city of several types needs one chosen.
        const types = this.cityTypes(id)
        const typeChosen =
            cityType === undefined
                ? types.length <= 1
                : types.length > 1 && types.includes(cityType)
        return (
            this.canTaxSlot(playerId, id, slot) &&
            typeChosen &&
            this.canGainAllFromSupply(
                playerId,
                this.taxGains(playerId, id, copyOrPivotPip, cityType),
                discard
            )
        )
    }

    tax(
        playerId: string,
        id: SystemId,
        slot: number,
        discard: readonly Resource[] = [],
        copyOrPivotPip: boolean = false,
        cityType?: Resource
    ): { gained: Resource[]; discarded: Resource[]; captured?: string } {
        assert(
            this.canTax(playerId, id, slot, discard, copyOrPivotPip, cityType),
            `${playerId} cannot tax ${id} slot ${slot}`
        )
        const turn = this.currentTurn()
        turn.taxed.push(`${id}:${slot}`)
        turn.lastBuildingAction = { kind: 'tax', system: id, slot, copyOrPivotPip }
        const result: { gained: Resource[]; discarded: Resource[]; captured?: string } =
            this.gainAllFromSupply(
                playerId,
                this.taxGains(playerId, id, copyOrPivotPip, cityType),
                discard
            )
        const owner = this.buildingAt(id, slot)?.owner
        // A Rival city taxed only through Empath's Bond gives no Captive.
        const bondOnly =
            this.controller(id) !== playerId && !this.isLeader(playerId, Leader.Anarchist)
        if (owner !== undefined && owner !== playerId && !bondOnly) {
            const rival = this.getPlayerState(owner)
            if (rival.agents > 0) {
                rival.agents -= 1
                this.getPlayerState(playerId).capture(owner)
                result.captured = owner
            }
        }
        return result
    }

    // The gains the supply can give, in order; a Cartel's supply gives none.
    availableGains(gains: readonly Resource[]): Resource[] {
        const left = { ...this.supply }
        return gains.filter((resource) => {
            if (this.cartelHolder(resource) !== undefined || left[resource] === 0) {
                return false
            }
            left[resource] -= 1
            return true
        })
    }

    canGainAllFromSupply(
        playerId: string,
        gains: readonly Resource[],
        discard: readonly Resource[]
    ): boolean {
        return this.getPlayerState(playerId).canGainAll(this.availableGains(gains), discard)
    }

    // Gains what the supply has, discarding what can't be held back to the supply.
    gainAllFromSupply(
        playerId: string,
        gains: readonly Resource[],
        discard: readonly Resource[]
    ): { gained: Resource[]; discarded: Resource[] } {
        assert(this.canGainAllFromSupply(playerId, gains, discard), `${playerId} cannot gain so`)
        const available = this.availableGains(gains)
        for (const resource of available) {
            this.supply[resource] -= 1
        }
        const kept = [...available]
        for (const discarded of this.getPlayerState(playerId).gainAll(available, discard)) {
            this.supply[discarded] += 1
            const index = kept.indexOf(discarded)
            if (index >= 0) {
                kept.splice(index, 1)
            }
        }
        return { gained: kept, discarded: [...discard] }
    }

    // The supply players can gain from: none while a Cartel holds it.
    supplyAvailable(resource: Resource): number {
        return this.cartelHolder(resource) === undefined ? this.supply[resource] : 0
    }

    cartelHolder(resource: Resource): string | undefined {
        const cartel = Cartels[resource]
        return cartel === undefined
            ? undefined
            : this.players.find((player) => player.guildCards.includes(cartel))?.playerId
    }

    // Fuel-Drinker, Lavish: after scoring, all their Fuel goes if Tycoon was scored.
    lavishSpending() {
        if (!this.ambitionMarkers.some((marker) => marker.ambition === Ambition.Tycoon)) {
            return
        }
        for (const player of this.players) {
            if (player.leader !== Leader.FuelDrinker) {
                continue
            }
            for (const [slot, held] of player.resources.entries()) {
                if (held === Resource.Fuel) {
                    player.resources[slot] = null
                    this.supply[Resource.Fuel] += 1
                }
            }
        }
    }

    // After scoring, each Cartel's holder's Rivals discard all of its resource (to the card).
    cartelsTakeTheirDue() {
        for (const resource of Object.values(Resource)) {
            const holder = this.cartelHolder(resource)
            if (holder === undefined) {
                continue
            }
            for (const player of this.players) {
                if (player.playerId === holder) {
                    continue
                }
                for (const [slot, held] of player.resources.entries()) {
                    if (held === resource) {
                        player.resources[slot] = null
                        this.supply[resource] += 1
                    }
                }
            }
        }
    }

    // Build a city or starport in an empty slot of a system with a Loyal piece, or a ship at a
    // Loyal starport, once per starport per turn (rule 7.2).
    canBuildBuilding(playerId: string, id: SystemId, kind: BuildingKind): boolean {
        if (!this.inPlay(id) || this.buildPlace(playerId, id, kind) === undefined) {
            return false
        }
        const player = this.getPlayerState(playerId)
        const inSupply = kind === BuildingKind.City ? player.citiesOnBoard : player.starports
        return inSupply > 0 && this.hasLoyalPiece(id, playerId)
    }

    // Where a new building goes: an empty slot of a planet, else outside the slots as lore allows
    // (Gate Ports: a starport per gate; Gate Stations: a city per gate; Cloud Cities: a city per
    // planet, for a resource of its type).
    buildPlace(playerId: string, id: SystemId, kind: BuildingKind): 'slot' | 'outside' | undefined {
        if (!isGate(id) && this.emptySlot(id) >= 0) {
            return 'slot'
        }
        const taken = this.system(id).extraBuildings.some((building) => building?.kind === kind)
        if (taken) {
            return undefined
        }
        if (isGate(id)) {
            const lore = kind === BuildingKind.Starport ? Lore.GatePorts : Lore.GateStations
            return this.hasLore(playerId, lore) ? 'outside' : undefined
        }
        const planetType = this.planetType(id)
        return kind === BuildingKind.City &&
            this.hasLore(playerId, Lore.CloudCities) &&
            planetType !== undefined &&
            this.getPlayerState(playerId).resourceCount(planetType) > 0
            ? 'outside'
            : undefined
    }

    buildBuilding(playerId: string, id: SystemId, kind: BuildingKind): boolean {
        assert(this.canBuildBuilding(playerId, id, kind), `${playerId} cannot build in ${id}`)
        const outside = this.buildPlace(playerId, id, kind) === 'outside'
        const planetType = this.planetType(id)
        if (outside && !isGate(id) && planetType !== undefined) {
            this.getPlayerState(playerId).removeResource(planetType)
            this.supply[planetType] += 1
        }
        const damaged = this.controlledByOther(id, playerId)
        this.placeBuilding(id, playerId, kind, damaged, outside)
        return damaged
    }

    canBuildShip(playerId: string, id: SystemId, slot: number): boolean {
        const building = this.buildingAt(id, slot)
        return (
            building?.kind === BuildingKind.Starport &&
            (building.owner === playerId || this.empathsBond(playerId)) &&
            this.getPlayerState(playerId).ships > 0 &&
            !this.currentTurn().starportsBuilt.includes(`${id}:${slot}`)
        )
    }

    buildShip(playerId: string, id: SystemId, slot: number): boolean {
        assert(this.canBuildShip(playerId, id, slot), `${playerId} cannot build a ship there`)
        const turn = this.currentTurn()
        turn.starportsBuilt.push(`${id}:${slot}`)
        turn.lastBuildingAction = { kind: 'buildShip', system: id, slot, copyOrPivotPip: false }
        const damaged = this.buildsShipDamaged(playerId, id)
        this.placeShipFromSupply(id, playerId, damaged)
        return damaged
    }

    // Ships built where someone else has control are damaged, except with Hidden Harbors.
    buildsShipDamaged(playerId: string, id: SystemId): boolean {
        return !this.hasLore(playerId, Lore.HiddenHarbors) && this.controlledByOther(id, playerId)
    }

    // ----- Overseer, Ruthless, and Shaper, Mythic -----

    // Whether a change would go through, tried on a copy of the state.
    wouldSucceed(change: (state: HydratedArcsGameState) => void): boolean {
        const copy = new HydratedArcsGameState(structuredClone(this.dehydrate()))
        try {
            change(copy)
            return true
        } catch {
            return false
        }
    }

    canRuthless(playerId: string, choice: RuthlessChoice): boolean {
        const turn = this.turn
        return (
            this.machineState === MachineState.TakingActions &&
            turn?.playerId === playerId &&
            turn.lastBuildingAction !== undefined &&
            this.isLeader(playerId, Leader.Overseer) &&
            !turn.usedCards.includes(Leader.Overseer) &&
            this.wouldSucceed((copy) => copy.applyRuthless(playerId, choice))
        )
    }

    // Once per turn, after a tax or a ship build, hit the building to take the action again with
    // it. Destroying a city Provokes Outrage first; a Rival's city is a Trophy and is owed a
    // Ransack.
    ruthless(playerId: string, choice: RuthlessChoice): RuthlessResult {
        assert(this.canRuthless(playerId, choice), `${playerId} cannot use Ruthless so`)
        return this.applyRuthless(playerId, choice)
    }

    applyRuthless(playerId: string, choice: RuthlessChoice): RuthlessResult {
        const turn = this.currentTurn()
        const last = turn.lastBuildingAction
        assertExists(last, 'Ruthless follows a tax or ship build')
        turn.usedCards.push(Leader.Overseer)
        turn.lastBuildingAction = undefined
        const { system: id, slot } = last
        const building = this.building(id, slot)
        const owner = building.owner
        const result: RuthlessResult = { destroyed: building.damaged, gained: [], discarded: [] }
        if (!building.damaged) {
            building.damaged = true
        } else {
            this.setBuildingAt(id, slot, null)
            const kind = building.kind === BuildingKind.City ? TrophyKind.City : TrophyKind.Starport
            if (owner === playerId) {
                this.returnPiece(owner, kind)
            } else {
                this.getPlayerState(playerId).trophies.push({ owner, kind })
            }
            if (building.kind === BuildingKind.City) {
                this.destroyCity(playerId, id)
            }
        }
        const owesRansack =
            result.destroyed &&
            building.kind === BuildingKind.City &&
            owner !== playerId &&
            this.ransackableCards(owner).length > 0
        if (owesRansack) {
            assertExists(choice.ransack, 'A Ransack is owed')
            assert(this.ransackableCards(owner).includes(choice.ransack), 'Not ransackable')
            assert(this.canChooseWhenSecured(playerId, choice.ransack, choice.vox), 'Bad choice')
            this.takeCourtCard(playerId, choice.ransack, 'trophies', choice.vox)
        } else {
            assert(choice.ransack === undefined && choice.vox === undefined, 'No Ransack owed')
        }
        if (last.kind === 'tax') {
            const gained = this.gainAllFromSupply(
                playerId,
                this.taxGains(playerId, id, last.copyOrPivotPip),
                choice.discard ?? []
            )
            result.gained = gained.gained
            result.discarded = gained.discarded
            const rival = owner === playerId ? undefined : this.getPlayerState(owner)
            if (rival && rival.agents > 0) {
                rival.agents -= 1
                this.getPlayerState(playerId).capture(owner)
            }
        } else {
            assert((choice.discard ?? []).length === 0, 'Building a ship gains nothing')
            this.placeShipFromSupply(id, playerId, this.buildsShipDamaged(playerId, id))
        }
        return result
    }

    canMythic(playerId: string, resource: Resource): boolean {
        const last = this.turn?.lastBuildingAction
        return (
            this.machineState === MachineState.TakingActions &&
            this.turn?.playerId === playerId &&
            last?.kind === 'tax' &&
            this.isLeader(playerId, Leader.Shaper) &&
            this.planetTypes[last.system] === undefined &&
            this.getPlayerState(playerId).resourceCount(resource) > 0
        )
    }

    // After taxing, place a resource over the planet's icon: its type for good.
    mythic(playerId: string, resource: Resource) {
        assert(this.canMythic(playerId, resource), `${playerId} cannot use Mythic so`)
        const turn = this.currentTurn()
        const last = turn.lastBuildingAction
        assertExists(last, 'Mythic follows a tax')
        this.getPlayerState(playerId).removeResource(resource)
        this.planetTypes[last.system] = resource
        turn.lastBuildingAction = undefined
    }

    // Move ships from one system along a path. Without a Loyal starport where they start, the path
    // is one step. With one, they Catapult on through gates nobody else controls, stopping at the
    // first planet or Rival-controlled gate; ships may be dropped off along the way (rule 7.3).
    canMove(
        playerId: string,
        from: SystemId,
        path: readonly SystemId[],
        moving: ShipsMoving,
        dropOffs: readonly ShipsMoving[]
    ): boolean {
        if (path.length === 0 || dropOffs.length !== path.length - 1) {
            return false
        }
        const ships = shipsOf(this.system(from), playerId)
        if (
            moving.fresh < 0 ||
            moving.damaged < 0 ||
            moving.fresh + moving.damaged === 0 ||
            moving.fresh > ships.fresh ||
            moving.damaged > ships.damaged ||
            // Rebel, Disorganized: at most 2 ships at a time.
            (this.isLeader(playerId, Leader.Rebel) && moving.fresh + moving.damaged > 2)
        ) {
            return false
        }
        // Shaper, Ancient: Catapult from gates, never from starports.
        const catapult = this.isLeader(playerId, Leader.Shaper)
            ? isGate(from)
            : buildingsIn(this.system(from)).some(
                  (building) =>
                      building.kind === BuildingKind.Starport &&
                      (building.owner === playerId || this.empathsBond(playerId))
              )
        if (path.length > 1 && !catapult) {
            return false
        }
        let left = { ...moving }
        let at = from
        for (const [step, next] of path.entries()) {
            if (!this.adjacent(at).includes(next)) {
                return false
            }
            if (step < path.length - 1) {
                // Only a gate nobody else controls lets them keep going.
                if (!isGate(next) || this.controlledByOther(next, playerId)) {
                    return false
                }
                const drop = dropOffs[step]
                left = { fresh: left.fresh - drop.fresh, damaged: left.damaged - drop.damaged }
                if (drop.fresh < 0 || drop.damaged < 0 || left.fresh < 0 || left.damaged < 0) {
                    return false
                }
                if (left.fresh + left.damaged === 0) {
                    return false
                }
            }
            at = next
        }
        return true
    }

    // Returns the agents Gate Ports captured from the mover, by capturer.
    move(
        playerId: string,
        from: SystemId,
        path: readonly SystemId[],
        moving: ShipsMoving,
        dropOffs: readonly ShipsMoving[]
    ): Record<string, number> {
        assert(this.canMove(playerId, from, path, moving, dropOffs), `${playerId} cannot move so`)
        const capturers = path.flatMap((id) => this.gatePortsGuarding(id, playerId))
        this.removeShips(from, playerId, moving.fresh, moving.damaged)
        let left = { ...moving }
        for (const [step, drop] of dropOffs.entries()) {
            if (drop.fresh + drop.damaged > 0) {
                this.addShips(path[step], playerId, drop.fresh, drop.damaged)
            }
            left = { fresh: left.fresh - drop.fresh, damaged: left.damaged - drop.damaged }
        }
        this.addShips(path[path.length - 1], playerId, left.fresh, left.damaged)
        const captured: Record<string, number> = {}
        const mover = this.getPlayerState(playerId)
        for (const capturer of capturers) {
            if (mover.agents > 0) {
                mover.agents -= 1
                this.getPlayerState(capturer).capture(playerId)
                captured[capturer] = (captured[capturer] ?? 0) + 1
            }
        }
        return captured
    }

    // Gate Ports: Rivals who control this gate with a fresh Loyal starport there, and so capture
    // an agent of a player moving in.
    gatePortsGuarding(id: SystemId, mover: string): string[] {
        if (!isGate(id)) {
            return []
        }
        const controller = this.controller(id)
        if (
            controller === undefined ||
            controller === mover ||
            !this.hasLore(controller, Lore.GatePorts)
        ) {
            return []
        }
        const port = buildingsIn(this.system(id)).some(
            (building) =>
                building.owner === controller &&
                building.kind === BuildingKind.Starport &&
                !building.damaged
        )
        return port ? [controller] : []
    }

    // Sprinter Drives: some fresh ships that just moved move once more, from where they stopped.
    canSprint(
        playerId: string,
        arrived: Readonly<Record<string, number>>,
        sprint: ShipsSprinting
    ): boolean {
        return (
            this.hasLore(playerId, Lore.SprinterDrives) &&
            sprint.fresh <= (arrived[sprint.from] ?? 0) &&
            this.canMove(
                playerId,
                sprint.from,
                sprint.path,
                { fresh: sprint.fresh, damaged: 0 },
                sprint.dropOffs
            )
        )
    }

    // The fresh ships a move left in each system it passed through or ended in.
    static freshArrivals(
        path: readonly SystemId[],
        moving: ShipsMoving,
        dropOffs: readonly ShipsMoving[]
    ): Record<string, number> {
        const arrived: Record<string, number> = {}
        let left = moving.fresh
        for (const [step, drop] of dropOffs.entries()) {
            arrived[path[step]] = (arrived[path[step]] ?? 0) + drop.fresh
            left -= drop.fresh
        }
        const last = path[path.length - 1]
        arrived[last] = (arrived[last] ?? 0) + left
        return arrived
    }

    // A move, with Sprinter Drives' second move if any.
    canMoveWithSprint(playerId: string, move: ShipsMove, sprint?: ShipsSprinting): boolean {
        const moving = { fresh: move.fresh, damaged: move.damaged }
        if (!this.canMove(playerId, move.from, move.path, moving, move.dropOffs)) {
            return false
        }
        if (sprint === undefined) {
            return true
        }
        const arrived = HydratedArcsGameState.freshArrivals(move.path, moving, move.dropOffs)
        return this.wouldSucceed((copy) => {
            copy.move(playerId, move.from, move.path, moving, move.dropOffs)
            assert(copy.canSprint(playerId, arrived, sprint), 'Cannot sprint so')
        })
    }

    moveWithSprint(
        playerId: string,
        move: ShipsMove,
        sprint?: ShipsSprinting
    ): Record<string, number> {
        assert(this.canMoveWithSprint(playerId, move, sprint), `${playerId} cannot move so`)
        const moving = { fresh: move.fresh, damaged: move.damaged }
        const captured = this.move(playerId, move.from, move.path, moving, move.dropOffs)
        if (sprint !== undefined) {
            const more = this.move(
                playerId,
                sprint.from,
                sprint.path,
                { fresh: sprint.fresh, damaged: 0 },
                sprint.dropOffs
            )
            for (const [capturer, count] of Object.entries(more)) {
                captured[capturer] = (captured[capturer] ?? 0) + count
            }
        }
        return captured
    }

    // Repair a damaged Loyal ship or building anywhere (rule 7.4).
    canRepairShip(playerId: string, id: SystemId): boolean {
        return shipsOf(this.system(id), playerId).damaged > 0
    }

    repairShip(playerId: string, id: SystemId) {
        assert(this.canRepairShip(playerId, id), `${playerId} has no damaged ship in ${id}`)
        this.removeShips(id, playerId, 0, 1)
        this.addShips(id, playerId, 1)
    }

    canRepairBuilding(playerId: string, id: SystemId, slot: number): boolean {
        const building = this.buildingAt(id, slot)
        return building?.owner === playerId && building.damaged
    }

    repairBuilding(playerId: string, id: SystemId, slot: number) {
        assert(
            this.canRepairBuilding(playerId, id, slot),
            `Nothing of ${playerId}'s to repair there`
        )
        this.building(id, slot).damaged = false
    }

    // ----- The Court -----

    courtSlot(cardId: string): CourtSlot {
        const slot = this.court.find((candidate) => candidate.cardId === cardId)
        assertExists(slot, `${cardId} is not in the Court`)
        return slot
    }

    canInfluence(playerId: string, cardId: string): boolean {
        return (
            this.court.some((slot) => slot.cardId === cardId) &&
            this.getPlayerState(playerId).agents > 0
        )
    }

    influence(playerId: string, cardId: string) {
        assert(this.canInfluence(playerId, cardId), `${playerId} cannot influence ${cardId}`)
        this.getPlayerState(playerId).agents -= 1
        const slot = this.courtSlot(cardId)
        slot.agents[playerId] = (slot.agents[playerId] ?? 0) + 1
    }

    // More Loyal agents on the card than each Rival has (rule 7.6.1.1).
    canSecure(playerId: string, cardId: string, vox?: VoxChoice): boolean {
        const slot = this.court.find((candidate) => candidate.cardId === cardId)
        if (!slot) {
            return false
        }
        const own = slot.agents[playerId] ?? 0
        return (
            own > 0 &&
            Object.entries(slot.agents).every(
                ([owner, count]) => owner === playerId || count < own
            ) &&
            this.canChooseWhenSecured(playerId, cardId, vox) &&
            // Demagogue, Paranoid: not a Guild card with only 1 Loyal agent.
            !(this.isLeader(playerId, Leader.Demagogue) && !isVox(cardId) && own === 1)
        )
    }

    // Choices for a Vox card's When Secured action; other cards take none.
    canChooseWhenSecured(playerId: string, cardId: string, vox?: VoxChoice): boolean {
        return isVox(cardId) ? canResolveVox(this, playerId, cardId, vox) : vox === undefined
    }

    // Takes the card, returning the player's agents and capturing Rivals'. The card's When
    // Secured action is the caller's to resolve; the Court refills from the deck.
    secure(playerId: string, cardId: string, vox?: VoxChoice): SecuredCard {
        assert(this.canSecure(playerId, cardId, vox), `${playerId} cannot secure ${cardId}`)
        return this.takeCourtCard(playerId, cardId, 'captives', vox)
    }

    // Step 1 takes the card and the agents on it, step 2 resolves a Vox card's When Secured action,
    // step 3 refills the Court (rule 7.6.1).
    takeCourtCard(
        playerId: string,
        cardId: string,
        rivalAgentsBecome: 'captives' | 'trophies',
        vox?: VoxChoice
    ): SecuredCard {
        const slot = this.courtSlot(cardId)
        const player = this.getPlayerState(playerId)
        const taken: Record<string, number> = {}
        for (const [owner, count] of Object.entries(slot.agents)) {
            if (owner === playerId) {
                player.agents += count
            } else if (rivalAgentsBecome === 'captives') {
                player.capture(owner, count)
                taken[owner] = count
            } else {
                for (let index = 0; index < count; index++) {
                    player.trophies.push({ owner, kind: TrophyKind.Agent })
                }
                taken[owner] = count
            }
        }
        const card = CourtCards.find((candidate) => candidate.id === cardId)
        assertExists(card, `Unknown Court card ${cardId}`)
        if (this.turn?.prelude) {
            this.turn.securedInPrelude.push(cardId)
        }
        const result: SecuredCard = { taken }
        if (card.kind === 'guild') {
            player.guildCards.push(cardId)
        } else {
            result.vox = resolveVox(this, playerId, cardId, vox)
        }
        const index = this.court.indexOf(slot)
        if (this.courtDeck.count() > 0) {
            this.court[index] = { cardId: this.courtDeck.draw(), agents: {} }
        } else {
            this.court.splice(index, 1)
        }
        return result
    }

    // ----- Battle -----

    // The Rivals with pieces in a system, who can be chosen as defender (rule 7.7.1.2).
    defendersIn(playerId: string, id: SystemId): string[] {
        return this.turnManager.turnOrder.filter(
            (owner) => owner !== playerId && this.hasLoyalPiece(id, owner)
        )
    }

    // Raid dice need defending buildings, or a defender with no buildings anywhere (rule 7.7.1.3.1).
    // Raid dice need defending buildings, or a defender with no buildings anywhere (rule
    // 7.7.1.3.1); Raider Exosuits allow 1 without defending buildings; a defender with Hidden
    // Harbors and a fresh starport there allows none.
    raidDiceLimit(attacker: string, id: SystemId, defender: string): number {
        const owns = (system: SystemState) =>
            buildingsIn(system).some((building) => building.owner === defender)
        const defending = buildingsIn(this.system(id)).filter(
            (building) => building.owner === defender
        )
        if (
            this.hasLore(defender, Lore.HiddenHarbors) &&
            defending.some(
                (building) => building.kind === BuildingKind.Starport && !building.damaged
            )
        ) {
            return 0
        }
        if (defending.length > 0 || !this.systems.some(owns)) {
            return DiceOfEachKind
        }
        return this.hasLore(attacker, Lore.RaiderExosuits) ? 1 : 0
    }

    // Choosing where and whom to battle (rule 7.7.1 steps 1–2). A defender with Railgun Arrays
    // and a fresh ship there makes the attacker name the ship that takes its hit. The dice come
    // with it, unless the defender may first move ships in with Predictive Sensors.
    canBattle(
        playerId: string,
        id: SystemId,
        defender: string,
        dice?: Readonly<Record<Die, number>>,
        railgun?: RailgunHit
    ): boolean {
        if (!this.inPlay(id) || !this.defendersIn(playerId, id).includes(defender)) {
            return false
        }
        const ships = shipsOf(this.system(id), playerId)
        if (ships.fresh + ships.damaged === 0) {
            return false
        }
        if (this.railgunApplies(id, defender)) {
            const target = railgun === RailgunHit.Fresh ? ships.fresh : ships.damaged
            if (railgun === undefined || target === 0) {
                return false
            }
        } else if (railgun !== undefined) {
            return false
        }
        if (this.sensorsApply(id, defender)) {
            return dice === undefined
        }
        const left = ships.fresh + ships.damaged - (railgun === RailgunHit.Damaged ? 1 : 0)
        return (
            dice !== undefined &&
            (left === 0 || this.canCollectDice(playerId, id, defender, dice, left))
        )
    }

    railgunApplies(id: SystemId, defender: string): boolean {
        return (
            this.hasLore(defender, Lore.RailgunArrays) &&
            shipsOf(this.system(id), defender).fresh > 0
        )
    }

    sensorsApply(id: SystemId, defender: string): boolean {
        return (
            this.hasLore(defender, Lore.PredictiveSensors) &&
            this.adjacent(id).some((adjacent) => shipsOf(this.system(adjacent), defender).fresh > 0)
        )
    }

    // Up to one die per attacking ship (rule 7.7.1.3), as cards change it.
    canCollectDice(
        playerId: string,
        id: SystemId,
        defender: string,
        dice: Readonly<Record<Die, number>>,
        shipCount: number = shipsOf(this.system(id), playerId).fresh +
            shipsOf(this.system(id), playerId).damaged
    ): boolean {
        const counts = Object.values(Die).map((die) => dice[die])
        const total = counts.reduce((sum, count) => sum + count, 0)
        // Gatekeepers collect 2 more dice in a gate. The Rebel, Committed, must collect 2 more.
        const gatekeepers = isGate(id) && this.holds(playerId, Court.Gatekeepers) ? 2 : 0
        const committed = this.isLeader(playerId, Leader.Rebel) ? 2 : 0
        // Corsair, Wary: no more assault dice than skirmish dice.
        const wary =
            !this.isLeader(playerId, Leader.Corsair) || dice[Die.Assault] <= dice[Die.Skirmish]
        return (
            counts.every((count) => count >= 0 && count <= DiceOfEachKind) &&
            wary &&
            total >= Math.max(1, committed) &&
            total <= shipCount + gatekeepers + committed &&
            dice[Die.Raid] <= this.raidDiceLimit(playerId, id, defender)
        )
    }

    // Rolls the dice and counts what the attacker must resolve. Intercepts hit once per fresh
    // defending ship, however many dice show it (rule 7.7.1.4).
    // Starts the battle: Railgun Arrays' hit, then Predictive Sensors' step or the roll.
    startBattle(
        playerId: string,
        id: SystemId,
        defender: string,
        dice?: Readonly<Record<Die, number>>,
        railgun?: RailgunHit
    ): BattleState {
        assert(
            this.canBattle(playerId, id, defender, dice, railgun),
            `${playerId} cannot battle so`
        )
        const battle: BattleState = {
            attacker: playerId,
            defender,
            system: id,
            rolled: [],
            attackerHits: 0,
            hits: 0,
            buildingHits: 0,
            keys: 0,
            step: BattleStep.Dice,
            rifles: false,
            trophiesTaken: false,
            allFresh: shipsOf(this.system(id), playerId).damaged === 0,
            rerolls: noRerolls(),
            ransacks: 0
        }
        this.battle = battle
        if (railgun !== undefined) {
            const fresh = railgun === RailgunHit.Fresh
            this.hitShipsIn(id, playerId, { damage: fresh ? 1 : 0, destroy: fresh ? 0 : 1 })
            if (!fresh) {
                this.getPlayerState(defender).trophies.push({
                    owner: playerId,
                    kind: TrophyKind.Ship
                })
            }
        }
        const ships = shipsOf(this.system(id), playerId)
        if (ships.fresh + ships.damaged === 0) {
            this.finishBattle()
        } else if (this.sensorsApply(id, defender)) {
            battle.step = BattleStep.Sensors
        } else if (dice !== undefined) {
            this.rollBattleDice(playerId, dice)
        }
        return battle
    }

    canMoveInBySensors(playerId: string, moves: readonly SensorsMove[]): boolean {
        const battle = this.battle
        if (battle?.step !== BattleStep.Sensors || battle.defender !== playerId) {
            return false
        }
        const froms = moves.map((move) => move.from)
        return (
            new Set(froms).size === froms.length &&
            moves.every(
                (move) =>
                    this.adjacent(battle.system).includes(move.from) &&
                    move.fresh <= shipsOf(this.system(move.from), playerId).fresh &&
                    // Rebel, Disorganized: at most 2 ships from each system.
                    (!this.isLeader(playerId, Leader.Rebel) || move.fresh <= 2)
            )
        )
    }

    // Predictive Sensors: fresh defending ships move in from adjacent systems.
    moveInBySensors(playerId: string, moves: readonly SensorsMove[]) {
        assert(this.canMoveInBySensors(playerId, moves), `${playerId} cannot move in so`)
        const battle = this.currentBattle()
        for (const move of moves) {
            this.removeShips(move.from, playerId, move.fresh, 0)
            this.addShips(battle.system, playerId, move.fresh)
        }
        battle.step = BattleStep.Dice
    }

    canRollBattleDice(playerId: string, dice: Readonly<Record<Die, number>>): boolean {
        const battle = this.battle
        return (
            battle?.step === BattleStep.Dice &&
            battle.attacker === playerId &&
            this.canCollectDice(playerId, battle.system, battle.defender, dice)
        )
    }

    // Rolls the dice and counts what the attacker must resolve. Intercepts hit once per fresh
    // defending ship, however many dice show it (rule 7.7.1.4).
    rollBattleDice(playerId: string, dice: Readonly<Record<Die, number>>): RolledDie[] {
        assert(this.canRollBattleDice(playerId, dice), `${playerId} cannot roll those dice`)
        const battle = this.currentBattle()
        const random = this.getProtectedPrng().random
        battle.rolled = Object.values(Die).flatMap((die) =>
            Array.from({ length: dice[die] }, () => rollDie(die, random))
        )
        battle.rerolls = this.rerollAllowance(playerId, battle.system, dice)
        battle.step = BattleStep.Hits
        this.tallyRoll()
        return battle.rolled
    }

    // Galactic Rifles: skirmish dice for the fresh Loyal ships in a system, rolled at a defender
    // in an adjacent one.
    canFireRifles(playerId: string, from: SystemId, target: SystemId, defender: string): boolean {
        return (
            this.hasLore(playerId, Lore.GalacticRifles) &&
            this.inPlay(from) &&
            shipsOf(this.system(from), playerId).fresh > 0 &&
            this.adjacent(from).includes(target) &&
            this.defendersIn(playerId, target).includes(defender)
        )
    }

    fireRifles(playerId: string, from: SystemId, target: SystemId, defender: string): RolledDie[] {
        assert(this.canFireRifles(playerId, from, target, defender), `${playerId} cannot fire so`)
        const count = Math.min(DiceOfEachKind, shipsOf(this.system(from), playerId).fresh)
        const random = this.getProtectedPrng().random
        const dice = { ...noRerolls(), [Die.Skirmish]: count }
        const battle: BattleState = {
            attacker: playerId,
            defender,
            system: target,
            rolled: Array.from({ length: count }, () => rollDie(Die.Skirmish, random)),
            attackerHits: 0,
            hits: 0,
            buildingHits: 0,
            keys: 0,
            step: BattleStep.Hits,
            rifles: true,
            trophiesTaken: false,
            allFresh: false,
            // Only Empath's Vision rerolls, since it works on any roll.
            rerolls:
                this.hasLore(playerId, Lore.EmpathsVision) && this.isDeclared(Ambition.Empath)
                    ? dice
                    : noRerolls(),
            ransacks: 0
        }
        this.battle = battle
        this.tallyRoll()
        return battle.rolled
    }

    // Counts what the roll makes the attacker resolve, skipping to raiding when nothing is hit
    // and nothing can be rerolled.
    tallyRoll() {
        const battle = this.currentBattle()
        const { rolled } = battle
        // Signal Breaker ignores one rolled intercept if every attacking ship began fresh; Mirror
        // Plating adds one, not rolled, against any assault dice.
        const ignored = battle.allFresh && this.hasLore(battle.attacker, Lore.SignalBreaker) ? 1 : 0
        const mirrored =
            this.hasLore(battle.defender, Lore.MirrorPlating) &&
            rolled.some((rolledDie) => rolledDie.die === Die.Assault)
        const intercepted = symbolsRolled(rolled, DieSymbol.Intercept) - ignored > 0 || mirrored
        const intercepts = !intercepted
            ? 0
            : // Agitator, Irregular: one hit per Weapon icon instead.
              this.isLeader(battle.defender, Leader.Agitator)
              ? this.weaponIcons(battle.defender)
              : shipsOf(this.system(battle.system), battle.defender).fresh
        battle.attackerHits = symbolsRolled(rolled, DieSymbol.SelfHit) + intercepts
        battle.hits = symbolsRolled(rolled, DieSymbol.Hit)
        battle.buildingHits = symbolsRolled(rolled, DieSymbol.BuildingHit)
        battle.keys = symbolsRolled(rolled, DieSymbol.Key)
        if (
            !anyRerolls(battle.rerolls) &&
            battle.attackerHits + battle.hits + battle.buildingHits === 0
        ) {
            this.advanceBattle()
        }
    }

    // Weapon resources plus Weapon Guild cards.
    weaponIcons(playerId: string): number {
        const player = this.getPlayerState(playerId)
        return (
            player.resourceCount(Resource.Weapon) +
            player.guildCards.filter(
                (cardId) => CourtCards.find((card) => card.id === cardId)?.suit === Resource.Weapon
            ).length
        )
    }

    // How many dice of each kind the attacker may reroll: Skirmishers' skirmish dice up to the
    // Weapon icons, the Corsair's raid dice up to the kinds of resource held (Tricky), Seeker
    // Torpedoes' assault dice up to the fresh attacking ships, and with Empath's Vision while
    // Empath is declared, any.
    rerollAllowance(
        playerId: string,
        id: SystemId,
        dice: Readonly<Record<Die, number>>
    ): Record<Die, number> {
        const allowance = noRerolls()
        if (this.hasLore(playerId, Lore.EmpathsVision) && this.isDeclared(Ambition.Empath)) {
            return { ...dice }
        }
        if (this.holds(playerId, Court.Skirmishers)) {
            allowance[Die.Skirmish] = this.weaponIcons(playerId)
        }
        if (this.isLeader(playerId, Leader.Corsair)) {
            const kinds = new Set(this.getPlayerState(playerId).resources.filter((held) => held))
            allowance[Die.Raid] = kinds.size
        }
        if (this.hasLore(playerId, Lore.SeekerTorpedoes)) {
            allowance[Die.Assault] = shipsOf(this.system(id), playerId).fresh
        }
        for (const die of Object.values(Die)) {
            allowance[die] = Math.min(allowance[die], dice[die])
        }
        return allowance
    }

    isDeclared(ambition: Ambition): boolean {
        return this.ambitionMarkers.some((marker) => marker.ambition === ambition)
    }

    canReroll(playerId: string, dice: readonly number[]): boolean {
        const battle = this.battle
        if (battle?.step !== BattleStep.Hits || battle.attacker !== playerId) {
            return false
        }
        const rerolling = noRerolls()
        for (const index of dice) {
            const rolled = battle.rolled[index]
            if (!rolled) {
                return false
            }
            rerolling[rolled.die] += 1
        }
        return (
            dice.length > 0 &&
            new Set(dice).size === dice.length &&
            Object.values(Die).every((die) => rerolling[die] <= battle.rerolls[die])
        )
    }

    // Skirmishers: reroll some skirmish dice, once (rule 8.3).
    reroll(playerId: string, dice: readonly number[]): RolledDie[] {
        assert(this.canReroll(playerId, dice), `${playerId} cannot reroll those dice`)
        const battle = this.currentBattle()
        const random = this.getProtectedPrng().random
        for (const index of dice) {
            battle.rolled[index] = rollDie(battle.rolled[index].die, random)
        }
        battle.rerolls = noRerolls()
        this.tallyRoll()
        return battle.rolled
    }

    currentBattle(): BattleState {
        assertExists(this.battle, 'No battle is in progress')
        return this.battle
    }

    // The defender's buildings in the battle system, by slot.
    defendingBuildings(): { slot: number; building: Building }[] {
        const battle = this.currentBattle()
        return this.buildingSlots(battle.system).flatMap((building, slot) =>
            building?.owner === battle.defender ? [{ slot, building }] : []
        )
    }

    // Hits the defending ships can't take go to their buildings, with the building hits.
    buildingHitsToAssign(): number {
        const battle = this.currentBattle()
        const capacity = shipHitCapacity(shipsOf(this.system(battle.system), battle.defender))
        return battle.buildingHits + Math.max(0, battle.hits - capacity)
    }

    // Every hit must be taken while there are pieces left to take it (rule 7.7.1.4).
    canAssignHits(
        playerId: string,
        attacking: ShipHits,
        defending: ShipHits,
        buildings: readonly BuildingHits[]
    ): boolean {
        const battle = this.battle
        if (battle?.step !== BattleStep.Hits || battle.attacker !== playerId) {
            return false
        }
        const system = this.system(battle.system)
        const takes = (ships: ShipCount, hits: ShipHits, owed: number) =>
            hitShips(ships, hits)?.used === Math.min(owed, shipHitCapacity(ships))
        if (
            !takes(shipsOf(system, playerId), attacking, battle.attackerHits) ||
            !takes(shipsOf(system, battle.defender), defending, battle.hits)
        ) {
            return false
        }
        const targets = this.defendingBuildings()
        const capacity = (building: Building) => (building.damaged ? 1 : 2)
        const slots = buildings.map((hit) => hit.slot)
        if (new Set(slots).size !== slots.length) {
            return false
        }
        for (const hit of buildings) {
            const target = targets.find((candidate) => candidate.slot === hit.slot)
            if (!target || hit.hits > capacity(target.building)) {
                return false
            }
        }
        const total = buildings.reduce((sum, hit) => sum + hit.hits, 0)
        const room = targets.reduce((sum, target) => sum + capacity(target.building), 0)
        return total === Math.min(this.buildingHitsToAssign(), room)
    }

    // Damages and destroys the hit pieces. Destroyed pieces become the other side's Trophies, and
    // each city destroyed Provokes Outrage and is owed a Ransack (rules 7.7.2–7.7.4).
    assignHits(
        playerId: string,
        attacking: ShipHits,
        defending: ShipHits,
        buildings: readonly BuildingHits[]
    ): BattleDamage {
        assert(
            this.canAssignHits(playerId, attacking, defending, buildings),
            `${playerId} cannot assign hits so`
        )
        const battle = this.currentBattle()
        const { attacker, defender } = battle
        const id = battle.system
        const attackerTrophies = this.getPlayerState(attacker).trophies
        const defenderTrophies = this.getPlayerState(defender).trophies
        this.hitShipsIn(id, attacker, attacking)
        this.hitShipsIn(id, defender, defending)
        for (let index = 0; index < attacking.destroy; index++) {
            defenderTrophies.push({ owner: attacker, kind: TrophyKind.Ship })
        }
        for (let index = 0; index < defending.destroy; index++) {
            attackerTrophies.push({ owner: defender, kind: TrophyKind.Ship })
        }
        const destroyedBuildings: BuildingKind[] = []
        const outraged: Resource[] = []
        for (const hit of buildings) {
            const building = this.building(id, hit.slot)
            if (building.damaged || hit.hits === 2) {
                this.setBuildingAt(id, hit.slot, null)
                destroyedBuildings.push(building.kind)
                if (building.kind === BuildingKind.City) {
                    attackerTrophies.push({ owner: defender, kind: TrophyKind.City })
                    outraged.push(...this.destroyCity(attacker, id))
                    // Rivals cannot Ransack the Court when they battle the Elder, Beloved.
                    if (battle.rifles || !this.isLeader(defender, Leader.Elder)) {
                        battle.ransacks += 1
                    }
                } else {
                    attackerTrophies.push({ owner: defender, kind: TrophyKind.Starport })
                }
            } else {
                building.damaged = true
            }
        }
        // The Agitator discards a Weapon after an intercept.
        if (
            this.isLeader(defender, Leader.Agitator) &&
            symbolsRolled(battle.rolled, DieSymbol.Intercept) > 0
        ) {
            const agitator = this.getPlayerState(defender)
            if (agitator.resourceCount(Resource.Weapon) > 0) {
                agitator.removeResource(Resource.Weapon)
                this.supply[Resource.Weapon] += 1
            }
        }
        battle.trophiesTaken ||= defending.destroy > 0 || destroyedBuildings.length > 0
        if (battle.rifles) {
            battle.keys = 0
        }
        battle.attackerHits = 0
        battle.hits = 0
        battle.buildingHits = 0
        battle.rerolls = noRerolls()
        this.advanceBattle()
        return {
            attackerShipsDestroyed: attacking.destroy,
            defenderShipsDestroyed: defending.destroy,
            buildingsDestroyed: destroyedBuildings,
            outraged
        }
    }

    private hitShipsIn(id: SystemId, owner: string, hits: ShipHits) {
        const system = this.system(id)
        const result = hitShips(shipsOf(system, owner), hits)
        assertExists(result, `${owner}'s ships in ${id} cannot take those hits`)
        if (result.left.fresh + result.left.damaged === 0) {
            delete system.ships[owner]
        } else {
            system.ships[owner] = result.left
        }
    }

    // Rule 7.7.4.1: whoever destroys a city discards their resources and Guild cards of its planet
    // type and is Outraged by it; a Gate Station city Outrages every type it has. Returns them.
    destroyCity(destroyer: string, id: SystemId): Resource[] {
        const types = this.cityTypes(id)
        for (const resource of types) {
            this.provokeOutrage(destroyer, resource)
        }
        return types
    }

    provokeOutrage(playerId: string, resource: Resource) {
        const player = this.getPlayerState(playerId)
        for (const [slot, held] of player.resources.entries()) {
            if (held === resource) {
                player.resources[slot] = null
                this.supply[resource] += 1
            }
        }
        // Loyal cards are kept.
        const loyal: string[] = Object.values(LoyalCards)
        const discarded = player.guildCards.filter(
            (cardId) =>
                !loyal.includes(cardId) &&
                CourtCards.find((card) => card.id === cardId)?.suit === resource
        )
        player.guildCards = player.guildCards.filter((cardId) => !discarded.includes(cardId))
        this.courtDiscard.push(...discarded)
        if (!player.outrage.includes(resource)) {
            player.outrage.push(resource)
            // With no agent in supply a placeholder covers the slot (rule 22.3.1).
            if (player.agents > 0) {
                player.agents -= 1
            }
        }
    }

    // Court cards with any of the defender's agents, which a Ransack can secure (rule 7.7.4.2).
    ransackableCards(defender: string = this.currentBattle().defender): string[] {
        return this.court
            .filter((slot) => (slot.agents[defender] ?? 0) > 0)
            .map((slot) => slot.cardId)
    }

    canRansack(playerId: string, cardId: string, vox?: VoxChoice): boolean {
        const battle = this.battle
        return (
            battle?.step === BattleStep.Ransack &&
            battle.attacker === playerId &&
            this.ransackableCards().includes(cardId) &&
            this.canChooseWhenSecured(playerId, cardId, vox)
        )
    }

    // Secures the card; every Rival agent on it becomes the attacker's Trophy.
    ransack(playerId: string, cardId: string, vox?: VoxChoice): SecuredCard {
        assert(this.canRansack(playerId, cardId, vox), `${playerId} cannot ransack ${cardId}`)
        const taken = this.takeCourtCard(playerId, cardId, 'trophies', vox)
        this.currentBattle().ransacks -= 1
        this.advanceBattle()
        return taken
    }

    // The keys a raid on this target costs, if the defender has it: a resource slot or a Guild
    // card (rule 7.7.5).
    raidCost(target: RaidTarget): number | undefined {
        const battle = this.currentBattle()
        if (!this.canSteal(battle.attacker, { playerId: battle.defender, ...target })) {
            return undefined
        }
        if (target.slot !== undefined) {
            return slotRaidCost(target.slot)
        }
        return CourtCards.find((card) => card.id === target.cardId)?.raidCost
    }

    // Raiding needs an attacking ship left and enough keys for something.
    canRaidAnything(): boolean {
        const battle = this.currentBattle()
        const ships = shipsOf(this.system(battle.system), battle.attacker)
        if (ships.fresh + ships.damaged === 0) {
            return false
        }
        const defender = this.getPlayerState(battle.defender)
        const targets: RaidTarget[] = [
            ...defender.resources.map((_, slot) => ({ slot })),
            ...defender.guildCards.map((cardId) => ({ cardId }))
        ]
        return targets.some((target) => {
            const cost = this.raidCost(target)
            return cost !== undefined && cost <= battle.keys
        })
    }

    canRaid(playerId: string, target: RaidTarget, discard?: Resource): boolean {
        const battle = this.battle
        if (battle?.step !== BattleStep.Raid || battle.attacker !== playerId) {
            return false
        }
        const cost = this.raidCost(target)
        return (
            cost !== undefined &&
            cost <= battle.keys &&
            this.canStealAndGain(playerId, { playerId: battle.defender, ...target }, discard)
        )
    }

    // Steals one resource or Guild card. A stolen resource goes into an empty slot; with none
    // open, the attacker discards a resource, possibly the stolen one (rule 9.2.1).
    raid(playerId: string, target: RaidTarget, discard?: Resource): RaidResult {
        assert(this.canRaid(playerId, target, discard), `${playerId} cannot raid that`)
        const battle = this.currentBattle()
        battle.keys -= this.raidCost(target) ?? 0
        const result = this.stealAndGain(
            playerId,
            { playerId: battle.defender, ...target },
            discard
        )
        this.advanceBattle()
        return result
    }

    canEndBattle(playerId: string): boolean {
        return this.battle?.step === BattleStep.Raid && this.battle.attacker === playerId
    }

    // Moves the battle to its next step that has a choice to make, or ends it.
    advanceBattle() {
        const battle = this.currentBattle()
        if (battle.ransacks > 0 && this.ransackableCards().length > 0) {
            battle.step = BattleStep.Ransack
            return
        }
        battle.ransacks = 0
        if (battle.keys > 0 && this.canRaidAnything()) {
            battle.step = BattleStep.Raid
            return
        }
        this.finishBattle()
    }

    endBattle(playerId: string) {
        assert(this.canEndBattle(playerId), `${playerId} has no battle to end`)
        this.finishBattle()
    }

    // What happens after a battle: repairs, then the Elder's chance to influence.
    finishBattle() {
        const battle = this.currentBattle()
        if (battle.rifles) {
            this.battle = undefined
            return
        }
        const { attacker, defender, system } = battle
        // Repair Drones repair 1 attacking ship.
        if (this.hasLore(attacker, Lore.RepairDrones)) {
            this.repairShipsIn(system, attacker, 1)
        }
        // Quartermaster, Resilient: 1 repair per starport they control on the map.
        for (const playerId of [attacker, defender]) {
            if (this.isLeader(playerId, Leader.Quartermaster)) {
                this.repairShipsIn(system, playerId, this.starportsControlled(playerId))
            }
        }
        if (
            battle.trophiesTaken &&
            this.isLeader(defender, Leader.Elder) &&
            this.getPlayerState(defender).agents > 0 &&
            this.court.length > 0
        ) {
            battle.step = BattleStep.Beloved
            return
        }
        this.battle = undefined
    }

    repairShipsIn(id: SystemId, playerId: string, count: number) {
        const ships = shipsOf(this.system(id), playerId)
        const repaired = Math.min(count, ships.damaged)
        if (repaired > 0) {
            this.removeShips(id, playerId, 0, repaired)
            this.addShips(id, playerId, repaired)
        }
    }

    starportsControlled(playerId: string): number {
        return this.systems
            .filter((system) => this.controller(system.id) === playerId)
            .flatMap((system) => buildingsIn(system))
            .filter((building) => building.kind === BuildingKind.Starport).length
    }

    // The player whose choice the battle waits on.
    battleChooser(): string {
        const battle = this.currentBattle()
        return battle.step === BattleStep.Beloved || battle.step === BattleStep.Sensors
            ? battle.defender
            : battle.attacker
    }

    canBelovedInfluence(playerId: string, cardId?: string): boolean {
        const battle = this.battle
        return (
            battle?.step === BattleStep.Beloved &&
            battle.defender === playerId &&
            (cardId === undefined || this.canInfluence(playerId, cardId))
        )
    }

    belovedInfluence(playerId: string, cardId?: string) {
        assert(this.canBelovedInfluence(playerId, cardId), `${playerId} cannot influence now`)
        if (cardId !== undefined) {
            this.influence(playerId, cardId)
        }
        this.battle = undefined
    }

    // ----- Court card Prelude actions that draw -----

    canUseFarseers(playerId: string, discards: readonly string[]): boolean {
        const turn = this.turn
        if (
            this.machineState !== MachineState.TakingActions ||
            turn?.playerId !== playerId ||
            !turn.prelude ||
            !this.holds(playerId, Court.Farseers) ||
            turn.securedInPrelude.includes(Court.Farseers)
        ) {
            return false
        }
        const hand = [...(this.getPlayerState(playerId).hand ?? [])]
        return discards.every((cardId) => {
            const index = hand.indexOf(cardId)
            if (index >= 0) {
                hand.splice(index, 1)
            }
            return index >= 0
        })
    }

    // The discarded cards go shuffled onto the action discard pile before the draw, so a small
    // pile can give them back. Returns how many cards were drawn.
    useFarseers(playerId: string, discards: readonly string[]): number {
        assert(this.canUseFarseers(playerId, discards), `${playerId} cannot use Farseers so`)
        this.currentTurn().acted = true
        const player = this.getPlayerState(playerId)
        player.guildCards = player.guildCards.filter((cardId) => cardId !== Court.Farseers)
        this.courtDiscard.push(Court.Farseers)
        for (const cardId of discards) {
            player.removeFromHand(cardId)
        }
        const shuffled = [...discards]
        shuffle(shuffled, this.getProtectedPrng().random)
        this.actionDiscard.putOnTop(shuffled)
        const drawn = this.actionDiscard.drawFromBottom(discards.length + 1)
        player.takeIntoHand(drawn)
        return drawn.length
    }

    // ----- Stealing -----

    // A Rival's resource or Guild card. Sworn Guardians protect all their holder's others.
    canSteal(thief: string, target: StealTarget): boolean {
        if (target.playerId === thief || !this.turnManager.turnOrder.includes(target.playerId)) {
            return false
        }
        if ((target.slot === undefined) === (target.cardId === undefined)) {
            return false
        }
        const victim = this.getPlayerState(target.playerId)
        if (
            victim.guildCards.includes(Court.SwornGuardians) &&
            target.cardId !== Court.SwornGuardians
        ) {
            return false
        }
        const keeper = this.isDeclared(Ambition.Keeper)
        if (target.slot !== undefined) {
            const resource = victim.resources[target.slot] ?? null
            // Keeper's Trust: not a resource the thief already has.
            return (
                resource !== null &&
                !(
                    keeper &&
                    this.hasLore(target.playerId, Lore.KeepersTrust) &&
                    this.resourcesHeld(thief, resource) > 0
                )
            )
        }
        const cardId = target.cardId
        if (cardId === undefined || !victim.guildCards.includes(cardId)) {
            return false
        }
        // Keeper's Solidarity: not a Guild card while its holder has resources of its suit.
        const suit = CourtCards.find((card) => card.id === cardId)?.suit
        return !(
            keeper &&
            suit !== undefined &&
            this.hasLore(target.playerId, Lore.KeepersSolidarity) &&
            this.resourcesHeld(target.playerId, suit) > 0
        )
    }

    // Resources a player has: in their slots, and a Cartel's supply.
    resourcesHeld(playerId: string, resource: Resource): number {
        const cartel = this.cartelHolder(resource) === playerId ? this.supply[resource] : 0
        return this.getPlayerState(playerId).resourceCount(resource) + cartel
    }

    // Takes it from the Rival. A stolen Guild card joins the thief's, except that stolen Sworn
    // Guardians are buried; a stolen resource is returned for the thief to gain.
    steal(thief: string, target: StealTarget): { resource?: Resource; cardId?: string } {
        assert(this.canSteal(thief, target), `${thief} cannot steal that`)
        const victim = this.getPlayerState(target.playerId)
        if (target.slot !== undefined) {
            const resource = victim.resources[target.slot]
            assertExists(resource, 'The slot holds a resource')
            victim.resources[target.slot] = null
            return { resource }
        }
        const cardId = target.cardId
        assertExists(cardId, 'A Guild card is named')
        victim.guildCards = victim.guildCards.filter((held) => held !== cardId)
        if (cardId === Court.SwornGuardians) {
            this.courtDeck.putOnBottom(cardId)
        } else {
            this.getPlayerState(thief).guildCards.push(cardId)
        }
        return { cardId }
    }

    // Whether the thief can steal this and hold it, discarding `discard` if their slots are full.
    canStealAndGain(thief: string, target: StealTarget, discard?: Resource): boolean {
        if (!this.canSteal(thief, target)) {
            return false
        }
        if (target.slot === undefined) {
            return discard === undefined
        }
        const resource = this.getPlayerState(target.playerId).resources[target.slot]
        return resource !== null && this.getPlayerState(thief).canGain(resource, discard)
    }

    stealAndGain(thief: string, target: StealTarget, discard?: Resource): RaidResult {
        assert(this.canStealAndGain(thief, target, discard), `${thief} cannot steal that`)
        const stolen = this.steal(thief, target)
        const result: RaidResult = { ...stolen }
        if (stolen.resource !== undefined) {
            const discarded = this.getPlayerState(thief).gain(stolen.resource, discard)
            if (discarded !== undefined) {
                this.supply[discarded] += 1
                result.discarded = discarded
            }
        }
        return result
    }

    // ----- Elimination -----

    // A player with no ships or starports on the map (rule 22.2.1).
    isEliminated(playerId: string): boolean {
        return this.systems.every(
            (system) =>
                shipsOf(system, playerId).fresh + shipsOf(system, playerId).damaged === 0 &&
                !buildingsIn(system).some(
                    (building) =>
                        building.owner === playerId && building.kind === BuildingKind.Starport
                )
        )
    }

    canReturnFleet(playerId: string, gate: SystemId): boolean {
        return this.isEliminated(playerId) && isGate(gate) && this.inPlay(gate)
    }

    // An eliminated player places 3 fresh ships at a gate at the end of their turn.
    returnFleet(playerId: string, gate: SystemId): number {
        assert(this.canReturnFleet(playerId, gate), `${playerId} cannot return to ${gate}`)
        let placed = 0
        while (placed < EliminatedFleet && this.placeShipFromSupply(gate, playerId)) {
            placed += 1
        }
        return placed
    }

    // ----- End of chapter -----

    // How much of an ambition's measure a player has (rule 6.2.1).
    ambitionCount(playerId: string, ambition: Ambition): number {
        if (playerId === AmbitionDummy) {
            return this.ambitionResources.filter((entry) => entry.ambition === ambition).length
        }
        const player = this.getPlayerState(playerId)
        const icons = (resources: readonly Resource[]) =>
            resources.reduce((total, resource) => total + player.resourceCount(resource), 0) +
            player.guildCards.filter((cardId) => {
                const suit = CourtCards.find((card) => card.id === cardId)?.suit
                return suit !== undefined && resources.includes(suit)
            }).length
        // A Cartel's supply adds to its holder's Tycoon.
        const cartels = [Resource.Material, Resource.Fuel]
            .filter((resource) => this.cartelHolder(resource) === playerId)
            .reduce((total, resource) => total + this.supply[resource], 0)
        switch (ambition) {
            case Ambition.Tycoon:
                return icons([Resource.Material, Resource.Fuel]) + cartels
            case Ambition.Tyrant:
                return player.captiveCount()
            case Ambition.Warlord:
                return player.trophies.length
            case Ambition.Keeper:
                return icons([Resource.Relic])
            case Ambition.Empath:
                return icons([Resource.Psionic])
        }
    }

    // First place takes the high value of every marker in the box, second place the low value;
    // ties for first all get second, ties for second get nothing, and nobody places without any
    // of the measure (rules 6.2.1.1–6.2.1.3).
    scoreAmbition(ambition: Ambition): AmbitionAward[] {
        const markers = this.ambitionMarkers
            .map((marker, index) => ({ marker, index }))
            .filter(({ marker }) => marker.ambition === ambition)
        if (markers.length === 0) {
            return []
        }
        const first = markers.reduce((total, { index }) => total + this.markerSide(index).first, 0)
        const second = markers.reduce(
            (total, { index }) => total + this.markerSide(index).second,
            0
        )
        const contenders = [
            ...this.turnManager.turnOrder,
            ...(this.ambitionResources.length > 0 ? [AmbitionDummy] : [])
        ]
            .map((playerId) => ({ playerId, count: this.ambitionCount(playerId, ambition) }))
            .filter((entry) => entry.count > 0)
            .sort((a, b) => b.count - a.count)
        const awards: AmbitionAward[] = []
        if (contenders.length === 0) {
            return awards
        }
        const top = contenders.filter((entry) => entry.count === contenders[0].count)
        if (top.length > 1) {
            for (const entry of top) {
                awards.push({ ambition, playerId: entry.playerId, place: 2, power: second })
            }
        } else {
            const winner = top[0].playerId
            const bonus =
                winner === AmbitionDummy
                    ? 0
                    : wonAmbitionBonus(this.getPlayerState(winner).citiesOnBoard)
            awards.push({ ambition, playerId: winner, place: 1, power: first + bonus })
            const rest = contenders.slice(1)
            const runnersUp = rest.filter((entry) => entry.count === rest[0]?.count)
            if (runnersUp.length === 1) {
                awards.push({ ambition, playerId: runnersUp[0].playerId, place: 2, power: second })
            }
        }
        return awards
            .filter((award) => award.playerId !== AmbitionDummy)
            .map((award) => this.leaderAdjustedAward(award, second))
    }

    // Elder, Warrior and Archivist score one ambition as if a place lower, without the city
    // bonus; the Noble, Proud, scores nothing for second place.
    private leaderAdjustedAward(award: AmbitionAward, second: number): AmbitionAward {
        const leader = this.getPlayerState(award.playerId).leader
        if (leader !== undefined && SecondPlaceOnly[leader] === award.ambition) {
            return { ...award, power: award.place === 1 ? second : 0 }
        }
        if (leader === Leader.Noble && award.place === 2) {
            return { ...award, power: 0 }
        }
        return award
    }

    scoreChapter(): AmbitionAward[] {
        const awards = Object.values(Ambition).flatMap((ambition) => this.scoreAmbition(ambition))
        for (const award of awards) {
            this.getPlayerState(award.playerId).power += award.power
        }
        return awards
    }

    // Rule 6.2.2: Trophies and Captives go home if their ambition was scored, the markers come
    // back, and the lowest-Power unflipped marker flips.
    cleanUpChapter() {
        const declared = new Set(this.ambitionMarkers.map((marker) => marker.ambition))
        if (declared.has(Ambition.Warlord)) {
            for (const player of this.players) {
                for (const trophy of player.trophies) {
                    this.returnPiece(trophy.owner, trophy.kind)
                }
                player.trophies = []
            }
        }
        if (declared.has(Ambition.Tyrant)) {
            for (const player of this.players) {
                for (const [owner, count] of Object.entries(player.captives)) {
                    this.getPlayerState(owner).agents += count
                }
                player.captives = {}
            }
        }
        for (const marker of this.ambitionMarkers) {
            marker.ambition = undefined
        }
        const unflipped = this.ambitionMarkers
            .map((marker, index) => ({ marker, index }))
            .filter(({ marker }) => !marker.flipped)
            .sort((a, b) => this.markerSide(a.index).first - this.markerSide(b.index).first)
        if (unflipped.length > 0) {
            this.ambitionMarkers[unflipped[0].index].flipped = true
        }
    }

    // Returns a piece to its owner's supply; a city goes back onto the player board, covering the
    // rightmost empty slot (rule 22.3.3).
    returnPiece(owner: string, kind: TrophyKind) {
        const player = this.getPlayerState(owner)
        switch (kind) {
            case TrophyKind.Ship:
                player.ships += 1
                break
            case TrophyKind.Agent:
                player.agents += 1
                break
            case TrophyKind.Starport:
                player.starports += 1
                break
            case TrophyKind.City: {
                player.citiesOnBoard += 1
                for (const resource of player.compactResources()) {
                    this.supply[resource] += 1
                }
                break
            }
        }
    }

    gameIsOver(): boolean {
        const target = PowerToWin[this.players.length]
        return this.chapter >= LastChapter || this.players.some((player) => player.power >= target)
    }

    // Most Power wins; ties go to the earliest in turn order from the initiative (rule 6.2.3.1).
    winner(): string {
        const order = this.turnManager.turnOrder
        const start = order.indexOf(this.initiative)
        const fromInitiative = [...order.slice(start), ...order.slice(0, start)]
        const best = Math.max(...this.players.map((player) => player.power))
        const winner = fromInitiative.find(
            (playerId) => this.getPlayerState(playerId).power === best
        )
        assertExists(winner, 'Nobody has the most Power')
        return winner
    }

    // Every action card back into one pile, shuffled; six to each player and the rest face down
    // (rule 6.2.4).
    gatherActionCards(): string[] {
        const cards = [...this.actionDiscard.takeAll(), ...this.faceUpDiscard]
        this.faceUpDiscard = []
        for (const player of this.players) {
            cards.push(...player.knownHand())
            player.hand = []
            player.handCount = 0
        }
        return cards
    }

    deal(cards: string[]) {
        for (const playerId of this.turnManager.turnOrder) {
            this.getPlayerState(playerId).takeIntoHand(cards.splice(0, StartingHandSize))
        }
        this.actionDiscard.putOnTop(cards)
    }

    // Shuffles every action card and deals new hands (rule 6.2.4).
    shuffleAndDeal() {
        const cards = this.gatherActionCards()
        shuffle(cards, this.getProtectedPrng().random)
        this.deal(cards)
    }

    // Two players: six new cards, then the old hand joins the shuffled face-down pile.
    redrawHand(playerId: string) {
        const player = this.getPlayerState(playerId)
        const old = [...player.knownHand()]
        player.hand = []
        player.handCount = 0
        player.takeIntoHand(this.actionDiscard.drawItems(StartingHandSize))
        this.actionDiscard.putOnTop(old)
        this.actionDiscard.shuffle(this.getProtectedPrng().random)
    }

    // The player who may mulligan: the one without initiative (rule 6.2.4.1).
    mulliganPlayer(): string {
        const other = this.turnManager.turnOrder.find((playerId) => playerId !== this.initiative)
        assertExists(other, 'A two-player game has a second player')
        return other
    }

    // Rule 6.2: score, clean up, and either end the game or start the next chapter.
    endChapter(): ChapterEnd {
        const awards = this.scoreChapter()
        this.cartelsTakeTheirDue()
        this.lavishSpending()
        this.cleanUpChapter()
        if (this.gameIsOver()) {
            return { awards, gameOver: true }
        }
        this.chapter += 1
        this.round = newRound(this.initiative)
        this.shuffleAndDeal()
        return { awards, gameOver: false }
    }

    // Unions take their claimed cards back to hand first.
    discardPlayedCards() {
        const claimed = new Set<string>()
        for (const union of this.round.unions) {
            this.getPlayerState(union.playerId).takeIntoHand([union.actionCardId])
            this.courtDiscard.push(union.unionId)
            claimed.add(union.actionCardId)
        }
        for (const play of this.round.plays) {
            const faceDown = play.faceDown ?? []
            this.actionDiscard.putOnTop(faceDown)
            if (play.cardId && !claimed.has(play.cardId)) {
                if (this.splitDiscards) {
                    this.faceUpDiscard.push(play.cardId)
                } else {
                    this.actionDiscard.putOnTop([play.cardId])
                }
            }
        }
    }

    // Initiative goes to whoever seized it, else to the highest Surpass, else stays (rule 5.3).
    endRound() {
        const surpasses = this.round.plays
            .filter((play) => play.kind === PlayKind.Surpass && play.cardId)
            .sort((a, b) => actionCard(b.cardId ?? '').number - actionCard(a.cardId ?? '').number)
        this.initiative = this.round.seizedBy ?? surpasses[0]?.playerId ?? this.initiative
        this.discardPlayedCards()
        this.round = newRound(this.initiative)
    }

    anyCardsLeft(): boolean {
        return this.players.some((player) => player.handCount > 0)
    }
}

export type ShipsMoving = { fresh: number; damaged: number }

export type ShipsMove = {
    from: SystemId
    path: readonly SystemId[]
    fresh: number
    damaged: number
    dropOffs: readonly ShipsMoving[]
}

export type ShipsSprinting = {
    from: SystemId
    path: readonly SystemId[]
    fresh: number
    dropOffs: readonly ShipsMoving[]
}

// A raid takes one resource slot's resource or one Guild card.
export type RaidTarget = { slot?: number; cardId?: string }

export type RaidResult = { resource?: Resource; discarded?: Resource; cardId?: string }

export type RuthlessChoice = {
    discard?: Resource[]
    ransack?: string
    vox?: VoxChoice
}

export type RuthlessResult = { destroyed: boolean; gained: Resource[]; discarded: Resource[] }

export type SecuredCard = { taken: Record<string, number>; vox?: VoxResult }

export type BattleDamage = {
    attackerShipsDestroyed: number
    defenderShipsDestroyed: number
    buildingsDestroyed: BuildingKind[]
    outraged: Resource[]
}
