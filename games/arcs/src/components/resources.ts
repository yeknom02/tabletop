import * as Type from 'typebox'

// The five resources, which are also the five planet types and the suits of Guild cards.
export enum Resource {
    Material = 'material',
    Fuel = 'fuel',
    Weapon = 'weapon',
    Relic = 'relic',
    Psionic = 'psionic'
}

export const Resources: readonly Resource[] = Object.values(Resource)

export const ResourceSchema = Type.Enum(Resource)

// Five tokens of each resource in the general supply.
export const ResourceTokensPerType = 5

export type ResourceCounts = Type.Static<typeof ResourceCounts>
export const ResourceCounts = Type.Object({
    [Resource.Material]: Type.Number(),
    [Resource.Fuel]: Type.Number(),
    [Resource.Weapon]: Type.Number(),
    [Resource.Relic]: Type.Number(),
    [Resource.Psionic]: Type.Number()
})

export function resourceCounts(count: number = 0): ResourceCounts {
    return {
        [Resource.Material]: count,
        [Resource.Fuel]: count,
        [Resource.Weapon]: count,
        [Resource.Relic]: count,
        [Resource.Psionic]: count
    }
}
