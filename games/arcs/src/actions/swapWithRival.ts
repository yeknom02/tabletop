import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { ActionCardIdSchema } from '../components/actionCards.js'
import { ActionType } from '../definition/actions.js'
import { HydratedArcsGameState } from '../model/gameState.js'

// Farseers: swap one card with the Rival whose hand was seen, or neither. Which cards is hidden
// from everyone else.
export type SwapWithRival = Type.Static<typeof SwapWithRival>
export const SwapWithRival = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SwapWithRival),
            playerId: Type.String(),
            give: Type.Optional(
                Visibility.protect(ActionCardIdSchema, { policy: Visibility.Policy.Actor })
            ),
            take: Type.Optional(
                Visibility.protect(ActionCardIdSchema, { policy: Visibility.Policy.Actor })
            )
        })
    ])
)

export const SwapWithRivalValidator = Compile(SwapWithRival)

export function isSwapWithRival(action?: GameAction): action is SwapWithRival {
    return action?.type === ActionType.SwapWithRival
}

export class HydratedSwapWithRival
    extends HydratableAction<typeof SwapWithRival>
    implements SwapWithRival
{
    declare type: ActionType.SwapWithRival
    declare playerId: string
    declare give?: string
    declare take?: string

    constructor(data: SwapWithRival) {
        super(data, SwapWithRivalValidator)
    }

    apply(state: HydratedArcsGameState) {
        state.swapWithRival(this.playerId, this.give, this.take)
    }
}
