import {
    ActionSource,
    assert,
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
import { canUseCard } from '../model/courtEffects.js'
import { canTakeNewAction, hasNewAction, NewActions } from '../model/newActions.js'
import { NewActionName } from '../model/newActionTypes.js'
import { HydratedUseFarseers, isUseFarseers } from '../actions/useFarseers.js'
import { HydratedTakeNewAction, isTakeNewAction } from '../actions/takeNewAction.js'
import {
    DrawActionCard,
    HydratedDrawActionCard,
    isDrawActionCard
} from '../actions/drawActionCard.js'
import { Court } from '../components/courtCards.js'
import { Leader, Lore } from '../components/personas.js'
import { HydratedRuthless, isRuthless } from '../actions/ruthless.js'
import { HydratedMythic, isMythic } from '../actions/mythic.js'
import { HydratedUseLore, isUseLore } from '../actions/useLore.js'
import { canUseLore } from '../model/loreEffects.js'
import { HydratedFireRifles, isFireRifles } from '../actions/fireRifles.js'
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
    | HydratedFireRifles
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
            if (gameState.turn?.owed !== undefined && gameState.canTakeOwed(playerId)) {
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
            return this.canPayThen(
                gameState,
                playerId,
                NewActions[action.name].replaces,
                action,
                (state) => canTakeNewAction(state, playerId, action)
            )
        }
        if (isUseLore(action)) {
            return canUseLore(gameState, playerId, action)
        }
        if (isUseCard(action)) {
            return canUseCard(gameState, playerId, action)
        }
        if (isFireRifles(action)) {
            return this.canPayThen(gameState, playerId, StandardAction.Battle, action, (state) =>
                state.canFireRifles(playerId, action.system, action.target, action.defender)
            )
        }
        if (isBattle(action)) {
            return (
                (action.dice !== undefined) === (action.revealsInfo === true) &&
                this.canPayThen(gameState, playerId, StandardAction.Battle, action, (state) =>
                    state.canBattle(
                        playerId,
                        action.system,
                        action.defender,
                        action.dice,
                        action.railgun
                    )
                )
            )
        }
        if (isSpendWeapon(action)) {
            return gameState.canSpendResource(playerId, Resource.Weapon, action.token)
        }
        if (isTax(action)) {
            const copyOrPivotPip = gameState.copyOrPivotPip(action.via)
            return this.canPayThen(gameState, playerId, StandardAction.Tax, action, (state) =>
                state.canTax(
                    playerId,
                    action.system,
                    action.slot,
                    action.discard,
                    copyOrPivotPip,
                    action.cityType
                )
            )
        }
        if (isBuildBuilding(action)) {
            return this.canPayThen(gameState, playerId, StandardAction.Build, action, (state) =>
                state.canBuildBuilding(playerId, action.system, action.building)
            )
        }
        if (isBuildShip(action)) {
            return this.canPayThen(gameState, playerId, StandardAction.Build, action, (state) =>
                state.canBuildShip(playerId, action.system, action.slot)
            )
        }
        if (isMoveShips(action)) {
            return this.canPayThen(gameState, playerId, StandardAction.Move, action, (state) =>
                state.canMoveWithSprint(playerId, action, action.sprint)
            )
        }
        if (isRepair(action)) {
            return this.canPayThen(gameState, playerId, StandardAction.Repair, action, (state) =>
                action.slot === undefined
                    ? state.canRepairShip(playerId, action.system)
                    : state.canRepairBuilding(playerId, action.system, action.slot)
            )
        }
        if (isInfluence(action)) {
            return this.canPayThen(gameState, playerId, StandardAction.Influence, action, (state) =>
                state.canInfluence(playerId, action.cardId)
            )
        }
        return (
            isSecure(action) &&
            this.canPayThen(gameState, playerId, StandardAction.Secure, action, (state) =>
                state.canSecure(playerId, action.cardId, action.vox)
            )
        )
    }

    // The action's own conditions hold once it is paid for: spending a resource token can open a
    // slot, or end the Prelude.
    private canPayThen(
        gameState: HydratedArcsGameState,
        playerId: string,
        standard: StandardAction,
        payment: { via?: Resource; token?: Resource; bonus?: boolean },
        check: (state: HydratedArcsGameState) => boolean
    ): boolean {
        const { via, token, bonus = false } = payment
        return (
            gameState.canPay(playerId, standard, via, token, bonus) &&
            gameState.wouldSucceed((state) => {
                state.pay(playerId, standard, via, token, bonus)
                assert(check(state), 'The action cannot be taken once paid for')
            })
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
        if (gameState.hasLore(playerId, Lore.GalacticRifles) && payable(StandardAction.Battle)) {
            actions.push(ActionType.FireRifles)
        }
        if (
            Object.values(NewActionName).some(
                (name) =>
                    hasNewAction(gameState, playerId, name) && payable(NewActions[name].replaces)
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
        if (isBattle(action) || isFireRifles(action)) {
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
