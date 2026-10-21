import { KeepLore } from '../actions/keepLore.js'
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
import { Ruthless } from '../actions/ruthless.js'
import { Mythic } from '../actions/mythic.js'
import { UseLore } from '../actions/useLore.js'
import { Tax } from '../actions/tax.js'
import { BuildBuilding } from '../actions/buildBuilding.js'
import { BuildShip } from '../actions/buildShip.js'
import { MoveShips } from '../actions/moveShips.js'
import { Repair } from '../actions/repair.js'
import { Influence } from '../actions/influence.js'
import { Secure } from '../actions/secure.js'
import { Battle } from '../actions/battle.js'
import { RollDice } from '../actions/rollDice.js'
import { MoveInBySensors } from '../actions/moveInBySensors.js'
import { FireRifles } from '../actions/fireRifles.js'
import { Reroll } from '../actions/reroll.js'
import { AssignHits } from '../actions/assignHits.js'
import { Ransack } from '../actions/ransack.js'
import { Raid } from '../actions/raid.js'
import { EndBattle } from '../actions/endBattle.js'
import { BelovedInfluence } from '../actions/belovedInfluence.js'
import { GiveGuildCard } from '../actions/giveGuildCard.js'
import { ResolveConnected } from '../actions/resolveConnected.js'
import { GainOnDeclaring } from '../actions/gainOnDeclaring.js'
import { BoldInfluence } from '../actions/boldInfluence.js'
import { Farsee } from '../actions/farsee.js'
import { SwapWithRival } from '../actions/swapWithRival.js'
import { EndTurn } from '../actions/endTurn.js'
import { ActionType } from './actions.js'

export const ArcsApiActions = {
    [ActionType.DraftCard]: DraftCard,
    [ActionType.KeepLore]: KeepLore,
    [ActionType.KeepHand]: KeepHand,
    [ActionType.RedrawHand]: RedrawHand,
    [ActionType.LeadCard]: LeadCard,
    [ActionType.PassInitiative]: PassInitiative,
    [ActionType.FollowCard]: FollowCard,
    [ActionType.SpendWeapon]: SpendWeapon,
    [ActionType.UseCard]: UseCard,
    [ActionType.UseFarseers]: UseFarseers,
    [ActionType.TakeNewAction]: TakeNewAction,
    [ActionType.Ruthless]: Ruthless,
    [ActionType.Mythic]: Mythic,
    [ActionType.UseLore]: UseLore,
    [ActionType.Tax]: Tax,
    [ActionType.BuildBuilding]: BuildBuilding,
    [ActionType.BuildShip]: BuildShip,
    [ActionType.MoveShips]: MoveShips,
    [ActionType.Repair]: Repair,
    [ActionType.Influence]: Influence,
    [ActionType.Secure]: Secure,
    [ActionType.Battle]: Battle,
    [ActionType.RollDice]: RollDice,
    [ActionType.MoveInBySensors]: MoveInBySensors,
    [ActionType.FireRifles]: FireRifles,
    [ActionType.Reroll]: Reroll,
    [ActionType.AssignHits]: AssignHits,
    [ActionType.Ransack]: Ransack,
    [ActionType.Raid]: Raid,
    [ActionType.EndBattle]: EndBattle,
    [ActionType.BelovedInfluence]: BelovedInfluence,
    [ActionType.GiveGuildCard]: GiveGuildCard,
    [ActionType.ResolveConnected]: ResolveConnected,
    [ActionType.GainOnDeclaring]: GainOnDeclaring,
    [ActionType.BoldInfluence]: BoldInfluence,
    [ActionType.Farsee]: Farsee,
    [ActionType.SwapWithRival]: SwapWithRival,
    [ActionType.EndTurn]: EndTurn
}
