import { GameSession } from '@tabletop/frontend-components'
import { assertExists } from '@tabletop/common'
import {
    actionCard,
    ActionType,
    Ambition,
    declarableAmbitions,
    DraftCard,
    DraftKind,
    EndTurn,
    FollowCard,
    KeepHand,
    LeadCard,
    MachineState,
    PassInitiative,
    PlayKind,
    RedrawHand,
    type HydratedArcsGameState,
    type ArcsProjectedState,
    type SystemId
} from '@tabletop/arcs'

export type HandCardChoice = {
    cardId: string
    lead: boolean
    declare: Ambition[]
    follow: PlayKind[]
}

export class ArcsGameSession extends GameSession<ArcsProjectedState, HydratedArcsGameState> {
    private readonly canAct = $derived(this.isPlayable && !this.isViewingHistory && this.isMyTurn)

    readonly canUndo = $derived(
        this.isPlayable && !this.isViewingHistory && Boolean(this.undoableAction)
    )

    readonly machineState = $derived(this.gameState.machineState)

    readonly isDrafting = $derived(this.canTake(ActionType.DraftCard))
    readonly isMulliganing = $derived(this.canTake(ActionType.KeepHand))
    readonly isPlayingCard = $derived(this.canAct && this.machineState === MachineState.PlayingCard)
    readonly isTakingActions = $derived(
        this.canAct && this.machineState === MachineState.TakingActions
    )

    readonly myHand: string[] = $derived(this.myPlayerState?.hand ?? [])

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

    readonly possessiveName = (playerId: string): string =>
        playerId === this.myPlayer?.id ? 'your' : `${this.getPlayerName(playerId)}'s`

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

    canTake(type: ActionType): boolean {
        return this.canAct && this.validActionTypes.includes(type)
    }

    myPlayerId(): string {
        assertExists(this.myPlayer, 'Only a seated player acts')
        return this.myPlayer.id
    }
}
