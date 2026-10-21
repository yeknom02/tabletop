<script lang="ts">
    import { untrack } from 'svelte'
    import { shipsOf, type BattleState, type BuildingHits } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { buildingHits, ownShipHits, rivalShipHits } from '$lib/utils/hitAllocation.js'
    import Stepper from '$lib/components/Stepper.svelte'

    let { battle }: { battle: BattleState } = $props()
    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const attackerShips = $derived(shipsOf(game.system(battle.system), battle.attacker))
    const defenderShips = $derived(shipsOf(game.system(battle.system), battle.defender))
    const buildings = $derived(game.defendingBuildings())

    const start = untrack(() => ({
        attacking: ownShipHits(attackerShips, battle.attackerHits),
        defending: rivalShipHits(defenderShips, battle.hits),
        buildings: buildingHits(
            buildings.map(({ slot, building }) => ({ slot, damaged: building.damaged })),
            game.buildingHitsToAssign()
        )
    }))
    let attackingDamage = $state(start.attacking.damage)
    let attackingDestroy = $state(start.attacking.destroy)
    let defendingDamage = $state(start.defending.damage)
    let defendingDestroy = $state(start.defending.destroy)
    let hitsBySlot: Record<number, number> = $state(start.buildings)

    const onBuildings: BuildingHits[] = $derived(
        Object.entries(hitsBySlot)
            .filter(([, hits]) => hits > 0)
            .map(([slot, hits]) => ({ slot: Number(slot), hits }))
    )
    const attacking = $derived({ damage: attackingDamage, destroy: attackingDestroy })
    const defending = $derived({ damage: defendingDamage, destroy: defendingDestroy })
    const valid = $derived(gameSession.canAssignHits(attacking, defending, onBuildings))
</script>

<p>
    {battle.attackerHits} hit{battle.attackerHits === 1 ? '' : 's'} on your ships, {battle.hits} on theirs{battle.buildingHits >
    0
        ? `, ${battle.buildingHits} on their buildings`
        : ''}.
</p>
<div class="hits">
    <div>
        <p class="side">
            Your ships ({attackerShips.fresh} fresh, {attackerShips.damaged} damaged)
        </p>
        <Stepper label="Damaged" bind:value={attackingDamage} max={attackerShips.fresh} />
        <Stepper
            label="Destroyed"
            bind:value={attackingDestroy}
            max={attackerShips.fresh + attackerShips.damaged}
        />
    </div>
    <div>
        <p class="side">
            Their ships ({defenderShips.fresh} fresh, {defenderShips.damaged} damaged)
        </p>
        <Stepper label="Damaged" bind:value={defendingDamage} max={defenderShips.fresh} />
        <Stepper
            label="Destroyed"
            bind:value={defendingDestroy}
            max={defenderShips.fresh + defenderShips.damaged}
        />
    </div>
    {#if buildings.length > 0}
        <div>
            <p class="side">Their buildings</p>
            {#each buildings as { slot, building } (slot)}
                <Stepper
                    label="{building.damaged ? 'Damaged ' : ''}{building.kind}"
                    bind:value={hitsBySlot[slot]}
                    max={building.damaged ? 1 : 2}
                />
            {/each}
        </div>
    {/if}
</div>
<button
    type="button"
    class="choice"
    disabled={!valid}
    onclick={() => gameSession.assignHits(attacking, defending, onBuildings)}
>
    Assign hits
</button>

<style>
    .hits {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 24px;
    }

    .hits > div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 210px;
    }

    .side {
        font-weight: 600;
    }
</style>
