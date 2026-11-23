import { GameSession, undoableStagedSelection } from '@tabletop/frontend-components'
import { assertExists, sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
import {
    ActionType,
    BuyTile,
    PassTile,
    PlaceBid,
    PlaceTile,
    revenueFor,
    type ConduitProjectedState,
    type HydratedConduitGameState,
    type Placement,
    type Route
} from '@tabletop/conduit'
import {
    chooseCell,
    chooseRotation,
    PlacementStageOrder,
    type PlacementSelection
} from './stagedSelection.js'
import { boardBounds, cellKey } from '$lib/utils/boardLayout.js'

type SessionOptions = ConstructorParameters<
    typeof GameSession<ConduitProjectedState, HydratedConduitGameState>
>[0]

export type StationRoute = { route: Route | undefined; amount: number }

export class ConduitGameSession extends GameSession<
    ConduitProjectedState,
    HydratedConduitGameState
> {
    rulesOpen = $state(false)
    inspectedCell: OffsetCoordinates | undefined = $state()

    private selection: PlacementSelection = $state({})

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                PlacementStageOrder,
                () => this.selection,
                (selection) => (this.selection = selection)
            )
        )
    }

    private readonly canAct = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            this.isMyTurn &&
            this.gameState.result === undefined
    )

    readonly canUndo = $derived(
        this.isPlayable &&
            !this.isViewingHistory &&
            (this.hasLocalSelection || Boolean(this.undoableAction))
    )

    readonly grid = $derived(this.gameState.grid())
    readonly bounds = $derived(boardBounds(this.gameState.board))
    readonly closedConnections = $derived(this.grid.closedConnections())

    // What each Power Station would earn if revenue were paid now.
    readonly stationRoutes: Map<string, StationRoute> = $derived(
        new Map(
            this.gameState.ownedStations().map((station) => {
                const route = this.grid.bestRoute(station.cell)
                return [cellKey(station.cell), { route, amount: revenueFor(route) }]
            })
        )
    )

    readonly inspectedRoute: Route | undefined = $derived(
        this.inspectedCell ? this.stationRoutes.get(cellKey(this.inspectedCell))?.route : undefined
    )

    readonly offer = $derived(this.gameState.currentOffer())
    readonly pendingPlacement = $derived(this.gameState.pendingPlacement())

    readonly isBidding = $derived(this.canTake(ActionType.PlaceBid))
    readonly biddableSlots: number[] = $derived(
        this.isBidding ? this.gameState.biddableSlots() : []
    )
    readonly canBuy = $derived(this.canTake(ActionType.BuyTile))
    readonly canPass = $derived(this.canTake(ActionType.PassTile))
    readonly isOffered = $derived(this.canBuy || this.canPass)

    readonly placement = $derived(
        this.canTake(ActionType.PlaceTile) ? this.pendingPlacement : undefined
    )
    readonly placementOptions: Placement[] = $derived(
        this.placement
            ? this.grid.legalPlacements(this.placement.tileId, this.placement.faceUp)
            : []
    )
    readonly chosenCell = $derived(this.selection.cell?.value)
    readonly chosenRotation = $derived(this.selection.rotation?.value)
    readonly rotationsForChosenCell: number[] = $derived(
        this.placementOptions.find(
            (option) => this.chosenCell && sameCoordinates(option.cell, this.chosenCell)
        )?.rotations ?? []
    )
    readonly mySupply = $derived(this.myPlayerState?.supply ?? 0)

    toggleRules() {
        this.rulesOpen = !this.rulesOpen
    }

    closeRules() {
        this.rulesOpen = false
    }

    inspectStation(cell: OffsetCoordinates | undefined) {
        this.inspectedCell =
            cell && this.inspectedCell && sameCoordinates(cell, this.inspectedCell)
                ? undefined
                : cell
    }

    async bid(slot: number) {
        await this.applyAction(this.createPlayerAction(PlaceBid, { slot }))
    }

    async buyTile() {
        await this.applyAction(this.createPlayerAction(BuyTile))
    }

    async passTile() {
        await this.applyAction(this.createPlayerAction(PassTile))
    }

    // A face-down tile has nothing more to choose. A face-up tile then takes a turn, picked for
    // the player when only one fits, and the extra cubes, skipped when the supply is empty.
    async chooseCell(cell: OffsetCoordinates) {
        const placement = this.placement
        if (!placement || this.busy) return
        if (this.chosenCell && sameCoordinates(cell, this.chosenCell)) {
            this.selection = {}
            return
        }
        if (!placement.faceUp) {
            await this.place(cell, 0, 0)
            return
        }
        const option = this.placementOptions.find((candidate) =>
            sameCoordinates(candidate.cell, cell)
        )
        assertExists(option, 'The chosen cell is a legal placement')
        const [only, other] = option.rotations
        if (other === undefined && this.mySupply === 0) {
            await this.place(cell, only, 0)
            return
        }
        const chosen = chooseCell(this.selection, cell)
        this.selection = other === undefined ? chooseRotation(chosen, only, 'auto') : chosen
    }

    async chooseRotation(rotation: number) {
        const cell = this.chosenCell
        assertExists(cell, 'A turn is chosen for a chosen cell')
        if (this.busy) return
        if (this.mySupply === 0) {
            await this.place(cell, rotation, 0)
            return
        }
        this.selection = chooseRotation(this.selection, rotation, 'manual')
    }

    async chooseExtraCubes(extraCubes: number) {
        const cell = this.chosenCell
        const rotation = this.chosenRotation
        assertExists(cell, 'Cubes go on a chosen cell')
        assertExists(rotation, 'Cubes go on a turned tile')
        await this.place(cell, rotation, extraCubes)
    }

    clearPlacement() {
        this.selection = {}
    }

    private async place(cell: OffsetCoordinates, rotation: number, extraCubes: number) {
        await this.applyAction(this.createPlayerAction(PlaceTile, { cell, rotation, extraCubes }))
    }

    private canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }
}
