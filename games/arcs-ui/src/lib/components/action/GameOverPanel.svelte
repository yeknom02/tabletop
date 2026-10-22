<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ChapterSummary from '$lib/components/ChapterSummary.svelte'

    const gameSession = getGameSession()
    const winner = $derived(gameSession.gameState.winningPlayerIds[0])
    const power = $derived(winner ? gameSession.gameState.getPlayerState(winner).power : 0)
    const tied = $derived(
        gameSession.gameState.players.filter((player) => player.power === power).length > 1
    )
</script>

<div class="over">
    {#if winner}
        <p class="headline">
            <PlayerName playerId={winner} /> wins with {power} Power{tied
                ? ', the tie broken from the initiative'
                : ''}.
        </p>
    {/if}
    <ChapterSummary />
</div>

<style>
    .over {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 24px;
    }

    .headline {
        font-family: 'Arcs Cinzel', serif;
        font-size: 1.1rem;
        font-weight: 700;
    }
</style>
