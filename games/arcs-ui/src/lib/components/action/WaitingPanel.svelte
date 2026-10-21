<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const waitingOn = $derived(gameSession.gameState.activePlayerIds[0])
</script>

{#if waitingOn}
    <p>Waiting for <PlayerName playerId={waitingOn} />.</p>
{/if}
