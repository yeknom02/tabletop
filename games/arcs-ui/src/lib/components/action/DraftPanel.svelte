<script lang="ts">
    import { DraftKind } from '@tabletop/arcs'
    import { cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CardViewer from '$lib/components/CardViewer.svelte'

    const gameSession = getGameSession()
    const draft = $derived(gameSession.gameState.draft)
    const me = $derived(gameSession.myPlayerId())
    const rows = $derived([
        { kind: DraftKind.Leader, label: 'Leaders', cards: draft?.leaders ?? [] },
        { kind: DraftKind.Lore, label: 'Lore', cards: draft?.lore ?? [] }
    ])
    let cardsHidden = $state(false)
    const draftCards = $derived(rows.flatMap((row) => row.cards))
    let viewing: string | undefined = $state()
    const viewed = $derived(viewing && draftCards.includes(viewing) ? viewing : undefined)
    const kindOf = (cardId: string) =>
        draft?.leaders.includes(cardId) ? DraftKind.Leader : DraftKind.Lore
    const takeViewed = (cardId: string, kind: DraftKind) => {
        viewing = undefined
        void gameSession.draft(cardId, kind)
    }
</script>

<div class="heading">
    <p class="prompt">Take a leader or a lore card.</p>
    <button type="button" class="choice view-toggle" onclick={() => (cardsHidden = !cardsHidden)}
        >{cardsHidden ? 'Show cards' : 'Hide'}</button
    >
</div>
{#each rows as row (row.kind)}
    <div class="row" hidden={cardsHidden}>
        <span class="label">{row.label}</span>
        {#each row.cards as cardId (cardId)}
            <button
                type="button"
                class="card"
                class:unavailable={!gameSession.gameState.canDraft(me, cardId, row.kind)}
                onclick={() => (viewing = cardId)}
            >
                <img src={cardArt(cardId)} alt={cardId} />
            </button>
        {/each}
    </div>
{/each}
{#if viewed}
    {@const cardId = viewed}
    {@const kind = kindOf(viewed)}
    <CardViewer
        {cardId}
        cards={draftCards}
        onview={(next) => (viewing = next)}
        onclose={() => (viewing = undefined)}
    >
        {#snippet actions()}
            <button
                type="button"
                class="choice"
                disabled={!gameSession.gameState.canDraft(me, cardId, kind)}
                onclick={() => takeViewed(cardId, kind)}>Take</button
            >
        {/snippet}
    </CardViewer>
{/if}

<style>
    .heading {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .row[hidden] {
        display: none;
    }

    .label {
        width: 60px;
        color: var(--arcs-muted);
    }

    .card img {
        width: 110px;
        border-radius: 6px;
    }

    .unavailable {
        opacity: 0.4;
    }

    .card:not(:disabled):hover img {
        outline: 2px solid var(--arcs-gold);
    }
</style>
