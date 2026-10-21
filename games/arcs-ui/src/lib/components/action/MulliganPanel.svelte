<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Hand from '$lib/components/Hand.svelte'

    const gameSession = getGameSession()
</script>

<p class="prompt">Keep this hand, or draw six new cards?</p>
<Hand />
<div class="buttons">
    <button type="button" class="choice" onclick={() => gameSession.keepHand()}>Keep</button>
    <button type="button" class="choice" onclick={() => gameSession.redrawHand()}>Redraw</button>
</div>

<style>
    .buttons {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }
</style>
