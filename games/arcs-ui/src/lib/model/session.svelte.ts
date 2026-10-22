import { GameSession } from '@tabletop/frontend-components'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    actionCard,
    ActionType,
    canTakeNewAction,
    canUseCard,
    canUseLore,
    FireRifles,
    Mythic,
    NewActions,
    Ruthless,
    TakeNewAction,
    UseCard,
    UseFarseers,
    UseLore,
    BoldInfluence,
    DeclareStep,
    Farsee,
    GainOnDeclaring,
    GiveGuildCard,
    KeepLore,
    leastPowerfulRivals,
    ResolveConnected,
    SwapWithRival,
    AssignHits,
    BattleStep,
    BelovedInfluence,
    EndBattle,
    MoveInBySensors,
    Raid,
    Ransack,
    Reroll,
    RollDice,
    type BuildingHits,
    type RaidTarget,
    type SensorsMove,
    type ShipHits,
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
    HydratedArcsGameState,
    Lore,
    type ShipsMoving,
    type Sprint,
    type ArcsProjectedState,
    type SystemId,
    type VoxChoice
} from '@tabletop/arcs'
import {
    chooseCourtCard,
    chooseFirstMove,
    chooseHandCard,
    chooseIntent,
    chooseOrigin,
    choosePath,
    chooseSprintOrigin,
    chooseSprintPath,
    chooseTarget,
    hasManualArcsSelection,
    popArcsSelection,
    type ArcsSelection,
    type BoardTarget,
    type Intent,
    type Payment,
    type ShipsChoice
} from './stagedSelection.js'
import { abilityCandidates, type AbilityOption } from '$lib/utils/abilities.js'

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

export type RaidOption = { target: RaidTarget; cost: number; discards: (Resource | undefined)[] }

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
    readonly firstMove: ShipsChoice | undefined = $derived(this.selection.firstMove?.value)
    readonly sprintOrigin: SystemId | undefined = $derived(this.selection.sprintOrigin?.value)
    readonly sprintPath: SystemId[] = $derived(this.selection.sprintPath?.value ?? [])
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
        if (!this.intentFor(StandardAction.Move) || !origin || this.firstMove) return []
        const last = this.path.at(-1) ?? origin
        if (this.path.length > 0 && !isGate(last)) return []
        return this.gameState
            .adjacent(last)
            .filter((next) => next !== origin && this.canMoveAlong(origin, [...this.path, next]))
    })

    // Sprinter Drives: after the first move, where its fresh ships stopped, then their next steps.
    readonly sprintArrivals: Record<string, number> = $derived(
        this.firstMove
            ? HydratedArcsGameState.freshArrivals(
                  this.path,
                  this.firstMove,
                  this.firstMove.dropOffs
              )
            : {}
    )

    readonly sprintOrigins: SystemId[] = $derived.by(() => {
        const origin = this.origin
        if (!origin || !this.firstMove || this.sprintOrigin) return []
        return this.path.filter(
            (system, index) =>
                this.path.indexOf(system) === index &&
                (this.sprintArrivals[system] ?? 0) > 0 &&
                this.gameState
                    .adjacent(system)
                    .some((next) => this.wouldApply(this.sprintAction(system, [next], 1)))
        )
    })

    readonly sprintSteps: SystemId[] = $derived.by(() => {
        const from = this.sprintOrigin
        if (!from) return []
        const last = this.sprintPath.at(-1) ?? from
        if (this.sprintPath.length > 0 && !isGate(last)) return []
        return this.gameState
            .adjacent(last)
            .filter(
                (next) =>
                    next !== from &&
                    this.wouldApply(this.sprintAction(from, [...this.sprintPath, next], 1))
            )
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

    chooseSprintOrigin(system: SystemId) {
        this.selection = chooseSprintOrigin(this.selection, system)
    }

    chooseSprintStep(system: SystemId) {
        this.selection = chooseSprintPath(this.selection, [...this.sprintPath, system])
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

    canMoveShips(move: ShipsChoice): boolean {
        const origin = this.origin
        return (
            origin !== undefined &&
            this.path.length > 0 &&
            this.wouldApply(this.moveAction(origin, this.path, move))
        )
    }

    async moveShips(move: ShipsChoice) {
        const origin = this.origin
        assertExists(origin, 'A move has an origin')
        await this.applyAction(this.moveAction(origin, this.path, move))
    }

    // Sprinter Drives: some of the fresh ships may move once more after this move.
    canSprintAfter(move: ShipsChoice): boolean {
        const me = this.myPlayerId()
        return (
            move.fresh > 0 &&
            this.gameState.hasLore(me, Lore.SprinterDrives) &&
            this.canMoveShips(move)
        )
    }

    sprintAfter(move: ShipsChoice) {
        this.selection = chooseFirstMove(this.selection, move)
    }

    canSprint(fresh: number, dropOffs: ShipsMoving[]): boolean {
        const from = this.sprintOrigin
        return (
            from !== undefined &&
            this.sprintPath.length > 0 &&
            this.wouldApply(this.sprintAction(from, this.sprintPath, fresh, dropOffs))
        )
    }

    async sprint(fresh: number, dropOffs: ShipsMoving[]) {
        const from = this.sprintOrigin
        assertExists(from, 'A sprint has an origin')
        await this.applyAction(this.sprintAction(from, this.sprintPath, fresh, dropOffs))
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

    // ----- Battle -----

    readonly battleState = $derived(this.gameState.battle)
    readonly isBattling = $derived(this.canAct && this.machineState === MachineState.Battling)
    readonly battleStep = $derived(this.isBattling ? this.battleState?.step : undefined)

    canAssignHits(attacking: ShipHits, defending: ShipHits, buildings: BuildingHits[]): boolean {
        return this.gameState.canAssignHits(this.myPlayerId(), attacking, defending, buildings)
    }

    async assignHits(attacking: ShipHits, defending: ShipHits, buildings: BuildingHits[]) {
        await this.applyAction(
            this.createPlayerAction(AssignHits, { attacking, defending, buildings })
        )
    }

    canReroll(dice: number[]): boolean {
        return this.gameState.canReroll(this.myPlayerId(), dice)
    }

    async reroll(dice: number[]) {
        await this.applyAction(this.createPlayerAction(Reroll, { dice, revealsInfo: true }))
    }

    canRollDice(dice: BattleDice): boolean {
        return this.gameState.canRollBattleDice(this.myPlayerId(), dice)
    }

    async rollDice(dice: BattleDice) {
        await this.applyAction(this.createPlayerAction(RollDice, { dice, revealsInfo: true }))
    }

    canMoveInBySensors(moves: SensorsMove[]): boolean {
        return this.gameState.canMoveInBySensors(this.myPlayerId(), moves)
    }

    async moveInBySensors(moves: SensorsMove[]) {
        await this.applyAction(this.createPlayerAction(MoveInBySensors, { moves }))
    }

    readonly ransackTargets: string[] = $derived.by(() => {
        if (this.battleStep !== BattleStep.Ransack) return []
        const me = this.myPlayerId()
        return this.courtCards().filter(
            (cardId) =>
                this.gameState.canRansack(me, cardId) || this.gameState.canRansack(me, cardId, {})
        )
    })

    canRansackWith(cardId: string, vox?: VoxChoice): boolean {
        return this.gameState.canRansack(this.myPlayerId(), cardId, vox)
    }

    async ransack(cardId: string, vox?: VoxChoice) {
        await this.applyAction(this.createPlayerAction(Ransack, { cardId, vox }))
    }

    // What the keys can steal: each resource slot or Guild card, its cost, and what the attacker
    // would discard to hold a stolen resource (nothing, if a slot is free).
    readonly raidTargets: RaidOption[] = $derived.by(() => {
        const battle = this.battleState
        if (this.battleStep !== BattleStep.Raid || !battle) return []
        const me = this.myPlayerId()
        const defender = this.gameState.getPlayerState(battle.defender)
        const targets: RaidTarget[] = [
            ...defender.resources.map((_, slot) => ({ slot })),
            ...defender.guildCards.map((cardId) => ({ cardId }))
        ]
        return targets.flatMap((target) => {
            const cost = this.gameState.raidCost(target)
            if (cost === undefined) return []
            const discards = [undefined, ...Resources].filter((discard) =>
                this.gameState.canRaid(me, target, discard)
            )
            return discards.length > 0 ? [{ target, cost, discards }] : []
        })
    })

    async raid(target: RaidTarget, discard?: Resource) {
        await this.applyAction(this.createPlayerAction(Raid, { ...target, discard }))
    }

    readonly canEndBattle = $derived(this.canTake(ActionType.EndBattle))

    async endBattle() {
        await this.applyAction(this.createPlayerAction(EndBattle, {}))
    }

    readonly belovedTargets: string[] = $derived.by(() => {
        if (this.battleStep !== BattleStep.Beloved) return []
        const me = this.myPlayerId()
        return this.courtCards().filter((cardId) => this.gameState.canBelovedInfluence(me, cardId))
    })

    async belovedInfluence(cardId?: string) {
        await this.applyAction(this.createPlayerAction(BelovedInfluence, { cardId }))
    }

    // ----- Declaring an ambition, and the Archivist -----

    readonly declaration = $derived(this.gameState.declaration)
    readonly declareStep = $derived(
        this.canAct && this.machineState === MachineState.Declaring
            ? this.declaration?.steps[0]
            : undefined
    )

    readonly generousRivals: string[] = $derived(
        this.declareStep === DeclareStep.Generous
            ? leastPowerfulRivals(this.gameState, this.myPlayerId())
            : []
    )

    async giveGuildCard(cardId: string, to: string) {
        await this.applyAction(this.createPlayerAction(GiveGuildCard, { cardId, to }))
    }

    canResolveConnectedWith(vox: VoxChoice): boolean {
        return this.wouldApply(this.createPlayerAction(ResolveConnected, { vox }))
    }

    async resolveConnected(vox: VoxChoice) {
        await this.applyAction(this.createPlayerAction(ResolveConnected, { vox }))
    }

    // Upstart, Ambitious: each resource that can be gained, with what to discard for it.
    readonly ambitiousGains: { resource: Resource; discards: Resource[][] }[] = $derived.by(() => {
        if (this.declareStep !== DeclareStep.Ambitious) return []
        return Resources.map((resource) => ({
            resource,
            discards: this.discardsThatWork((discard) =>
                this.createPlayerAction(GainOnDeclaring, { resource, discard })
            )
        })).filter((option) => option.discards.length > 0)
    })

    async gainOnDeclaring(resource?: Resource, discard: Resource[] = []) {
        await this.applyAction(this.createPlayerAction(GainOnDeclaring, { resource, discard }))
    }

    canBoldInfluence(cardIds: string[]): boolean {
        return this.wouldApply(this.createPlayerAction(BoldInfluence, { cardIds }))
    }

    async boldInfluence(cardIds: string[]) {
        await this.applyAction(this.createPlayerAction(BoldInfluence, { cardIds }))
    }

    async farsee(rival: string) {
        await this.applyAction(this.createPlayerAction(Farsee, { rival, revealsInfo: true }))
    }

    async swapWithRival(give?: string, take?: string) {
        await this.applyAction(this.createPlayerAction(SwapWithRival, { give, take }))
    }

    readonly archive = $derived(
        this.canTake(ActionType.KeepLore) ? this.gameState.archive : undefined
    )

    async keepLore(cardIds: string[]) {
        await this.applyAction(this.createPlayerAction(KeepLore, { cardIds }))
    }

    // ----- Card abilities -----

    // Each card ability the rules allow now, with the payment it would take for a new action.
    readonly abilityOptions: (AbilityOption & { payment?: Payment })[] = $derived.by(() => {
        if (!this.isTakingActions) return []
        const me = this.myPlayerId()
        const state = this.gameState
        const candidates = abilityCandidates({
            state,
            me,
            name: (playerId) => this.getPlayerName(playerId)
        })
        const seen = new Set<string>()
        const firstOfEachLabel = (option: AbilityOption) => {
            if (seen.has(option.label)) return false
            seen.add(option.label)
            return true
        }
        const allowed = candidates.flatMap((option): (AbilityOption & { payment?: Payment })[] => {
            switch (option.kind) {
                case 'card':
                    return canUseCard(state, me, option.use) ? [option] : []
                case 'lore':
                    return canUseLore(state, me, option.use) ? [option] : []
                case 'new': {
                    const payment = this.paymentsFor(NewActions[option.choice.name].replaces)[0]
                    return payment && canTakeNewAction(state, me, option.choice)
                        ? [{ ...option, payment }]
                        : []
                }
                case 'rifles': {
                    const payment = this.paymentsFor(StandardAction.Battle)[0]
                    return payment &&
                        state.canFireRifles(me, option.system, option.target, option.defender)
                        ? [{ ...option, payment }]
                        : []
                }
                case 'ruthless':
                    return state.canRuthless(me, {
                        ransack: option.ransack,
                        discard: option.discard
                    })
                        ? [option]
                        : []
                case 'mythic':
                    return state.canMythic(me, option.resource) ? [option] : []
            }
        })
        return allowed.filter(firstOfEachLabel)
    })

    readonly farseersDiscards: string[][] = $derived.by(() => {
        if (!this.isTakingActions) return []
        const me = this.myPlayerId()
        return [[], ...this.myHand.map((cardId) => [cardId])].filter((discards) =>
            this.gameState.canUseFarseers(me, discards)
        )
    })

    async useFarseers(discards: string[]) {
        await this.applyAction(
            this.createPlayerAction(UseFarseers, { discards, revealsInfo: true })
        )
    }

    async useAbility(option: AbilityOption & { payment?: Payment }) {
        switch (option.kind) {
            case 'card':
                await this.applyAction(this.createPlayerAction(UseCard, option.use))
                break
            case 'lore':
                await this.applyAction(this.createPlayerAction(UseLore, option.use))
                break
            case 'new':
                await this.applyAction(
                    this.createPlayerAction(TakeNewAction, { ...option.choice, ...option.payment })
                )
                break
            case 'rifles':
                await this.applyAction(
                    this.createPlayerAction(FireRifles, {
                        system: option.system,
                        target: option.target,
                        defender: option.defender,
                        revealsInfo: true,
                        via: option.payment?.via,
                        token: option.payment?.token
                    })
                )
                break
            case 'ruthless':
                await this.applyAction(
                    this.createPlayerAction(Ruthless, {
                        ransack: option.ransack,
                        discard: option.discard
                    })
                )
                break
            case 'mythic':
                await this.applyAction(
                    this.createPlayerAction(Mythic, { resource: option.resource })
                )
                break
        }
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
            (ships.fresh > 0 &&
                this.wouldApply(this.moveAction(origin, path, shipsChoice(path, 1, 0)))) ||
            (ships.damaged > 0 &&
                this.wouldApply(this.moveAction(origin, path, shipsChoice(path, 0, 1))))
        )
    }

    private moveAction(origin: SystemId, path: SystemId[], move: ShipsChoice, sprint?: Sprint) {
        const intent = this.requireIntent(StandardAction.Move)
        return this.createPlayerAction(MoveShips, {
            from: origin,
            path,
            fresh: move.fresh,
            damaged: move.damaged,
            // Choices kept in reactive state arrive as proxies, which can't be cloned.
            dropOffs: $state.snapshot(move.dropOffs),
            ...(sprint ? { sprint: $state.snapshot(sprint) } : {}),
            ...intent.payment
        })
    }

    // The first move, with fresh ships moving on from `from` along `path`.
    private sprintAction(
        from: SystemId,
        path: SystemId[],
        fresh: number,
        dropOffs: ShipsMoving[] = noDropOffs(path)
    ) {
        const origin = this.origin
        const move = this.firstMove
        assertExists(origin, 'A sprint follows a move')
        assertExists(move, 'A sprint follows a move')
        return this.moveAction(origin, this.path, move, { from, path, fresh, dropOffs })
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

// Nothing left behind in the systems a path passes through.
export function noDropOffs(path: readonly SystemId[]): ShipsMoving[] {
    return path.slice(1).map(() => ({ fresh: 0, damaged: 0 }))
}

function shipsChoice(path: readonly SystemId[], fresh: number, damaged: number): ShipsChoice {
    return { fresh, damaged, dropOffs: noDropOffs(path) }
}
