<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import PlayerPanel from '$lib/components/PlayerPanel.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const seats = $derived.by(() => {
        const state = gameSession.gameState
        const order = state.turnManager.turnOrder
        const myIndex = order.indexOf(gameSession.myPlayer?.id ?? '')
        const start = Math.max(myIndex, 0)
        return [...order.slice(start), ...order.slice(0, start)].map((playerId) => {
            const player = gameSession.game.players.find((candidate) => candidate.id === playerId)
            assertExists(player, `No player ${playerId}`)
            return { player, playerState: state.getPlayerState(playerId) }
        })
    })
</script>

<div class="space-y-2">
    {#each seats as { player, playerState } (player.id)}
        <PlayerPanel {player} {playerState} />
    {/each}
</div>
