import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { anyRerolls, BattleStep } from '../model/battle.js'
import { HydratedAssignHits, isAssignHits } from '../actions/assignHits.js'
import { HydratedReroll, isReroll } from '../actions/reroll.js'
import { HydratedRansack, isRansack } from '../actions/ransack.js'
import { HydratedRaid, isRaid } from '../actions/raid.js'
import { HydratedEndBattle, isEndBattle } from '../actions/endBattle.js'
import { HydratedBelovedInfluence, isBelovedInfluence } from '../actions/belovedInfluence.js'
import {
    DrawActionCard,
    HydratedDrawActionCard,
    isDrawActionCard
} from '../actions/drawActionCard.js'
import { Court } from '../components/courtCards.js'
import { afterDeclaring } from './declaring.js'

type BattlingAction =
    | HydratedReroll
    | HydratedAssignHits
    | HydratedRansack
    | HydratedRaid
    | HydratedEndBattle
    | HydratedBelovedInfluence
    | HydratedDrawActionCard

// The attacker resolves their battle step by step; the turn resumes once it is over.
export class BattlingStateHandler implements MachineStateHandler<
    BattlingAction,
    HydratedArcsGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedArcsGameState>
    ): action is BattlingAction {
        const gameState = context.gameState
        if (isDrawActionCard(action)) {
            return action.source === ActionSource.System
        }
        const playerId = action.playerId ?? ''
        if (isAssignHits(action)) {
            return gameState.canAssignHits(
                playerId,
                action.attacking,
                action.defending,
                action.buildings
            )
        }
        if (isReroll(action)) {
            return gameState.canReroll(playerId, action.dice)
        }
        if (isRansack(action)) {
            return gameState.canRansack(playerId, action.cardId, action.vox)
        }
        if (isRaid(action)) {
            return gameState.canRaid(
                playerId,
                { slot: action.slot, cardId: action.cardId },
                action.discard
            )
        }
        if (isBelovedInfluence(action)) {
            return gameState.canBelovedInfluence(playerId, action.cardId)
        }
        return isEndBattle(action) && gameState.canEndBattle(playerId)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const battle = context.gameState.battle
        if (!battle || context.gameState.battleChooser() !== playerId) {
            return []
        }
        switch (battle.step) {
            case BattleStep.Beloved:
                return [ActionType.BelovedInfluence]
            case BattleStep.Hits:
                return anyRerolls(battle.rerolls)
                    ? [ActionType.Reroll, ActionType.AssignHits]
                    : [ActionType.AssignHits]
            case BattleStep.Ransack:
                return [ActionType.Ransack]
            case BattleStep.Raid:
                return [ActionType.Raid, ActionType.EndBattle]
        }
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        if (context.gameState.battle) {
            context.gameState.activate(context.gameState.battleChooser())
        }
    }

    onAction(action: BattlingAction, context: MachineContext<HydratedArcsGameState>): MachineState {
        if (isRansack(action) && action.cardId === Court.CallToAction) {
            context.addSystemAction(DrawActionCard, {
                drawer: action.playerId,
                revealsInfo: true
            })
        }
        const next = afterDeclaring(context.gameState)
        if (next === MachineState.Battling) {
            context.gameState.activate(context.gameState.battleChooser())
        }
        return next
    }
}
