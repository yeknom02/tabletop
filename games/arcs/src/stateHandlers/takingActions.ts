import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
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
import { HydratedUseCard, isUseCard } from '../actions/useCard.js'
import { canTakeNewAction, canUseCard, NewActions } from '../model/courtEffects.js'
import { HydratedUseFarseers, isUseFarseers } from '../actions/useFarseers.js'
import { HydratedTakeNewAction, isTakeNewAction } from '../actions/takeNewAction.js'
import {
    DrawActionCard,
    HydratedDrawActionCard,
    isDrawActionCard
} from '../actions/drawActionCard.js'
import { Court } from '../components/courtCards.js'
import { Leader } from '../components/personas.js'
import { HydratedRuthless, isRuthless } from '../actions/ruthless.js'
import { HydratedMythic, isMythic } from '../actions/mythic.js'
import { HydratedUseLore, isUseLore } from '../actions/useLore.js'
import { canUseLore } from '../model/loreEffects.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { endChapter } from './playingCard.js'
import { afterDeclaring } from './declaring.js'

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
    | HydratedUseCard
    | HydratedUseFarseers
    | HydratedUseLore
    | HydratedTakeNewAction
    | HydratedRuthless
    | HydratedMythic
    | HydratedDrawActionCard
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
        if (isDrawActionCard(action)) {
            return action.source === ActionSource.System
        }
        const playerId = action.playerId ?? ''
        if (gameState.turn?.playerId !== playerId) {
            return false
        }
        if (isEndTurn(action)) {
            if (gameState.turn?.owed !== undefined) {
                return false
            }
            return action.returnTo === undefined
                ? !gameState.isEliminated(playerId)
                : gameState.canReturnFleet(playerId, action.returnTo)
        }
        if (isUseFarseers(action)) {
            return gameState.canUseFarseers(playerId, action.discards)
        }
        if (isRuthless(action)) {
            return gameState.canRuthless(playerId, action)
        }
        if (isMythic(action)) {
            return gameState.canMythic(playerId, action.resource)
        }
        if (isTakeNewAction(action)) {
            return (
                gameState.canPay(
                    playerId,
                    NewActions[action.name].replaces,
                    action.via,
                    action.token
                ) && canTakeNewAction(gameState, playerId, action)
            )
        }
        if (isUseLore(action)) {
            return canUseLore(gameState, playerId, action)
        }
        if (isUseCard(action)) {
            return canUseCard(gameState, playerId, action)
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
                gameState.canTax(
                    playerId,
                    action.system,
                    action.slot,
                    action.discard,
                    gameState.copyOrPivotPip(action.via)
                )
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
                gameState.canPay(
                    playerId,
                    StandardAction.Move,
                    action.via,
                    action.token,
                    action.bonus
                ) &&
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
                gameState.canPay(
                    playerId,
                    StandardAction.Influence,
                    action.via,
                    action.token,
                    action.bonus
                ) && gameState.canInfluence(playerId, action.cardId)
            )
        }
        return (
            isSecure(action) &&
            gameState.canPay(playerId, StandardAction.Secure, action.via, action.token) &&
            gameState.canSecure(playerId, action.cardId, action.vox)
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
            gameState.bonusSource(playerId, action) !== undefined ||
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
        if (
            Object.values(NewActions).some(
                ({ cardId, replaces }) => gameState.holds(playerId, cardId) && payable(replaces)
            )
        ) {
            actions.push(ActionType.TakeNewAction)
        }
        const turn = gameState.turn
        if (
            turn.prelude &&
            gameState
                .getPlayerState(playerId)
                .guildCards.some((cardId) => !turn.securedInPrelude.includes(cardId))
        ) {
            actions.push(ActionType.UseCard)
        }
        if (turn.prelude && gameState.getPlayerState(playerId).lore.length > 0) {
            actions.push(ActionType.UseLore)
        }
        if (gameState.canUseFarseers(playerId, [])) {
            actions.push(ActionType.UseFarseers)
        }
        const last = gameState.turn.lastBuildingAction
        if (
            last !== undefined &&
            gameState.isLeader(playerId, Leader.Overseer) &&
            !gameState.turn.usedCards.includes(Leader.Overseer)
        ) {
            actions.push(ActionType.Ruthless)
        }
        if (last?.kind === 'tax' && gameState.isLeader(playerId, Leader.Shaper)) {
            actions.push(ActionType.Mythic)
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
            return afterDeclaring(context.gameState)
        }
        const secured = isSecure(action)
            ? action.cardId
            : isUseLore(action)
              ? action.secure
              : undefined
        if (secured === Court.CallToAction && action.playerId !== undefined) {
            context.addSystemAction(DrawActionCard, {
                drawer: action.playerId,
                revealsInfo: true
            })
        }
        if (!isEndTurn(action)) {
            return afterDeclaring(context.gameState)
        }
        const gameState = context.gameState
        if (gameState.nextTurnPlayer()) {
            return MachineState.PlayingCard
        }
        gameState.endRound()
        return gameState.anyCardsLeft() ? MachineState.PlayingCard : endChapter(context)
    }
}
