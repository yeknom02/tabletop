import { ActionType } from './actions.js'
import { PlaceBid } from '../actions/placeBid.js'
import { BuyTile } from '../actions/buyTile.js'
import { PassTile } from '../actions/passTile.js'
import { PlaceTile } from '../actions/placeTile.js'

export const ConduitApiActions = {
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.BuyTile]: BuyTile,
    [ActionType.PassTile]: PassTile,
    [ActionType.PlaceTile]: PlaceTile
}
