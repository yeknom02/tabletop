<script lang="ts">
    // PROTOTYPE switcher for the candidate bid tables. Lives inside the menu's popover so its
    // clicks don't light-dismiss the menu.
    import { bidTableVariant, Variants } from './variant.svelte.js'

    function onKeydown(event: KeyboardEvent) {
        const target = event.target
        if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]')) {
            return
        }
        if (event.key === 'ArrowLeft') {
            bidTableVariant?.step(-1)
        } else if (event.key === 'ArrowRight') {
            bidTableVariant?.step(1)
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#if bidTableVariant}
    {@const variant = bidTableVariant}
    <div class="switcher">
        <button type="button" aria-label="Previous variant" onclick={() => variant.step(-1)}
            >◀</button
        >
        <span
            >{variant.entry.key} · {variant.entry.name}
            <small
                >({Variants.findIndex((v) => v.key === variant.current) +
                    1}/{Variants.length})</small
            ></span
        >
        <button type="button" aria-label="Next variant" onclick={() => variant.step(1)}>▶</button>
    </div>
{/if}

<style>
    .switcher {
        position: fixed;
        bottom: 16px;
        left: 50%;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: #f4f0ff;
        color: #2a0d5e;
        font:
            600 13px/1.2 system-ui,
            sans-serif;
        box-shadow: 0 6px 20px rgb(0 0 0 / 0.5);
        white-space: nowrap;
    }

    .switcher button {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 50%;
        background: #7c3aed;
        color: white;
        cursor: pointer;
    }

    small {
        opacity: 0.6;
    }
</style>
