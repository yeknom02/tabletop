<script lang="ts">
    import { DraftKind } from '@tabletop/arcs'
    import { cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const draft = $derived(gameSession.gameState.draft)
    const me = $derived(gameSession.myPlayerId())
    const rows = $derived([
        { kind: DraftKind.Leader, label: 'Leaders', cards: draft?.leaders ?? [] },
        { kind: DraftKind.Lore, label: 'Lore', cards: draft?.lore ?? [] }
    ])
</script>

<p class="prompt">Take a leader or a lore card.</p>
{#each rows as row (row.kind)}
    <div class="row">
        <span class="label">{row.label}</span>
        {#each row.cards as cardId (cardId)}
            <button
                type="button"
                class="card"
                disabled={!gameSession.gameState.canDraft(me, cardId, row.kind)}
                onclick={() => gameSession.draft(cardId, row.kind)}
            >
                <img src={cardArt(cardId)} alt={cardId} />
            </button>
        {/each}
    </div>
{/each}

<style>
    .prompt {
        margin-bottom: 8px;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .label {
        width: 60px;
        color: var(--arcs-muted);
    }

    .card img {
        width: 110px;
        border-radius: 6px;
    }

    .card:disabled {
        opacity: 0.4;
    }

    .card:not(:disabled):hover img {
        outline: 2px solid var(--arcs-gold);
    }
</style>
