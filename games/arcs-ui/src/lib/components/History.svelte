<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/actionDescription.js'

    const gameSession = getGameSession()
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }
    const entries = $derived(
        [...gameSession.actions].reverse().map((action) => ({
            id: action.id,
            text: describeAction(action, names)
        }))
    )
</script>

<ol class="history">
    {#each entries as entry (entry.id)}
        <li>{entry.text}.</li>
    {/each}
</ol>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 4px 8px;
        font-size: 0.85rem;
    }

    li {
        padding-bottom: 4px;
        border-bottom: 1px solid rgb(255 255 255 / 0.08);
    }
</style>
