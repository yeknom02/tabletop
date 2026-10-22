<script lang="ts">
    import { untrack } from 'svelte'
    import { shipsOf, type ShipsMoving, type SystemId } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Stepper from '$lib/components/Stepper.svelte'

    // A move, or with `sprint` Sprinter Drives' second move of fresh ships that just moved.
    let { sprint = false }: { sprint?: boolean } = $props()

    const gameSession = getGameSession()
    const from = $derived(sprint ? gameSession.sprintOrigin : gameSession.origin)
    const path = $derived(sprint ? gameSession.sprintPath : gameSession.path)
    const ships = $derived.by(() => {
        if (!from) return { fresh: 0, damaged: 0 }
        if (sprint) return { fresh: gameSession.sprintArrivals[from] ?? 0, damaged: 0 }
        return shipsOf(gameSession.gameState.system(from), gameSession.myPlayerId())
    })
    let fresh = $state(untrack(() => ships.fresh))
    let damaged = $state(0)

    // Ships left behind in each system passed through, when Catapulting.
    let left: Partial<Record<SystemId, ShipsMoving>> = $state({})
    const stops = $derived(path.slice(0, -1))
    const leftAt = (stop: SystemId): ShipsMoving => left[stop] ?? { fresh: 0, damaged: 0 }
    const setLeft = (stop: SystemId, kind: keyof ShipsMoving, count: number) => {
        left[stop] = { ...leftAt(stop), [kind]: count }
    }
    const dropOffs = $derived(stops.map((stop) => leftAt(stop)))
    const move = $derived({ fresh, damaged, dropOffs })

    const valid = $derived(
        sprint ? gameSession.canSprint(fresh, dropOffs) : gameSession.canMoveShips(move)
    )
    const canSprintAfter = $derived(!sprint && gameSession.canSprintAfter(move))
</script>

<div class="controls">
    {#if ships.fresh > 0}
        <Stepper label="Fresh" bind:value={fresh} max={ships.fresh} />
    {/if}
    {#if ships.damaged > 0}
        <Stepper label="Damaged" bind:value={damaged} max={ships.damaged} />
    {/if}
    {#each stops as stop (stop)}
        <span class="stop">Leave at {stop}</span>
        {#if fresh > 0}
            <Stepper
                label="Fresh"
                bind:value={() => leftAt(stop).fresh, (count) => setLeft(stop, 'fresh', count)}
                max={fresh}
            />
        {/if}
        {#if damaged > 0}
            <Stepper
                label="Damaged"
                bind:value={() => leftAt(stop).damaged, (count) => setLeft(stop, 'damaged', count)}
                max={damaged}
            />
        {/if}
    {/each}
    <button
        type="button"
        class="choice"
        disabled={!valid}
        onclick={() => (sprint ? gameSession.sprint(fresh, dropOffs) : gameSession.moveShips(move))}
    >
        {sprint ? 'Sprint' : 'Move'}
        {fresh + damaged}
    </button>
    {#if canSprintAfter}
        <button type="button" class="choice" onclick={() => gameSession.sprintAfter(move)}>
            Move, then sprint
        </button>
    {/if}
</div>

<style>
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 16px;
        margin-top: 8px;
    }

    .controls :global(.stepper) {
        grid-template-columns: auto 30px 28px 30px;
    }

    .stop {
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }
</style>
