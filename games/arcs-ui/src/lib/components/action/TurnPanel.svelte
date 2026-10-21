<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const turn = $derived(gameSession.gameState.turn)
</script>

<p class="prompt">
    {turn?.pips ?? 0} action{turn?.pips === 1 ? '' : 's'} left{turn?.prelude ? ' (Prelude)' : ''}.
</p>
{#if gameSession.canEndTurn && !gameSession.mustReturnFleet}
    <button type="button" class="choice" onclick={() => gameSession.endTurn()}>End turn</button>
{/if}
