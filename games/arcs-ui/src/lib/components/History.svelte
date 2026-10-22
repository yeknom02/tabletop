<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/actionDescription.js'
    import { turnGroups } from '$lib/utils/turnGroups.js'

    const gameSession = getGameSession()
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }

    // Newest first: each player's run of actions together, under a bar in their colour.
    const groups = $derived(
        turnGroups(gameSession.actions)
            .reverse()
            .map((group) => ({
                key: group.actions[0].id,
                color: group.playerId
                    ? gameSession.colors.getPlayerBgColorValue(group.playerId)
                    : 'transparent',
                entries: [...group.actions].reverse().map((action) => ({
                    id: action.id,
                    text: describeAction(action, names)
                }))
            }))
    )
</script>

<ol class="history">
    {#each groups as group (group.key)}
        <li class="group" style:--seat={group.color}>
            <ol>
                {#each group.entries as entry (entry.id)}
                    <li>{entry.text}.</li>
                {/each}
            </ol>
        </li>
    {/each}
</ol>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 4px 8px;
        font-size: 0.85rem;
    }

    .group {
        padding: 2px 0 2px 8px;
        border-left: 3px solid var(--seat);
    }

    .group li + li {
        margin-top: 3px;
    }
</style>
