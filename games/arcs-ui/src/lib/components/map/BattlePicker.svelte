<script lang="ts">
    import { untrack } from 'svelte'
    import { Die, RailgunHit, shipsOf, type SystemId } from '@tabletop/arcs'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Stepper from '$lib/components/Stepper.svelte'

    let { system }: { system: SystemId } = $props()
    const gameSession = getGameSession()
    const me = gameSession.myPlayerId()
    const defenders = $derived(gameSession.gameState.defendersIn(me, system))
    let defender = $state(untrack(() => defenders[0]))
    const ships = $derived(shipsOf(gameSession.gameState.system(system), me))
    const shipCount = $derived(ships.fresh + ships.damaged)
    const railgun = $derived(gameSession.gameState.railgunApplies(system, defender))
    const sensors = $derived(gameSession.gameState.sensorsApply(system, defender))
    let railgunHit = $state(
        untrack(() => (ships.fresh > 0 ? RailgunHit.Fresh : RailgunHit.Damaged))
    )
    let assault = $state(untrack(() => shipCount))
    let skirmish = $state(0)
    let raid = $state(0)
    const dice = $derived({ [Die.Assault]: assault, [Die.Skirmish]: skirmish, [Die.Raid]: raid })
    const railgunChoice = $derived(railgun ? railgunHit : undefined)
    const valid = $derived(gameSession.canBattle(system, defender, dice, railgunChoice))
    const most = $derived(shipCount + 2)
</script>

<div class="picker">
    <p class="title">Battle</p>
    {#if defenders.length > 1}
        <div class="defenders">
            {#each defenders as candidate (candidate)}
                <button
                    type="button"
                    class="choice"
                    class:on={candidate === defender}
                    onclick={() => (defender = candidate)}
                >
                    <PlayerName playerId={candidate} />
                </button>
            {/each}
        </div>
    {:else}
        <p>Against <PlayerName playerId={defender} /></p>
    {/if}
    {#if railgun}
        <p class="note">Railgun Arrays hit one of your ships first.</p>
        <div class="defenders">
            {#if ships.fresh > 0}
                <button
                    type="button"
                    class="choice"
                    class:on={railgunHit === RailgunHit.Fresh}
                    onclick={() => (railgunHit = RailgunHit.Fresh)}>Damage a fresh ship</button
                >
            {/if}
            {#if ships.damaged > 0}
                <button
                    type="button"
                    class="choice"
                    class:on={railgunHit === RailgunHit.Damaged}
                    onclick={() => (railgunHit = RailgunHit.Damaged)}>Destroy a damaged ship</button
                >
            {/if}
        </div>
    {/if}
    {#if sensors}
        <p class="note">They may move ships in with Predictive Sensors before you choose dice.</p>
    {:else}
        <Stepper label="Assault" bind:value={assault} max={most} />
        <Stepper label="Skirmish" bind:value={skirmish} max={most} />
        <Stepper label="Raid" bind:value={raid} max={most} />
    {/if}
    <button
        type="button"
        class="choice"
        disabled={!valid}
        onclick={() => gameSession.battle(system, defender, dice, railgunChoice)}
    >
        {sensors ? 'Battle' : 'Roll'}
    </button>
</div>

<style>
    .picker {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 230px;
        padding: 10px 12px;
        border: 2px solid var(--arcs-gold);
        border-radius: 10px;
        background: #1c2232;
        color: var(--arcs-ink);
        box-shadow: 0 10px 24px rgb(0 0 0 / 0.6);
    }

    .title {
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }

    .defenders {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .on {
        outline: 2px solid var(--arcs-gold);
    }

    .note {
        color: var(--arcs-muted);
        font-size: 0.85rem;
    }
</style>
