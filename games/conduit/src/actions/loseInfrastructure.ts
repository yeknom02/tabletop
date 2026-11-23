import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, type MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { cubesPerRound } from '../definition/gameConfig.js'
import { HydratedConduitGameState, Payment } from '../model/gameState.js'

export type InfrastructureLost = Type.Static<typeof InfrastructureLost>
export const InfrastructureLost = Type.Object({
    flippedTileIds: Type.Array(Type.Integer()),
    // Cubes each player moved from reserve to supply as the round ended.
    refills: Type.Array(Payment),
    roundEnded: Type.Boolean()
})

export type LoseInfrastructure = Type.Static<typeof LoseInfrastructure>
export const LoseInfrastructure = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.LoseInfrastructure),
            metadata: Type.Optional(InfrastructureLost)
        })
    ])
)

export const LoseInfrastructureValidator = Compile(LoseInfrastructure)

export function isLoseInfrastructure(action?: GameAction): action is LoseInfrastructure {
    return action?.type === ActionType.LoseInfrastructure
}

export class HydratedLoseInfrastructure
    extends HydratableAction<typeof LoseInfrastructure>
    implements LoseInfrastructure
{
    declare type: ActionType.LoseInfrastructure
    declare metadata?: InfrastructureLost

    constructor(data: LoseInfrastructure) {
        super(data, LoseInfrastructureValidator)
    }

    // The payouts after the fifth round are not rounds of their own, so only a round in progress ends.
    apply(state: HydratedConduitGameState, context?: MachineContext) {
        assertExists(context, 'Infrastructure loss reads the game configuration')
        const flippedTileIds = state.loseInfrastructure()
        const roundEnded = state.roundManager.currentRound !== undefined
        const refills = roundEnded ? state.endRound(cubesPerRound(context.gameConfig)) : []
        this.metadata = { flippedTileIds, refills, roundEnded }
    }
}
