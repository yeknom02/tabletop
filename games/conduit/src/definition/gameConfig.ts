import * as Type from 'typebox'
import { ConfigOptionType, type GameConfigOptions } from '@tabletop/common'

export const DefaultCubesPerRound = 2

export type ConduitGameConfig = Type.Static<typeof ConduitGameConfig>
// Rule variants the designer is testing with bots. They are not offered when creating a game.
export enum RouteTarget {
    NextLetter = 'next',
    SameLetter = 'same'
}

export enum StartPlayerRule {
    Clockwise = 'clockwise',
    Richest = 'richest'
}

// The option offers 2 to 4, but any value from 0 to 9 is accepted so bot studies can try others.
export const ConduitGameConfig = Type.Object({
    cubesPerRound: Type.Optional(Type.String({ pattern: '^[0-9]$' })),
    routeTarget: Type.Optional(Type.Enum(RouteTarget)),
    startPlayer: Type.Optional(Type.Enum(StartPlayerRule))
})

// The designer is playtesting how many cubes move from reserve to supply each round.
export const ConduitGameConfigOptions: GameConfigOptions = [
    {
        id: 'cubesPerRound',
        type: ConfigOptionType.List,
        name: 'Cubes per round',
        description:
            'How many cubes each player moves from reserve to supply at the end of a round',
        default: String(DefaultCubesPerRound),
        options: [
            { name: '2', value: '2' },
            { name: '3', value: '3' },
            { name: '4', value: '4' }
        ]
    }
]

export function routeTargetOf(config: { routeTarget?: unknown }): RouteTarget {
    return config.routeTarget === RouteTarget.SameLetter
        ? RouteTarget.SameLetter
        : RouteTarget.NextLetter
}

export function startPlayerRuleOf(config: { startPlayer?: unknown }): StartPlayerRule {
    return config.startPlayer === StartPlayerRule.Richest
        ? StartPlayerRule.Richest
        : StartPlayerRule.Clockwise
}

export function cubesPerRound(config: { cubesPerRound?: unknown }): number {
    return typeof config.cubesPerRound === 'string'
        ? Number(config.cubesPerRound)
        : DefaultCubesPerRound
}
