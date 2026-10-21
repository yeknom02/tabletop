import { describe, expect, it } from 'vitest'
import { buildingHits, ownShipHits, rivalShipHits } from './hitAllocation.js'

describe('a first allocation of hits', () => {
    it('damages the attacker’s fresh ships before destroying any', () => {
        expect(ownShipHits({ fresh: 2, damaged: 0 }, 2)).toEqual({ damage: 2, destroy: 0 })
        expect(ownShipHits({ fresh: 2, damaged: 0 }, 3)).toEqual({ damage: 1, destroy: 1 })
        expect(ownShipHits({ fresh: 1, damaged: 1 }, 2)).toEqual({ damage: 1, destroy: 1 })
    })

    it('destroys the defender’s ships, damaged first', () => {
        expect(rivalShipHits({ fresh: 1, damaged: 1 }, 4)).toEqual({ damage: 0, destroy: 2 })
        expect(rivalShipHits({ fresh: 2, damaged: 0 }, 3)).toEqual({ damage: 1, destroy: 1 })
    })

    it('spreads building hits over damaged buildings first', () => {
        expect(
            buildingHits(
                [
                    { slot: 0, damaged: false },
                    { slot: 1, damaged: true }
                ],
                2
            )
        ).toEqual({ 1: 1, 0: 1 })
    })
})
