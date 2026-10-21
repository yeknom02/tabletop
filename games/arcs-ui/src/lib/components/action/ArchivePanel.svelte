<script lang="ts">
    import { cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    let kept: string[] = $state([])
    const toggle = (cardId: string) => {
        kept = kept.includes(cardId)
            ? kept.filter((other) => other !== cardId)
            : [...kept, cardId].slice(-2)
    }
</script>

<p class="prompt">Learned: keep 2 of these lore cards. The rest are scrapped.</p>
<div class="row">
    {#each gameSession.archive?.cards ?? [] as cardId (cardId)}
        <button
            type="button"
            class="card-button"
            class:on={kept.includes(cardId)}
            aria-pressed={kept.includes(cardId)}
            onclick={() => toggle(cardId)}
        >
            <img src={cardArt(cardId)} alt={cardId} />
        </button>
    {/each}
    <button
        type="button"
        class="choice"
        disabled={kept.length !== 2}
        onclick={() => gameSession.keepLore(kept)}>Keep these</button
    >
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 6px;
    }

    img {
        width: 96px;
        border-radius: 6px;
    }

    .on img {
        outline: 3px solid #b8913f;
    }
</style>
