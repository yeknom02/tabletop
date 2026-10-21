import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { farsee } from '../model/declaration.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Farseers: look at a Rival's hand. Only the looker sees it, so this is a reveal.
export type Farsee = Type.Static<typeof Farsee>
export const Farsee = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.Farsee),
            playerId: Type.String(),
            rival: Type.String(),
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const FarseeValidator = Compile(Farsee)

export function isFarsee(action?: GameAction): action is Farsee {
    return action?.type === ActionType.Farsee
}

export class HydratedFarsee extends HydratableAction<typeof Farsee> implements Farsee {
    declare type: ActionType.Farsee
    declare playerId: string
    declare rival: string
    declare revealsInfo: true

    constructor(data: Farsee) {
        super(data, FarseeValidator)
    }

    apply(state: HydratedArcsGameState) {
        farsee(state, this.playerId, this.rival)
    }
}
