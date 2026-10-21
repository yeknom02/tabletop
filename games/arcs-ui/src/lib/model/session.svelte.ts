import { GameSession } from '@tabletop/frontend-components'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    actionCard,
    ActionType,
    Ambition,
    ArcsRuntime,
    Battle,
    BuildBuilding,
    BuildingKind,
    BuildShip,
    declarableAmbitions,
    Die,
    DraftCard,
    DraftKind,
    EndTurn,
    FollowCard,
    Influence,
    isGate,
    KeepHand,
    LeadCard,
    MachineState,
    MoveShips,
    PassInitiative,
    PlayKind,
    RailgunHit,
    RedrawHand,
    Repair,
    Resource,
    Resources,
    Secure,
    shipsOf,
    SpendWeapon,
    StandardAction,
    Tax,
    type HydratedArcsGameState,
    type ArcsProjectedState,
    type SystemId,
    type VoxChoice
} from '@tabletop/arcs'
import {
    chooseCourtCard,
    chooseHandCard,
    chooseIntent,
    chooseOrigin,
    choosePath,
    chooseTarget,
    hasManualArcsSelection,
    popArcsSelection,
    type ArcsSelection,
    type BoardTarget,
    type Intent,
    type Payment
} from './stagedSelection.js'

export type HandCardChoice = {
    cardId: string
    lead: boolean
    declare: Ambition[]
    follow: PlayKind[]
}

export type PaymentOption = Payment & { label: string }

export type ActionOffer = { action: StandardAction; payments: PaymentOption[] }

// A building slot a tax or build can target, and what to discard to make room, if anything.
export type SlotTarget = { system: SystemId; slot: number; discards: Resource[][] }

export type BattleDice = Record<Die, number>

const OfferedActions: readonly StandardAction[] = [
    StandardAction.Tax,
    StandardAction.Build,
    StandardAction.Move,
    StandardAction.Repair,
    StandardAction.Influence,
    StandardAction.Secure,
    StandardAction.Battle
]

export class ArcsGameSession extends GameSession<ArcsProjectedState, HydratedArcsGameState> {
    private readonly canAct = $derived(this.isPlayable && !this.isViewingHistory && this.isMyTurn)

    private selection: ArcsSelection = $state({})
    readonly hasManualSelection = $derived(hasManualArcsSelection(this.selection))

    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasManualSelection || Boolean(this.undoableAction))
    )

    readonly machineState = $derived(this.gameState.machineState)

    readonly isDrafting = $derived(this.canTake(ActionType.DraftCard))
    readonly isMulliganing = $derived(this.canTake(ActionType.KeepHand))
    readonly isPlayingCard = $derived(this.canAct && this.machineState === MachineState.PlayingCard)
    readonly isTakingActions = $derived(
        this.canAct && this.machineState === MachineState.TakingActions
    )

    readonly myHand: string[] = $derived(this.myPlayerState?.hand ?? [])
    readonly chosenHandCard = $derived(this.selection.handCard?.value)
    readonly intent: Intent | undefined = $derived(this.selection.intent?.value)
    readonly origin: SystemId | undefined = $derived(this.selection.origin?.value)
    readonly path: SystemId[] = $derived(this.selection.path?.value ?? [])
    readonly target: BoardTarget | undefined = $derived(this.selection.target?.value)
    readonly chosenCourtCard: string | undefined = $derived(this.selection.courtCard?.value)

    readonly handChoices: HandCardChoice[] = $derived.by(() => {
        if (!this.isPlayingCard) return []
        const me = this.myPlayerId()
        const state = this.gameState
        return this.myHand.map((cardId) => ({
            cardId,
            lead: state.canLead(me, cardId),
            declare: declarableAmbitions(actionCard(cardId)).filter((ambition) =>
                state.canLead(me, cardId, ambition)
            ),
            follow: [PlayKind.Surpass, PlayKind.Copy, PlayKind.Pivot].filter((kind) =>
                state.canFollow(me, cardId, kind)
            )
        }))
    })

    readonly canPassInitiative = $derived(this.canTake(ActionType.PassInitiative))
    readonly canEndTurn = $derived(this.canTake(ActionType.EndTurn))
    readonly mustReturnFleet = $derived(
        this.canEndTurn && this.gameState.isEliminated(this.myPlayerId())
    )

    // ----- Paying for actions -----

    readonly actionOffers: ActionOffer[] = $derived.by(() => {
        if (!this.isTakingActions) return []
        return OfferedActions.map((action) => ({
            action,
            payments: this.paymentsFor(action)
        })).filter((offer) => offer.payments.length > 0)
    })

    readonly weaponTokens: Resource[] = $derived(
        this.isTakingActions
            ? Resources.filter((token) =>
                  this.gameState.canSpendResource(this.myPlayerId(), Resource.Weapon, token)
              )
            : []
    )

    // ----- Board targets for the chosen intent -----

    readonly taxTargets: SlotTarget[] = $derived.by(() => {
        const intent = this.intentFor(StandardAction.Tax)
        if (!intent) return []
        const me = this.myPlayerId()
        return this.slots().flatMap(({ system, slot }) => {
            if (!this.gameState.canTaxSlot(me, system, slot)) return []
            const discards = this.discardsThatWork((discard) =>
                this.createPlayerAction(Tax, { system, slot, discard, ...intent.payment })
            )
            return discards.length > 0 ? [{ system, slot, discards }] : []
        })
    })

    readonly shipBuildTargets: SlotTarget[] = $derived.by(() => {
        const intent = this.intentFor(StandardAction.Build)
        if (!intent) return []
        const me = this.myPlayerId()
        return this.slots()
            .filter(
                ({ system, slot }) =>
                    this.gameState.canBuildShip(me, system, slot) &&
                    this.wouldApply(
                        this.createPlayerAction(BuildShip, { system, slot, ...intent.payment })
                    )
            )
            .map(({ system, slot }) => ({ system, slot, discards: [] }))
    })

    readonly buildingTargets: { system: SystemId; kinds: BuildingKind[] }[] = $derived.by(() => {
        const intent = this.intentFor(StandardAction.Build)
        if (!intent) return []
        const me = this.myPlayerId()
        return this.systemsInPlay()
            .map((system) => ({
                system,
                kinds: [BuildingKind.City, BuildingKind.Starport].filter(
                    (building) =>
                        this.gameState.canBuildBuilding(me, system, building) &&
                        this.wouldApply(
                            this.createPlayerAction(BuildBuilding, {
                                system,
                                building,
                                ...intent.payment
                            })
                        )
                )
            }))
            .filter((target) => target.kinds.length > 0)
    })

    readonly repairShipTargets: SystemId[] = $derived.by(() => {
        const intent = this.intentFor(StandardAction.Repair)
        if (!intent) return []
        const me = this.myPlayerId()
        return this.systemsInPlay().filter(
            (system) =>
                this.gameState.canRepairShip(me, system) &&
                this.wouldApply(this.createPlayerAction(Repair, { system, ...intent.payment }))
        )
    })

    readonly repairBuildingTargets: SlotTarget[] = $derived.by(() => {
        const intent = this.intentFor(StandardAction.Repair)
        if (!intent) return []
        const me = this.myPlayerId()
        return this.slots()
            .filter(
                ({ system, slot }) =>
                    this.gameState.canRepairBuilding(me, system, slot) &&
                    this.wouldApply(
                        this.createPlayerAction(Repair, { system, slot, ...intent.payment })
                    )
            )
            .map(({ system, slot }) => ({ system, slot, discards: [] }))
    })

    readonly influenceTargets: string[] = $derived.by(() => {
        const intent = this.intentFor(StandardAction.Influence)
        if (!intent) return []
        return this.courtCards().filter((cardId) =>
            this.wouldApply(this.createPlayerAction(Influence, { cardId, ...intent.payment }))
        )
    })

    readonly secureTargets: string[] = $derived.by(() => {
        if (!this.intentFor(StandardAction.Secure)) return []
        const me = this.myPlayerId()
        return this.courtCards().filter(
            (cardId) =>
                this.gameState.canSecure(me, cardId) || this.gameState.canSecure(me, cardId, {})
        )
    })

    // Move: origins with Loyal ships, then each next step a ship could take from there.
    readonly moveOrigins: SystemId[] = $derived.by(() => {
        if (!this.intentFor(StandardAction.Move) || this.origin) return []
        const me = this.myPlayerId()
        return this.systemsInPlay().filter((system) => {
            const ships = shipsOf(this.gameState.system(system), me)
            return (
                ships.fresh + ships.damaged > 0 &&
                this.gameState.adjacent(system).some((next) => this.canMoveAlong(system, [next]))
            )
        })
    })

    readonly moveSteps: SystemId[] = $derived.by(() => {
        const origin = this.origin
        if (!this.intentFor(StandardAction.Move) || !origin) return []
        const last = this.path.at(-1) ?? origin
        if (this.path.length > 0 && !isGate(last)) return []
        return this.gameState
            .adjacent(last)
            .filter((next) => next !== origin && this.canMoveAlong(origin, [...this.path, next]))
    })

    readonly battleTargets: SystemId[] = $derived.by(() => {
        if (!this.intentFor(StandardAction.Battle)) return []
        const me = this.myPlayerId()
        return this.systemsInPlay().filter((system) => {
            const ships = shipsOf(this.gameState.system(system), me)
            return (
                ships.fresh + ships.damaged > 0 && this.gameState.defendersIn(me, system).length > 0
            )
        })
    })

    readonly returnFleetTargets: SystemId[] = $derived(
        this.mustReturnFleet
            ? this.systemsInPlay().filter((system) =>
                  this.gameState.canReturnFleet(this.myPlayerId(), system)
              )
            : []
    )

    readonly possessiveName = (playerId: string): string =>
        playerId === this.myPlayer?.id ? 'your' : `${this.getPlayerName(playerId)}'s`

    // ----- Lifecycle -----

    override beforeNewState() {
        this.resetAction()
    }

    resetAction() {
        this.selection = {}
    }

    override async undo() {
        if (!this.canUndo || this.busy) return
        if (this.hasManualSelection) {
            this.selection = popArcsSelection(this.selection)
            return
        }
        await super.undo()
    }

    // ----- Choosing -----

    chooseHandCard(cardId: string) {
        this.selection =
            this.chosenHandCard === cardId ? {} : chooseHandCard(this.selection, cardId)
    }

    chooseIntent(intent: Intent) {
        this.selection = chooseIntent({}, intent)
    }

    chooseMoveOrigin(system: SystemId) {
        this.selection = chooseOrigin(this.selection, system)
    }

    chooseMoveStep(system: SystemId) {
        this.selection = choosePath(this.selection, [...this.path, system])
    }

    chooseTarget(target: BoardTarget) {
        this.selection = chooseTarget(this.selection, target)
    }

    chooseCourtCard(cardId: string) {
        this.selection = chooseCourtCard(this.selection, cardId)
    }

    // ----- Card play -----

    async draft(cardId: string, kind: DraftKind) {
        await this.applyAction(this.createPlayerAction(DraftCard, { cardId, kind }))
    }

    async keepHand() {
        await this.applyAction(this.createPlayerAction(KeepHand, {}))
    }

    async redrawHand() {
        await this.applyAction(this.createPlayerAction(RedrawHand, { revealsInfo: true }))
    }

    async lead(cardId: string, declare?: Ambition) {
        await this.applyAction(this.createPlayerAction(LeadCard, { cardId, declare }))
    }

    async follow(cardId: string, playKind: PlayKind) {
        await this.applyAction(this.createPlayerAction(FollowCard, { cardId, playKind }))
    }

    async passInitiative() {
        await this.applyAction(this.createPlayerAction(PassInitiative, {}))
    }

    async endTurn(returnTo?: SystemId) {
        await this.applyAction(this.createPlayerAction(EndTurn, { returnTo }))
    }

    async spendWeapon(token: Resource) {
        await this.applyAction(
            this.createPlayerAction(SpendWeapon, {
                token: token === Resource.Weapon ? undefined : token
            })
        )
    }

    // ----- Standard actions -----

    async tax(target: SlotTarget, discard: Resource[]) {
        const intent = this.requireIntent(StandardAction.Tax)
        await this.applyAction(
            this.createPlayerAction(Tax, {
                system: target.system,
                slot: target.slot,
                discard,
                ...intent.payment
            })
        )
    }

    async buildShip(target: SlotTarget) {
        const intent = this.requireIntent(StandardAction.Build)
        await this.applyAction(
            this.createPlayerAction(BuildShip, {
                system: target.system,
                slot: target.slot,
                ...intent.payment
            })
        )
    }

    async buildBuilding(system: SystemId, building: BuildingKind) {
        const intent = this.requireIntent(StandardAction.Build)
        await this.applyAction(
            this.createPlayerAction(BuildBuilding, { system, building, ...intent.payment })
        )
    }

    async repair(system: SystemId, slot?: number) {
        const intent = this.requireIntent(StandardAction.Repair)
        await this.applyAction(this.createPlayerAction(Repair, { system, slot, ...intent.payment }))
    }

    async influence(cardId: string) {
        const intent = this.requireIntent(StandardAction.Influence)
        await this.applyAction(this.createPlayerAction(Influence, { cardId, ...intent.payment }))
    }

    canSecureWith(cardId: string, vox?: VoxChoice): boolean {
        const intent = this.intentFor(StandardAction.Secure)
        return (
            intent !== undefined &&
            this.wouldApply(this.createPlayerAction(Secure, { cardId, vox, ...intent.payment }))
        )
    }

    async secure(cardId: string, vox?: VoxChoice) {
        const intent = this.requireIntent(StandardAction.Secure)
        await this.applyAction(this.createPlayerAction(Secure, { cardId, vox, ...intent.payment }))
    }

    canMoveShips(fresh: number, damaged: number): boolean {
        const origin = this.origin
        return (
            origin !== undefined &&
            this.path.length > 0 &&
            this.wouldApply(this.moveAction(origin, this.path, fresh, damaged))
        )
    }

    async moveShips(fresh: number, damaged: number) {
        const origin = this.origin
        assertExists(origin, 'A move has an origin')
        await this.applyAction(this.moveAction(origin, this.path, fresh, damaged))
    }

    canBattle(system: SystemId, defender: string, dice: BattleDice, railgun?: RailgunHit): boolean {
        const intent = this.intentFor(StandardAction.Battle)
        return (
            intent !== undefined &&
            this.wouldApply(this.battleAction(intent, system, defender, dice, railgun))
        )
    }

    async battle(system: SystemId, defender: string, dice: BattleDice, railgun?: RailgunHit) {
        const intent = this.requireIntent(StandardAction.Battle)
        await this.applyAction(this.battleAction(intent, system, defender, dice, railgun))
    }

    // ----- Helpers -----

    canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }

    myPlayerId(): string {
        assertExists(this.myPlayer, 'Only a seated player acts')
        return this.myPlayer.id
    }

    private paymentsFor(action: StandardAction): PaymentOption[] {
        const me = this.myPlayerId()
        const state = this.gameState
        const options: PaymentOption[] = []
        if (state.canPay(me, action, undefined)) {
            options.push({ label: 'Action' })
        }
        if (state.bonusSource(me, action)) {
            options.push({ bonus: true, label: 'Extra action' })
        }
        for (const via of Resources) {
            for (const token of Resources) {
                if (state.canPay(me, action, via, token)) {
                    options.push({
                        via,
                        token: token === via ? undefined : token,
                        label: token === via ? via : `${token} as ${via}`
                    })
                }
            }
        }
        return options
    }

    private intentFor(action: StandardAction): Intent | undefined {
        const intent = this.intent
        return this.isTakingActions && intent?.action === action ? intent : undefined
    }

    private requireIntent(action: StandardAction): Intent {
        const intent = this.intentFor(action)
        assertExists(intent, `No ${action} is being chosen`)
        return intent
    }

    private systemsInPlay(): SystemId[] {
        return this.gameState.systems
            .map((system) => system.id)
            .filter((system) => this.gameState.inPlay(system))
    }

    private courtCards(): string[] {
        return this.gameState.court.map((slot) => slot.cardId)
    }

    private slots(): { system: SystemId; slot: number }[] {
        return this.systemsInPlay().flatMap((system) =>
            this.gameState.buildingSlots(system).map((_, slot) => ({ system, slot }))
        )
    }

    // The discard lists that make an action work: none, or one or two resources.
    private discardsThatWork(build: (discard: Resource[]) => GameAction): Resource[][] {
        if (this.wouldApply(build([]))) return [[]]
        const singles = Resources.map((resource) => [resource])
        const pairs = Resources.flatMap((first) => Resources.map((second) => [first, second]))
        return [...singles, ...pairs].filter((discard) => this.wouldApply(build(discard)))
    }

    private canMoveAlong(origin: SystemId, path: SystemId[]): boolean {
        const ships = shipsOf(this.gameState.system(origin), this.myPlayerId())
        return (
            (ships.fresh > 0 && this.wouldApply(this.moveAction(origin, path, 1, 0))) ||
            (ships.damaged > 0 && this.wouldApply(this.moveAction(origin, path, 0, 1)))
        )
    }

    private moveAction(origin: SystemId, path: SystemId[], fresh: number, damaged: number) {
        const intent = this.requireIntent(StandardAction.Move)
        return this.createPlayerAction(MoveShips, {
            from: origin,
            path,
            fresh,
            damaged,
            dropOffs: path.slice(1).map(() => ({ fresh: 0, damaged: 0 })),
            ...intent.payment
        })
    }

    private battleAction(
        intent: Intent,
        system: SystemId,
        defender: string,
        dice: BattleDice,
        railgun?: RailgunHit
    ) {
        const sensors = this.gameState.sensorsApply(system, defender)
        return this.createPlayerAction(Battle, {
            system,
            defender,
            railgun,
            ...(sensors ? {} : { dice, revealsInfo: true as const }),
            ...intent.payment
        })
    }

    // Whether an action would apply to the current state, tried on a copy.
    private wouldApply(action: GameAction): boolean {
        return this.gameState.wouldSucceed((copy) =>
            ArcsRuntime.hydrator.hydrateAction(action).apply(copy)
        )
    }
}
