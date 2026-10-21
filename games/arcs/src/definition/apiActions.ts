import { DraftCard } from '../actions/draftCard.js'
import { KeepHand } from '../actions/keepHand.js'
import { RedrawHand } from '../actions/redrawHand.js'
import { LeadCard } from '../actions/leadCard.js'
import { PassInitiative } from '../actions/passInitiative.js'
import { FollowCard } from '../actions/followCard.js'
import { SpendWeapon } from '../actions/spendWeapon.js'
import { UseCard } from '../actions/useCard.js'
import { UseFarseers } from '../actions/useFarseers.js'
import { TakeNewAction } from '../actions/takeNewAction.js'
import { Tax } from '../actions/tax.js'
import { BuildBuilding } from '../actions/buildBuilding.js'
import { BuildShip } from '../actions/buildShip.js'
import { MoveShips } from '../actions/moveShips.js'
import { Repair } from '../actions/repair.js'
import { Influence } from '../actions/influence.js'
import { Secure } from '../actions/secure.js'
import { Battle } from '../actions/battle.js'
import { Reroll } from '../actions/reroll.js'
import { AssignHits } from '../actions/assignHits.js'
import { Ransack } from '../actions/ransack.js'
import { Raid } from '../actions/raid.js'
import { EndBattle } from '../actions/endBattle.js'
import { Farsee } from '../actions/farsee.js'
import { SwapWithRival } from '../actions/swapWithRival.js'
import { EndTurn } from '../actions/endTurn.js'
import { ActionType } from './actions.js'

export const ArcsApiActions = {
    [ActionType.DraftCard]: DraftCard,
    [ActionType.KeepHand]: KeepHand,
    [ActionType.RedrawHand]: RedrawHand,
    [ActionType.LeadCard]: LeadCard,
    [ActionType.PassInitiative]: PassInitiative,
    [ActionType.FollowCard]: FollowCard,
    [ActionType.SpendWeapon]: SpendWeapon,
    [ActionType.UseCard]: UseCard,
    [ActionType.UseFarseers]: UseFarseers,
    [ActionType.TakeNewAction]: TakeNewAction,
    [ActionType.Tax]: Tax,
    [ActionType.BuildBuilding]: BuildBuilding,
    [ActionType.BuildShip]: BuildShip,
    [ActionType.MoveShips]: MoveShips,
    [ActionType.Repair]: Repair,
    [ActionType.Influence]: Influence,
    [ActionType.Secure]: Secure,
    [ActionType.Battle]: Battle,
    [ActionType.Reroll]: Reroll,
    [ActionType.AssignHits]: AssignHits,
    [ActionType.Ransack]: Ransack,
    [ActionType.Raid]: Raid,
    [ActionType.EndBattle]: EndBattle,
    [ActionType.Farsee]: Farsee,
    [ActionType.SwapWithRival]: SwapWithRival,
    [ActionType.EndTurn]: EndTurn
}
