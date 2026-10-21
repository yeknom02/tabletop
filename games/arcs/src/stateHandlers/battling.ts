import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'
import { BattleStep } from '../model/battle.js'
import { HydratedAssignHits, isAssignHits } from '../actions/assignHits.js'
import { HydratedRansack, isRansack } from '../actions/ransack.js'
import { HydratedRaid, isRaid } from '../actions/raid.js'
import { HydratedEndBattle, isEndBattle } from '../actions/endBattle.js'

type BattlingAction = HydratedAssignHits | HydratedRansack | HydratedRaid | HydratedEndBattle

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
        const playerId = action.playerId ?? ''
        if (isAssignHits(action)) {
            return gameState.canAssignHits(
                playerId,
                action.attacking,
                action.defending,
                action.buildings
            )
        }
        if (isRansack(action)) {
            return gameState.canRansack(playerId, action.cardId)
        }
        if (isRaid(action)) {
            return gameState.canRaid(
                playerId,
                { slot: action.slot, cardId: action.cardId },
                action.discard
            )
        }
        return isEndBattle(action) && gameState.canEndBattle(playerId)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedArcsGameState>
    ): ActionType[] {
        const battle = context.gameState.battle
        if (battle?.attacker !== playerId) {
            return []
        }
        switch (battle.step) {
            case BattleStep.Hits:
                return [ActionType.AssignHits]
            case BattleStep.Ransack:
                return [ActionType.Ransack]
            case BattleStep.Raid:
                return [ActionType.Raid, ActionType.EndBattle]
        }
    }

    enter(context: MachineContext<HydratedArcsGameState>) {
        const battle = context.gameState.battle
        if (battle) {
            context.gameState.activate(battle.attacker)
        }
    }

    onAction(
        _action: BattlingAction,
        context: MachineContext<HydratedArcsGameState>
    ): MachineState {
        return context.gameState.battle ? MachineState.Battling : MachineState.TakingActions
    }
}
