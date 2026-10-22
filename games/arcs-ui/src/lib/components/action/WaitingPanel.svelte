<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/actionDescription.js'
    import { turnGroups } from '$lib/utils/turnGroups.js'

    const ShownActions = 4

    const gameSession = getGameSession()
    const waitingOn = $derived(gameSession.gameState.activePlayerIds[0])
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }

    // What the player who acted last has done in their latest run of actions.
    const latest = $derived.by(() => {
        const group = turnGroups(gameSession.actions).at(-1)
        if (!group) return []
        return group.actions
            .slice(-ShownActions)
            .map((action) => ({ id: action.id, text: describeAction(action, names) }))
    })
</script>

<!-- The header names whose turn it is, so the latest actions stand alone when there are any. -->
{#if latest.length === 0 && waitingOn}
    <p class="waiting">Waiting for <PlayerName playerId={waitingOn} />.</p>
{:else if latest.length > 0}
    <ul class="latest">
        {#each latest as entry (entry.id)}
            <li>{entry.text}.</li>
        {/each}
    </ul>
{/if}

<style>
    .waiting {
        font-weight: 600;
    }

    .latest {
        font-size: 0.85rem;
        line-height: 1.35;
    }

    .latest li {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
