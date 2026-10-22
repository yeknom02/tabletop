<script lang="ts">
    import { untrack } from 'svelte'
    import type { ShipsMoving } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Stepper from '$lib/components/Stepper.svelte'

    const gameSession = getGameSession()
    const stacks = $derived.by(() => {
        const guide = gameSession.guide
        if (!guide) return []
        return Object.entries(gameSession.gameState.system(guide.system).ships)
            .filter(([, ships]) => ships.fresh + ships.damaged > 0)
            .map(([owner, ships]) => ({ owner, name: gameSession.getPlayerName(owner), ships }))
    })

    let chosen: Record<string, ShipsMoving> = $state(
        untrack(() => Object.fromEntries(stacks.map(({ owner, ships }) => [owner, { ...ships }])))
    )
    const shipsOf = (owner: string): ShipsMoving => chosen[owner] ?? { fresh: 0, damaged: 0 }
    const set = (owner: string, kind: keyof ShipsMoving, count: number) => {
        chosen[owner] = { ...shipsOf(owner), [kind]: count }
    }
    const moving = $derived(
        Object.fromEntries(
            Object.entries(chosen).filter(([, ships]) => ships.fresh + ships.damaged > 0)
        )
    )
    const count = $derived(
        Object.values(moving).reduce((sum, ships) => sum + ships.fresh + ships.damaged, 0)
    )
</script>

<div class="controls">
    {#each stacks as stack (stack.owner)}
        <span class="owner">{stack.name}</span>
        {#if stack.ships.fresh > 0}
            <Stepper
                label="Fresh"
                bind:value={() => shipsOf(stack.owner).fresh, (n) => set(stack.owner, 'fresh', n)}
                max={stack.ships.fresh}
            />
        {/if}
        {#if stack.ships.damaged > 0}
            <Stepper
                label="Damaged"
                bind:value={
                    () => shipsOf(stack.owner).damaged, (n) => set(stack.owner, 'damaged', n)
                }
                max={stack.ships.damaged}
            />
        {/if}
    {/each}
    <button
        type="button"
        class="choice"
        disabled={!gameSession.canGuide(moving)}
        onclick={() => gameSession.takeGuide(moving)}
    >
        Guide {count}
    </button>
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

    .owner {
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }
</style>
