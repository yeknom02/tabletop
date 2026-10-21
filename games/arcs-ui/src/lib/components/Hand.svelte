<script lang="ts">
    import { cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

<div class="hand">
    {#each gameSession.myHand as cardId, index (`${cardId}-${index}`)}
        <img src={cardArt(cardId)} alt={cardId} />
    {/each}
</div>

<style>
    .hand {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    img {
        width: 90px;
        border-radius: 5px;
    }
</style>
