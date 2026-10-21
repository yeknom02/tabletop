import { assertExists, type Color } from '@tabletop/common'
import type { BuildingKind, Die, Resource } from '@tabletop/arcs'
import { Art } from '$lib/images/art.generated.js'

function art(key: string): string {
    const url = Art[key]
    assertExists(url, `No art for ${key}`)
    return url
}

export const MapArt = art('map/map')

export const InitiativeArt = art('tokens/initiative')
export const PaperTexture = art('textures/paper')
export const SpaceTexture = art('textures/space')

export function outOfPlayArt(cluster: number): string {
    return art(`map/out-${cluster}`)
}

export function shipArt(color: Color): string {
    return art(`pieces/${color}-ship`)
}

export function buildingArt(color: Color, kind: BuildingKind, damaged: boolean): string {
    return art(`pieces/${color}-${kind}${damaged ? '-damaged' : ''}`)
}

export function agentArt(color: Color): string {
    return art(`pieces/${color}-agent`)
}

export function resourceArt(resource: Resource): string {
    return art(`resources/${resource}`)
}

export function resourceIconArt(resource: Resource): string {
    return art(`icons/${resource}`)
}

// The face shown once a marker is flipped is its back.
export function ambitionMarkerArt(first: number, second: number, flipped: boolean): string {
    return art(`tokens/ambition-${flipped ? 'back' : 'front'}-${first}-${second}`)
}

export function cardBackArt(kind: 'action' | 'court' | 'lore'): string {
    return art(`cards/back-${kind}`)
}

export function dieArt(die: Die, face: number): string {
    return art(`dice/${die}-${face + 1}`)
}

// Action cards are `<suit>-<number>`, Court cards BC01–31, lore L01–28 and leaders LEAD01–16.
export function cardArt(cardId: string): string {
    if (cardId.startsWith('BC')) return art(`cards/court/${cardId}`)
    if (cardId.startsWith('LEAD')) return art(`cards/leader/${cardId}`)
    if (cardId.startsWith('L')) return art(`cards/lore/${cardId}`)
    return art(`cards/action/${cardId}`)
}
