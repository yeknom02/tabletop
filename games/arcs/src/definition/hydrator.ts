import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedArcsGameState, type ArcsProjectedState } from '../model/gameState.js'
import { HydratedDraftCard, isDraftCard } from '../actions/draftCard.js'
import { HydratedKeepHand, isKeepHand } from '../actions/keepHand.js'
import { HydratedRedrawHand, isRedrawHand } from '../actions/redrawHand.js'
import { HydratedLeadCard, isLeadCard } from '../actions/leadCard.js'
import { HydratedPassInitiative, isPassInitiative } from '../actions/passInitiative.js'
import { HydratedFollowCard, isFollowCard } from '../actions/followCard.js'
import { HydratedSpendWeapon, isSpendWeapon } from '../actions/spendWeapon.js'
import { HydratedTax, isTax } from '../actions/tax.js'
import { HydratedBuildBuilding, isBuildBuilding } from '../actions/buildBuilding.js'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedMoveShips, isMoveShips } from '../actions/moveShips.js'
import { HydratedRepair, isRepair } from '../actions/repair.js'
import { HydratedInfluence, isInfluence } from '../actions/influence.js'
import { HydratedSecure, isSecure } from '../actions/secure.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedDealHands, isDealHands } from '../actions/dealHands.js'
import { HydratedEndChapter, isEndChapter } from '../actions/endChapter.js'

export class ArcsHydrator implements GameHydrator<ArcsProjectedState, HydratedArcsGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isDraftCard(data): {
                return new HydratedDraftCard(data)
            }
            case isKeepHand(data): {
                return new HydratedKeepHand(data)
            }
            case isRedrawHand(data): {
                return new HydratedRedrawHand(data)
            }
            case isLeadCard(data): {
                return new HydratedLeadCard(data)
            }
            case isPassInitiative(data): {
                return new HydratedPassInitiative(data)
            }
            case isFollowCard(data): {
                return new HydratedFollowCard(data)
            }
            case isSpendWeapon(data): {
                return new HydratedSpendWeapon(data)
            }
            case isTax(data): {
                return new HydratedTax(data)
            }
            case isBuildBuilding(data): {
                return new HydratedBuildBuilding(data)
            }
            case isBuildShip(data): {
                return new HydratedBuildShip(data)
            }
            case isMoveShips(data): {
                return new HydratedMoveShips(data)
            }
            case isRepair(data): {
                return new HydratedRepair(data)
            }
            case isInfluence(data): {
                return new HydratedInfluence(data)
            }
            case isSecure(data): {
                return new HydratedSecure(data)
            }
            case isEndTurn(data): {
                return new HydratedEndTurn(data)
            }
            case isDealHands(data): {
                return new HydratedDealHands(data)
            }
            case isEndChapter(data): {
                return new HydratedEndChapter(data)
            }
            default: {
                throw new Error(`Unknown action type ${data.type}`)
            }
        }
    }

    hydrateState(state: ArcsProjectedState): HydratedArcsGameState {
        return new HydratedArcsGameState(state)
    }
}
