<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import { cardArt } from '$lib/utils/art.js'
    import { cardName } from '$lib/utils/cards.js'

    let {
        cardId,
        cards,
        onview,
        onclose,
        actions
    }: {
        cardId: string
        cards: readonly string[]
        onview: (cardId: string) => void
        onclose: () => void
        actions?: Snippet
    } = $props()

    const step = (by: number) => {
        const index = cards.indexOf(cardId)
        onview(cards[(index + by + cards.length) % cards.length])
    }

    function onkeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowLeft') step(-1)
        else if (event.key === 'ArrowRight') step(1)
    }

    const shownAsModal: Attachment<HTMLDialogElement> = (dialog) => {
        dialog.showModal()
    }

    function dismiss(event: MouseEvent & { currentTarget: HTMLDialogElement }) {
        if (event.target === event.currentTarget) {
            event.currentTarget.close()
        }
    }
</script>

<dialog
    class="viewer"
    aria-label={cardName(cardId)}
    {@attach shownAsModal}
    {onclose}
    {onkeydown}
    onclick={dismiss}
>
    <div class="cycle">
        {#if cards.length > 1}
            <button type="button" class="arrow" aria-label="Previous card" onclick={() => step(-1)}
                ><svg viewBox="0 0 24 24" aria-hidden="true"
                    ><polyline points="15 5 8 12 15 19"></polyline></svg
                ></button
            >
        {/if}
        <img src={cardArt(cardId)} alt={cardName(cardId)} />
        {#if cards.length > 1}
            <button type="button" class="arrow" aria-label="Next card" onclick={() => step(1)}
                ><svg viewBox="0 0 24 24" aria-hidden="true"
                    ><polyline points="9 5 16 12 9 19"></polyline></svg
                ></button
            >
        {/if}
    </div>
    {#if actions}
        <div class="buttons">
            {@render actions()}
        </div>
    {/if}
</dialog>

<style>
    .viewer {
        margin: auto;
        max-width: none;
        max-height: none;
        padding: 0;
        border: none;
        background: transparent;
        overflow: visible;
    }

    .viewer::backdrop {
        background: rgb(6 8 14 / 0.78);
    }

    .viewer[open] {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
    }

    .cycle {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .arrow {
        flex: none;
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 50%;
        background: #3d475d;
        color: var(--arcs-gold);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .arrow svg {
        width: 28px;
        height: 28px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .arrow:hover {
        background: #525d76;
    }

    img {
        width: min(360px, calc(100vw - 124px));
        max-height: calc(100dvh - 120px);
        object-fit: contain;
        border-radius: 14px;
        box-shadow: 0 12px 36px rgb(0 0 0 / 0.7);
    }

    .buttons {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }

    .viewer .buttons :global(.choice) {
        min-width: 96px;
        padding: 8px 16px;
        border: 2px solid var(--arcs-gold);
        border-radius: 8px;
        background: var(--arcs-paper);
        color: #2a2116;
        font-weight: 600;
    }

    .buttons :global(.choice:hover:not(:disabled)) {
        background: #f8efd9;
    }

    .buttons :global(.choice:disabled) {
        opacity: 0.5;
    }
</style>
