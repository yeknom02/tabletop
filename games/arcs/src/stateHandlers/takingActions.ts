import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { StandardAction } from '../components/actionCards.js'
import { Resource, Resources } from '../components/resources.js'
import { HydratedTax, isTax } from '../actions/tax.js'
import { HydratedBuildBuilding, isBuildBuilding } from '../actions/buildBuilding.js'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedMoveShips, isMoveShips } from '../actions/moveShips.js'
import { HydratedRepair, isRepair } from '../actions/repair.js'
import { HydratedInfluence, isInfluence } from '../actions/influence.js'
import { HydratedSecure, isSecure } from '../actions/secure.js'
import { HydratedSpendWeapon, isSpendWeapon } from '../actions/spendWeapon.js'
import { HydratedBattle, isBattle } from '../actions/battle.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { endChapter } from './playingCard.js'

type TakingActionsAction =
    | HydratedTax
    | HydratedBuildBuilding
    | HydratedBuildShip
    | HydratedMoveShips
    | HydratedRepair
    | HydratedInfluence
    | HydratedSecure
    | HydratedBattle
    | HydratedSpendWeapon
    | HydratedEndTurn

const ActionsByStandard: ReadonlyArray<[StandardAction, ActionType[]]> = [
    [StandardAction.Tax, [ActionType.Tax]],
    [StandardAction.Build, [ActionType.BuildBuilding, ActionType.BuildShip]],
    [StandardAction.Move, [ActionType.MoveShips]],
    [StandardAction.Repair, [ActionType.Repair]],
    [StandardAction.Influence, [ActionType.Influence]],
    [StandardAction.Secure, [ActionType.Secure]],
    [StandardAction.Battle, [ActionType.Battle]]
]

export class TakingActionsStateHandler implements MachineStateHandler<
    TakingActionsAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is TakingActionsAction {
        const gameState = context.gameState
        const playerId = action.playerId ?? ''
        if (gameState.turn?.playerId !== playerId) {
            return false
        }
        if (isEndTurn(action)) {
            return action.returnTo === undefined
                ? !gameState.isEliminated(playerId)
                : gameState.canReturnFleet(playerId, action.returnTo)
        }
        if (isBattle(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Battle, action.via, action.token) &&
                gameState.canBattle(playerId, action.system, action.defender, action.dice)
            )
        }
        if (isSpendWeapon(action)) {
            return gameState.canSpendResource(playerId, Resource.Weapon, action.token)
        }
        if (isTax(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Tax, action.via, action.token) &&
                gameState.canTax(playerId, action.system, action.slot, action.discard)
            )
        }
        if (isBuildBuilding(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Build, action.via, action.token) &&
                gameState.canBuildBuilding(playerId, action.system, action.building)
            )
        }
        if (isBuildShip(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Build, action.via, action.token) &&
                gameState.canBuildShip(playerId, action.system, action.slot)
            )
        }
        if (isMoveShips(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Move, action.via, action.token) &&
                gameState.canMove(
                    playerId,
                    action.from,
                    action.path,
                    { fresh: action.fresh, damaged: action.damaged },
                    action.dropOffs
                )
            )
        }
        if (isRepair(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Repair, action.via, action.token) &&
                (action.slot === undefined
                    ? gameState.canRepairShip(playerId, action.system)
                    : gameState.canRepairBuilding(playerId, action.system, action.slot))
            )
        }
        if (isInfluence(action)) {
            return (
                gameState.canPay(playerId, StandardAction.Influence, action.via, action.token) &&
                gameState.canInfluence(playerId, action.cardId)
            )
        }
        return (
            isSecure(action) &&
            gameState.canPay(playerId, StandardAction.Secure, action.via, action.token) &&
            gameState.canSecure(playerId, action.cardId)
        )
    }

    // Action types the player could pay for now, by a pip or a resource. Whether a target exists
    // is left to the UI, which highlights the legal ones.
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (gameState.turn?.playerId !== playerId) {
            return []
        }
        const payable = (action: StandardAction) =>
            gameState.canPay(playerId, action, undefined) ||
            Resources.some((via) =>
                Resources.some((token) => gameState.canPay(playerId, action, via, token))
            )
        const actions = ActionsByStandard.filter(([standard]) => payable(standard)).flatMap(
            ([, types]) => types
        )
        if (
            Resources.some((token) => gameState.canSpendResource(playerId, Resource.Weapon, token))
        ) {
            actions.push(ActionType.SpendWeapon)
        }
        actions.push(ActionType.EndTurn)
        return actions
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const turn = context.gameState.turn
        if (turn) {
            context.gameState.activate(turn.playerId)
        }
    }

    onAction(
        action: TakingActionsAction,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        if (isBattle(action)) {
            return context.gameState.battle ? MachineState.Battling : MachineState.TakingActions
        }
        if (!isEndTurn(action)) {
            return MachineState.TakingActions
        }
        const gameState = context.gameState
        if (gameState.nextTurnPlayer()) {
            return MachineState.PlayingCard
        }
        gameState.endRound()
        return gameState.anyCardsLeft() ? MachineState.PlayingCard : endChapter(context)
    }
}
