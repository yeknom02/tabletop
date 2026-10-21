<script lang="ts">
    import { untrack } from 'svelte'
    import { shipsOf } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Stepper from '$lib/components/Stepper.svelte'

    const gameSession = getGameSession()
    const ships = $derived(
        gameSession.origin
            ? shipsOf(gameSession.gameState.system(gameSession.origin), gameSession.myPlayerId())
            : { fresh: 0, damaged: 0 }
    )
    let fresh = $state(untrack(() => ships.fresh))
    let damaged = $state(0)
    const valid = $derived(gameSession.canMoveShips(fresh, damaged))
</script>

<div class="picker">
    <p class="title">Move ships</p>
    {#if ships.fresh > 0}
        <Stepper label="Fresh" bind:value={fresh} max={ships.fresh} />
    {/if}
    {#if ships.damaged > 0}
        <Stepper label="Damaged" bind:value={damaged} max={ships.damaged} />
    {/if}
    <button
        type="button"
        class="choice"
        disabled={!valid}
        onclick={() => gameSession.moveShips(fresh, damaged)}
    >
        Move {fresh + damaged}
    </button>
</div>

<style>
    .picker {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 180px;
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
</style>
