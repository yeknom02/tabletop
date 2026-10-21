import { GameAction, type GameHydrator, type HydratedAction } from '@tabletop/common'
import { HydratedArcsGameState, type ArcsProjectedState } from '../model/gameState.js'
import { HydratedDrawArchive, isDrawArchive } from '../actions/drawArchive.js'
import { HydratedKeepLore, isKeepLore } from '../actions/keepLore.js'
import { HydratedDraftCard, isDraftCard } from '../actions/draftCard.js'
import { HydratedKeepHand, isKeepHand } from '../actions/keepHand.js'
import { HydratedRedrawHand, isRedrawHand } from '../actions/redrawHand.js'
import { HydratedLeadCard, isLeadCard } from '../actions/leadCard.js'
import { HydratedPassInitiative, isPassInitiative } from '../actions/passInitiative.js'
import { HydratedFollowCard, isFollowCard } from '../actions/followCard.js'
import { HydratedSpendWeapon, isSpendWeapon } from '../actions/spendWeapon.js'
import { HydratedUseCard, isUseCard } from '../actions/useCard.js'
import { HydratedUseFarseers, isUseFarseers } from '../actions/useFarseers.js'
import { HydratedTakeNewAction, isTakeNewAction } from '../actions/takeNewAction.js'
import { HydratedRuthless, isRuthless } from '../actions/ruthless.js'
import { HydratedMythic, isMythic } from '../actions/mythic.js'
import { HydratedUseLore, isUseLore } from '../actions/useLore.js'
import { HydratedTax, isTax } from '../actions/tax.js'
import { HydratedBuildBuilding, isBuildBuilding } from '../actions/buildBuilding.js'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedMoveShips, isMoveShips } from '../actions/moveShips.js'
import { HydratedRepair, isRepair } from '../actions/repair.js'
import { HydratedInfluence, isInfluence } from '../actions/influence.js'
import { HydratedSecure, isSecure } from '../actions/secure.js'
import { HydratedBattle, isBattle } from '../actions/battle.js'
import { HydratedRollDice, isRollDice } from '../actions/rollDice.js'
import { HydratedMoveInBySensors, isMoveInBySensors } from '../actions/moveInBySensors.js'
import { HydratedFireRifles, isFireRifles } from '../actions/fireRifles.js'
import { HydratedReroll, isReroll } from '../actions/reroll.js'
import { HydratedAssignHits, isAssignHits } from '../actions/assignHits.js'
import { HydratedRansack, isRansack } from '../actions/ransack.js'
import { HydratedRaid, isRaid } from '../actions/raid.js'
import { HydratedEndBattle, isEndBattle } from '../actions/endBattle.js'
import { HydratedBelovedInfluence, isBelovedInfluence } from '../actions/belovedInfluence.js'
import { HydratedGiveGuildCard, isGiveGuildCard } from '../actions/giveGuildCard.js'
import { HydratedResolveConnected, isResolveConnected } from '../actions/resolveConnected.js'
import { HydratedGainOnDeclaring, isGainOnDeclaring } from '../actions/gainOnDeclaring.js'
import { HydratedBoldInfluence, isBoldInfluence } from '../actions/boldInfluence.js'
import { HydratedDrawCourtCard, isDrawCourtCard } from '../actions/drawCourtCard.js'
import { HydratedFarsee, isFarsee } from '../actions/farsee.js'
import { HydratedSwapWithRival, isSwapWithRival } from '../actions/swapWithRival.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedDrawActionCard, isDrawActionCard } from '../actions/drawActionCard.js'
import { HydratedDealHands, isDealHands } from '../actions/dealHands.js'
import { HydratedEndChapter, isEndChapter } from '../actions/endChapter.js'

export class ArcsHydrator implements GameHydrator<ArcsProjectedState, HydratedArcsGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isDrawArchive(data): {
                return new HydratedDrawArchive(data)
            }
            case isKeepLore(data): {
                return new HydratedKeepLore(data)
            }
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
            case isUseCard(data): {
                return new HydratedUseCard(data)
            }
            case isUseFarseers(data): {
                return new HydratedUseFarseers(data)
            }
            case isTakeNewAction(data): {
                return new HydratedTakeNewAction(data)
            }
            case isRuthless(data): {
                return new HydratedRuthless(data)
            }
            case isMythic(data): {
                return new HydratedMythic(data)
            }
            case isUseLore(data): {
                return new HydratedUseLore(data)
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
            case isBattle(data): {
                return new HydratedBattle(data)
            }
            case isRollDice(data): {
                return new HydratedRollDice(data)
            }
            case isMoveInBySensors(data): {
                return new HydratedMoveInBySensors(data)
            }
            case isFireRifles(data): {
                return new HydratedFireRifles(data)
            }
            case isReroll(data): {
                return new HydratedReroll(data)
            }
            case isAssignHits(data): {
                return new HydratedAssignHits(data)
            }
            case isRansack(data): {
                return new HydratedRansack(data)
            }
            case isRaid(data): {
                return new HydratedRaid(data)
            }
            case isEndBattle(data): {
                return new HydratedEndBattle(data)
            }
            case isBelovedInfluence(data): {
                return new HydratedBelovedInfluence(data)
            }
            case isGiveGuildCard(data): {
                return new HydratedGiveGuildCard(data)
            }
            case isResolveConnected(data): {
                return new HydratedResolveConnected(data)
            }
            case isGainOnDeclaring(data): {
                return new HydratedGainOnDeclaring(data)
            }
            case isBoldInfluence(data): {
                return new HydratedBoldInfluence(data)
            }
            case isDrawCourtCard(data): {
                return new HydratedDrawCourtCard(data)
            }
            case isFarsee(data): {
                return new HydratedFarsee(data)
            }
            case isSwapWithRival(data): {
                return new HydratedSwapWithRival(data)
            }
            case isEndTurn(data): {
                return new HydratedEndTurn(data)
            }
            case isDrawActionCard(data): {
                return new HydratedDrawActionCard(data)
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
