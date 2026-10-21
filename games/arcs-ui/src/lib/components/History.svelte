<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const entries = $derived([...gameSession.actions].reverse())
</script>

<ol class="history">
    {#each entries as action (action.id)}
        <li>
            {#if action.playerId}<PlayerName playerId={action.playerId} />{/if}
            <span class="type">{action.type}</span>
        </li>
    {/each}
</ol>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.85rem;
    }

    .type {
        color: var(--arcs-muted);
    }
</style>
