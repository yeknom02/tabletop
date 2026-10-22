<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { chapterPower, chapterScores } from '$lib/utils/chapterScores.js'
    import { AmbitionNames } from '$lib/utils/cards.js'

    const gameSession = getGameSession()
    const gameOver = $derived(gameSession.gameState.result !== undefined)
    const scores = $derived(
        chapterScores(gameSession.actions, gameSession.gameState.chapter, gameOver)
    )

    // Most Power first once the game is over; turn order before then.
    const rows = $derived.by(() => {
        const players = gameSession.gameState.turnManager.turnOrder.map((playerId) =>
            gameSession.gameState.getPlayerState(playerId)
        )
        if (gameOver) players.sort((a, b) => b.power - a.power)
        return players.map((player) => ({
            playerId: player.playerId,
            name: gameSession.getPlayerName(player.playerId),
            color: gameSession.colors.getPlayerBgColorValue(player.playerId),
            power: player.power,
            winner: gameSession.gameState.winningPlayerIds.includes(player.playerId),
            chapters: scores.map((score) => ({
                chapter: score.chapter,
                power: chapterPower(score, player.playerId),
                detail: score.awards
                    .filter((award) => award.playerId === player.playerId && award.power > 0)
                    .map(
                        (award) =>
                            `${AmbitionNames[award.ambition]} ${award.place === 1 ? 'first' : 'second'}: ${award.power}`
                    )
                    .join(', ')
            }))
        }))
    })
</script>

{#if scores.length > 0 || gameOver}
    <table class="summary">
        <thead>
            <tr>
                <th></th>
                {#each scores as score (score.chapter)}
                    <th title="Power from ambitions in chapter {score.chapter}">
                        Ch {score.chapter}
                    </th>
                {/each}
                <th>Power</th>
            </tr>
        </thead>
        <tbody>
            {#each rows as row (row.playerId)}
                <tr class:winner={row.winner}>
                    <th class="name" style:--seat={row.color}>{row.name}</th>
                    {#each row.chapters as cell (cell.chapter)}
                        <td title={cell.detail || 'No ambitions won'}>
                            {cell.power > 0 ? `+${cell.power}` : '–'}
                        </td>
                    {/each}
                    <td class="power">{row.power}</td>
                </tr>
            {/each}
        </tbody>
    </table>
{/if}

<style>
    .summary {
        border-collapse: collapse;
        font-size: 0.85rem;
    }

    th,
    td {
        padding: 2px 8px;
        text-align: center;
    }

    thead th {
        font-family: 'Arcs Cinzel', serif;
        font-size: 0.75rem;
        font-weight: 700;
        opacity: 0.75;
    }

    .name {
        padding-left: 8px;
        border-left: 4px solid var(--seat);
        font-weight: 600;
        text-align: left;
        white-space: nowrap;
    }

    .power {
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }

    .winner .name::after {
        content: ' ✦';
        color: #b8913f;
    }

    tbody tr + tr {
        border-top: 1px solid rgb(127 127 127 / 0.25);
    }
</style>
