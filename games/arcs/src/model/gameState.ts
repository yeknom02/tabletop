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
import { DiceOfEachKind, Die, DieSymbol } from '../components/dice.js'
import {
    ResourceSlotRaidCosts,
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
    type ShipCount
} from './pieces.js'
import {
    BattleState,
    BattleStep,
    hitShips,
    rollDie,
    shipHitCapacity,
    type RolledDie,
    symbolsRolled,
    type BuildingHits,
    type ShipHits
} from './battle.js'
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
    battle: Type.Optional(BattleState)
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

    // Puts a building from the player's supply into the first empty slot. Cities come off the
    // player board from the left.
    placeBuilding(id: SystemId, playerId: string, kind: BuildingKind, damaged: boolean = false) {
        const slot = this.emptySlot(id)
        assert(slot >= 0, `${id} has no empty building slot`)
        const player = this.getPlayerState(playerId)
        if (kind === BuildingKind.City) {
            assert(player.citiesOnBoard > 0, `${playerId} has no city to build`)
            player.citiesOnBoard -= 1
        } else {
            assert(player.starports > 0, `${playerId} has no starport to build`)
            player.starports -= 1
        }
        this.system(id).slots[slot] = { owner: playerId, kind, damaged }
    }

    building(id: SystemId, slot: number): Building {
        const building = this.system(id).slots[slot]
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
            this.gainFromSupply(playerId, resource)
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
            player.lore.push(cardId)
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
                case 'LEAD02':
                    this.outrageAtSetup(player, [Resource.Material, Resource.Fuel])
                    break
                // Overseer, Hated: scrap 2 ships and 3 agents.
                case 'LEAD10':
                    player.ships -= 2
                    player.agents -= 3
                    break
                // Anarchist, Decentralized: scrap the 2 leftmost cities.
                case 'LEAD13':
                    player.citiesOnBoard -= 2
                    break
                // Quartermaster, Greedy: an agent on the Material Outrage slot.
                case 'LEAD16':
                    this.outrageAtSetup(player, [Resource.Material])
                    break
            }
        }
        this.draft = undefined
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
        return declare === undefined || this.canDeclare(actionCard(cardId), declare)
    }

    lead(playerId: string, cardId: string, declare?: Ambition) {
        assert(this.canLead(playerId, cardId, declare), `${playerId} cannot lead ${cardId}`)
        const player = this.getPlayerState(playerId)
        player.removeFromHand(cardId)
        if (declare !== undefined) {
            this.declareAmbition(declare)
        }
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
    }

    declareAmbition(ambition: Ambition) {
        const marker = this.availableMarker()
        assertExists(marker, 'Every ambition marker is placed')
        this.ambitionMarkers[marker].ambition = ambition
        this.round.declared = true
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
                !this.canDeclare(card, declare))
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
        if (declare !== undefined) {
            this.declareAmbition(declare)
        }
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

    // Whether the turn can take this action, paid with a pip or a resource.
    canPay(
        playerId: string,
        action: StandardAction,
        via: Resource | undefined,
        token: Resource | undefined = via
    ): boolean {
        const turn = this.turn
        if (turn?.playerId !== playerId || this.machineState !== MachineState.TakingActions) {
            return false
        }
        if (via === undefined) {
            return token === undefined && turn.pips > 0 && this.pipActions().includes(action)
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
        token: Resource | undefined = via
    ) {
        assert(this.canPay(playerId, action, via, token), `${playerId} cannot ${action} that way`)
        const turn = this.currentTurn()
        if (token === undefined) {
            turn.pips -= 1
            this.endPrelude()
        } else {
            this.getPlayerState(playerId).removeResource(token)
            turn.spent[token] += 1
        }
    }

    // A spent Weapon lets this turn's pips battle (rule 9.1).
    spendWeapon(playerId: string, token: Resource = Resource.Weapon) {
        assert(
            this.canSpendResource(playerId, Resource.Weapon, token),
            `${playerId} cannot spend a Weapon`
        )
        const turn = this.currentTurn()
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
    canTax(playerId: string, id: SystemId, slot: number, discard?: Resource): boolean {
        const building = this.system(id).slots[slot]
        if (!building || building.kind !== BuildingKind.City) {
            return false
        }
        if (this.currentTurn().taxed.includes(`${id}:${slot}`)) {
            return false
        }
        const planet = planetOf(id)
        if (!planet || !this.canGainFromSupply(playerId, planet.resource, discard)) {
            return false
        }
        return building.owner === playerId || this.controller(id) === playerId
    }

    tax(
        playerId: string,
        id: SystemId,
        slot: number,
        discard?: Resource
    ): { resource?: Resource; discarded?: Resource; captured?: string } {
        assert(
            this.canTax(playerId, id, slot, discard),
            `${playerId} cannot tax ${id} slot ${slot}`
        )
        this.currentTurn().taxed.push(`${id}:${slot}`)
        const planet = planetOf(id)
        const result: { resource?: Resource; discarded?: Resource; captured?: string } = {}
        if (planet) {
            const gain = this.gainFromSupply(playerId, planet.resource, discard)
            if (gain.gained) {
                result.resource = planet.resource
            }
            if (gain.discarded !== undefined) {
                result.discarded = gain.discarded
            }
        }
        const owner = this.building(id, slot).owner
        if (owner !== playerId) {
            const rival = this.getPlayerState(owner)
            if (rival.agents > 0) {
                rival.agents -= 1
                this.getPlayerState(playerId).capture(owner)
                result.captured = owner
            }
        }
        return result
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

    // With nothing in the supply, nothing is gained and nothing discarded.
    canGainFromSupply(playerId: string, resource: Resource, discard?: Resource): boolean {
        return this.supplyAvailable(resource) === 0
            ? discard === undefined
            : this.getPlayerState(playerId).canGain(resource, discard)
    }

    // Returns whether the resource was gained, and what was discarded to make room.
    gainFromSupply(
        playerId: string,
        resource: Resource,
        discard?: Resource
    ): { gained: boolean; discarded?: Resource } {
        assert(this.canGainFromSupply(playerId, resource, discard), `${playerId} cannot gain so`)
        if (this.supplyAvailable(resource) === 0) {
            return { gained: false }
        }
        this.supply[resource] -= 1
        const discarded = this.getPlayerState(playerId).gain(resource, discard)
        if (discarded !== undefined) {
            this.supply[discarded] += 1
        }
        return { gained: discarded !== resource, discarded }
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
        if (!this.inPlay(id) || isGate(id) || this.emptySlot(id) < 0) {
            return false
        }
        const player = this.getPlayerState(playerId)
        const inSupply = kind === BuildingKind.City ? player.citiesOnBoard : player.starports
        return inSupply > 0 && this.hasLoyalPiece(id, playerId)
    }

    buildBuilding(playerId: string, id: SystemId, kind: BuildingKind): boolean {
        assert(this.canBuildBuilding(playerId, id, kind), `${playerId} cannot build in ${id}`)
        const damaged = this.controlledByOther(id, playerId)
        this.placeBuilding(id, playerId, kind, damaged)
        return damaged
    }

    canBuildShip(playerId: string, id: SystemId, slot: number): boolean {
        const building = this.system(id).slots[slot]
        return (
            building?.kind === BuildingKind.Starport &&
            building.owner === playerId &&
            this.getPlayerState(playerId).ships > 0 &&
            !this.currentTurn().starportsBuilt.includes(`${id}:${slot}`)
        )
    }

    buildShip(playerId: string, id: SystemId, slot: number): boolean {
        assert(this.canBuildShip(playerId, id, slot), `${playerId} cannot build a ship there`)
        this.currentTurn().starportsBuilt.push(`${id}:${slot}`)
        const damaged = this.controlledByOther(id, playerId)
        this.placeShipFromSupply(id, playerId, damaged)
        return damaged
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
            moving.damaged > ships.damaged
        ) {
            return false
        }
        const catapult = this.system(from).slots.some(
            (building) => building?.kind === BuildingKind.Starport && building.owner === playerId
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

    move(
        playerId: string,
        from: SystemId,
        path: readonly SystemId[],
        moving: ShipsMoving,
        dropOffs: readonly ShipsMoving[]
    ) {
        assert(this.canMove(playerId, from, path, moving, dropOffs), `${playerId} cannot move so`)
        this.removeShips(from, playerId, moving.fresh, moving.damaged)
        let left = { ...moving }
        for (const [step, drop] of dropOffs.entries()) {
            if (drop.fresh + drop.damaged > 0) {
                this.addShips(path[step], playerId, drop.fresh, drop.damaged)
            }
            left = { fresh: left.fresh - drop.fresh, damaged: left.damaged - drop.damaged }
        }
        this.addShips(path[path.length - 1], playerId, left.fresh, left.damaged)
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
        const building = this.system(id).slots[slot]
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
    canSecure(playerId: string, cardId: string): boolean {
        const slot = this.court.find((candidate) => candidate.cardId === cardId)
        if (!slot) {
            return false
        }
        const own = slot.agents[playerId] ?? 0
        return (
            own > 0 &&
            Object.entries(slot.agents).every(([owner, count]) => owner === playerId || count < own)
        )
    }

    // Takes the card, returning the player's agents and capturing Rivals'. The card's When
    // Secured action is the caller's to resolve; the Court refills from the deck.
    secure(playerId: string, cardId: string): Record<string, number> {
        assert(this.canSecure(playerId, cardId), `${playerId} cannot secure ${cardId}`)
        return this.takeCourtCard(playerId, cardId, 'captives')
    }

    takeCourtCard(
        playerId: string,
        cardId: string,
        rivalAgentsBecome: 'captives' | 'trophies'
    ): Record<string, number> {
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
        if (card.kind === 'guild') {
            player.guildCards.push(cardId)
        } else {
            this.courtDiscard.push(cardId)
        }
        if (this.turn?.prelude) {
            this.turn.securedInPrelude.push(cardId)
        }
        const index = this.court.indexOf(slot)
        if (this.courtDeck.count() > 0) {
            this.court[index] = { cardId: this.courtDeck.draw(), agents: {} }
        } else {
            this.court.splice(index, 1)
        }
        return taken
    }

    // ----- Battle -----

    // The Rivals with pieces in a system, who can be chosen as defender (rule 7.7.1.2).
    defendersIn(playerId: string, id: SystemId): string[] {
        return this.turnManager.turnOrder.filter(
            (owner) => owner !== playerId && this.hasLoyalPiece(id, owner)
        )
    }

    // Raid dice need defending buildings, or a defender with no buildings anywhere (rule 7.7.1.3.1).
    canCollectRaidDice(id: SystemId, defender: string): boolean {
        const owns = (system: SystemState) =>
            buildingsIn(system).some((building) => building.owner === defender)
        return owns(this.system(id)) || !this.systems.some(owns)
    }

    canBattle(
        playerId: string,
        id: SystemId,
        defender: string,
        dice: Readonly<Record<Die, number>>
    ): boolean {
        if (!this.inPlay(id) || !this.defendersIn(playerId, id).includes(defender)) {
            return false
        }
        const ships = shipsOf(this.system(id), playerId)
        const counts = Object.values(Die).map((die) => dice[die])
        const total = counts.reduce((sum, count) => sum + count, 0)
        // Gatekeepers collect 2 more dice in a gate.
        const extra = isGate(id) && this.holds(playerId, Court.Gatekeepers) ? 2 : 0
        return (
            counts.every((count) => count >= 0 && count <= DiceOfEachKind) &&
            total > 0 &&
            total <= ships.fresh + ships.damaged + extra &&
            (dice[Die.Raid] === 0 || this.canCollectRaidDice(id, defender))
        )
    }

    // Rolls the dice and counts what the attacker must resolve. Intercepts hit once per fresh
    // defending ship, however many dice show it (rule 7.7.1.4).
    startBattle(
        playerId: string,
        id: SystemId,
        defender: string,
        dice: Readonly<Record<Die, number>>
    ): BattleState {
        assert(this.canBattle(playerId, id, defender, dice), `${playerId} cannot battle so`)
        const random = this.getProtectedPrng().random
        const rolled = Object.values(Die).flatMap((die) =>
            Array.from({ length: dice[die] }, () => rollDie(die, random))
        )
        const battle: BattleState = {
            attacker: playerId,
            defender,
            system: id,
            rolled,
            attackerHits: 0,
            hits: 0,
            buildingHits: 0,
            keys: 0,
            step: BattleStep.Hits,
            rerolls: this.holds(playerId, Court.Skirmishers)
                ? Math.min(this.weaponIcons(playerId), dice[Die.Skirmish])
                : 0,
            ransacks: 0
        }
        this.battle = battle
        this.tallyRoll()
        return battle
    }

    // Counts what the roll makes the attacker resolve, skipping to raiding when nothing is hit
    // and nothing can be rerolled.
    tallyRoll() {
        const battle = this.currentBattle()
        const { rolled } = battle
        const intercepts =
            symbolsRolled(rolled, DieSymbol.Intercept) > 0
                ? shipsOf(this.system(battle.system), battle.defender).fresh
                : 0
        battle.attackerHits = symbolsRolled(rolled, DieSymbol.SelfHit) + intercepts
        battle.hits = symbolsRolled(rolled, DieSymbol.Hit)
        battle.buildingHits = symbolsRolled(rolled, DieSymbol.BuildingHit)
        battle.keys = symbolsRolled(rolled, DieSymbol.Key)
        if (battle.rerolls === 0 && battle.attackerHits + battle.hits + battle.buildingHits === 0) {
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

    canReroll(playerId: string, dice: readonly number[]): boolean {
        const battle = this.battle
        if (battle?.step !== BattleStep.Hits || battle.attacker !== playerId) {
            return false
        }
        return (
            dice.length > 0 &&
            dice.length <= battle.rerolls &&
            new Set(dice).size === dice.length &&
            dice.every((index) => battle.rolled[index]?.die === Die.Skirmish)
        )
    }

    // Skirmishers: reroll some skirmish dice, once (rule 8.3).
    reroll(playerId: string, dice: readonly number[]): RolledDie[] {
        assert(this.canReroll(playerId, dice), `${playerId} cannot reroll those dice`)
        const battle = this.currentBattle()
        const random = this.getProtectedPrng().random
        for (const index of dice) {
            battle.rolled[index] = rollDie(Die.Skirmish, random)
        }
        battle.rerolls = 0
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
        return this.system(battle.system).slots.flatMap((building, slot) =>
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
                this.system(id).slots[hit.slot] = null
                destroyedBuildings.push(building.kind)
                if (building.kind === BuildingKind.City) {
                    attackerTrophies.push({ owner: defender, kind: TrophyKind.City })
                    const resource = this.destroyCity(attacker, id)
                    if (resource) {
                        outraged.push(resource)
                    }
                    battle.ransacks += 1
                } else {
                    attackerTrophies.push({ owner: defender, kind: TrophyKind.Starport })
                }
            } else {
                building.damaged = true
            }
        }
        battle.attackerHits = 0
        battle.hits = 0
        battle.buildingHits = 0
        battle.rerolls = 0
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
    // type and is Outraged by it. Returns the resource, if the planet has one.
    destroyCity(destroyer: string, id: SystemId): Resource | undefined {
        const planet = planetOf(id)
        if (!planet) {
            return undefined
        }
        this.provokeOutrage(destroyer, planet.resource)
        return planet.resource
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
    ransackableCards(): string[] {
        const defender = this.currentBattle().defender
        return this.court
            .filter((slot) => (slot.agents[defender] ?? 0) > 0)
            .map((slot) => slot.cardId)
    }

    canRansack(playerId: string, cardId: string): boolean {
        const battle = this.battle
        return (
            battle?.step === BattleStep.Ransack &&
            battle.attacker === playerId &&
            this.ransackableCards().includes(cardId)
        )
    }

    // Secures the card; every Rival agent on it becomes the attacker's Trophy.
    ransack(playerId: string, cardId: string): Record<string, number> {
        assert(this.canRansack(playerId, cardId), `${playerId} cannot ransack ${cardId}`)
        const taken = this.takeCourtCard(playerId, cardId, 'trophies')
        this.currentBattle().ransacks -= 1
        this.advanceBattle()
        return taken
    }

    // The keys a raid on this target costs, if the defender has it: a resource slot or a Guild
    // card (rule 7.7.5).
    raidCost(target: RaidTarget): number | undefined {
        const defender = this.getPlayerState(this.currentBattle().defender)
        // Sworn Guardians protects everything else its holder has, until it is stolen itself.
        if (
            defender.guildCards.includes(Court.SwornGuardians) &&
            target.cardId !== Court.SwornGuardians
        ) {
            return undefined
        }
        if (target.slot !== undefined) {
            return defender.resources[target.slot] ? ResourceSlotRaidCosts[target.slot] : undefined
        }
        if (target.cardId !== undefined && defender.guildCards.includes(target.cardId)) {
            return CourtCards.find((card) => card.id === target.cardId)?.raidCost
        }
        return undefined
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
        if ((target.slot === undefined) === (target.cardId === undefined)) {
            return false
        }
        const cost = this.raidCost(target)
        if (cost === undefined || cost > battle.keys) {
            return false
        }
        if (target.slot === undefined) {
            return discard === undefined
        }
        const stolen = this.getPlayerState(battle.defender).resources[target.slot]
        return stolen !== null && this.getPlayerState(playerId).canGain(stolen, discard)
    }

    // Steals one resource or Guild card. A stolen resource goes into an empty slot; with none
    // open, the attacker discards a resource, possibly the stolen one (rule 9.2.1).
    raid(playerId: string, target: RaidTarget, discard?: Resource): RaidResult {
        assert(this.canRaid(playerId, target, discard), `${playerId} cannot raid that`)
        const battle = this.currentBattle()
        const defender = this.getPlayerState(battle.defender)
        const cost = this.raidCost(target) ?? 0
        battle.keys -= cost
        const result: RaidResult = {}
        if (target.slot !== undefined) {
            const stolen = defender.resources[target.slot]
            assertExists(stolen, 'The raided slot holds a resource')
            defender.resources[target.slot] = null
            result.resource = stolen
            const discarded = this.getPlayerState(playerId).gain(stolen, discard)
            if (discarded) {
                this.supply[discarded] += 1
                result.discarded = discarded
            }
        } else if (target.cardId !== undefined) {
            defender.guildCards = defender.guildCards.filter((cardId) => cardId !== target.cardId)
            // Stolen Sworn Guardians are buried.
            if (target.cardId === Court.SwornGuardians) {
                this.courtDeck.putOnBottom(target.cardId)
            } else {
                this.getPlayerState(playerId).guildCards.push(target.cardId)
            }
            result.cardId = target.cardId
        }
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
        this.battle = undefined
    }

    endBattle(playerId: string) {
        assert(this.canEndBattle(playerId), `${playerId} has no battle to end`)
        this.battle = undefined
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
        return awards.filter((award) => award.playerId !== AmbitionDummy)
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
        this.cleanUpChapter()
        if (this.gameIsOver()) {
            return { awards, gameOver: true }
        }
        this.chapter += 1
        this.round = newRound(this.initiative)
        this.shuffleAndDeal()
        return { awards, gameOver: false }
    }

    discardPlayedCards() {
        for (const play of this.round.plays) {
            const faceDown = play.faceDown ?? []
            this.actionDiscard.putOnTop(faceDown)
            if (play.cardId) {
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

// A raid takes one resource slot's resource or one Guild card.
export type RaidTarget = { slot?: number; cardId?: string }

export type RaidResult = { resource?: Resource; discarded?: Resource; cardId?: string }

export type BattleDamage = {
    attackerShipsDestroyed: number
    defenderShipsDestroyed: number
    buildingsDestroyed: BuildingKind[]
    outraged: Resource[]
}
