import * as Type from 'typebox'
import { BaseConfigurator, ConfigOptionType, GameConfigOptions } from '@tabletop/common'

// Lore cards each player drafts with their leader. "None" plays without leaders or lore.
export enum LeadersAndLore {
    None = 'none',
    OneLore = '1',
    TwoLore = '2',
    ThreeLore = '3',
    FourLore = '4',
    FiveLore = '5'
}

export type ArcsGameConfig = Type.Static<typeof ArcsGameConfig>
export const ArcsGameConfig = Type.Object({
    leadersAndLore: Type.Enum(LeadersAndLore),
    splitDiscards: Type.Boolean()
})

export const ArcsGameConfigOptions: GameConfigOptions = [
    {
        id: 'leadersAndLore',
        type: ConfigOptionType.List,
        name: 'Leaders and lore',
        description: 'Each player drafts a leader and lore before the game',
        default: LeadersAndLore.OneLore,
        options: [
            { name: '1 lore each', value: LeadersAndLore.OneLore },
            {
                name: '2 lore each (L2L)',
                value: LeadersAndLore.TwoLore,
                description: 'Rule 11.1.3.1, Extra Lore'
            },
            { name: '3 lore each', value: LeadersAndLore.ThreeLore },
            { name: '4 lore each', value: LeadersAndLore.FourLore },
            { name: '5 lore each', value: LeadersAndLore.FiveLore },
            {
                name: 'None',
                value: LeadersAndLore.None,
                description: 'Start where the setup card says, with no leaders or lore'
            }
        ],
        alwaysShow: true
    },
    {
        id: 'splitDiscards',
        type: ConfigOptionType.Boolean,
        name: 'Split discard piles',
        description:
            'Cards played face up stay visible in their own discard pile until the chapter ends (rule 22.8)',
        default: false
    }
]

export function lorePerPlayer(leadersAndLore: LeadersAndLore): number {
    return leadersAndLore === LeadersAndLore.None ? 0 : Number(leadersAndLore)
}

export class ArcsConfigurator extends BaseConfigurator {
    schema = ArcsGameConfig
    options = ArcsGameConfigOptions
}
