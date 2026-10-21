<script lang="ts">
    import type { RolledDie } from '@tabletop/arcs'
    import { dieArt } from '$lib/utils/art.js'

    let {
        rolled,
        selected = [],
        onToggle
    }: { rolled: RolledDie[]; selected?: number[]; onToggle?: (index: number) => void } = $props()
</script>

<div class="dice">
    {#each rolled as die, index (index)}
        {#if onToggle}
            <button
                type="button"
                class="die"
                class:selected={selected.includes(index)}
                aria-label="{die.die} die"
                aria-pressed={selected.includes(index)}
                onclick={() => onToggle(index)}
            >
                <img src={dieArt(die.die, die.face)} alt="{die.die} die" />
            </button>
        {:else}
            <img class="die" src={dieArt(die.die, die.face)} alt="{die.die} die" />
        {/if}
    {/each}
</div>

<style>
    .dice {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .die,
    .die img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
    }

    .die img,
    img.die {
        filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.5));
    }

    button.selected {
        outline: 3px solid #b8913f;
        outline-offset: 2px;
    }
</style>
