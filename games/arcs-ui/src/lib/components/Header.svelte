<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RoundPlays from '$lib/components/RoundPlays.svelte'

    const gameSession = getGameSession()
    const turnPlayerId = $derived(gameSession.gameState.activePlayerIds[0])
</script>

<div class="header">
    <div class="who">
        {#if gameSession.isViewingHistory}
            History
        {:else if gameSession.gameState.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if turnPlayerId}
            <PlayerName playerId={turnPlayerId} possessive={true} /> turn
        {/if}
    </div>
    <div class="middle">
        <span class="chapter">Chapter {gameSession.gameState.chapter}</span>
        <RoundPlays />
    </div>
    {#if gameSession.canUndo}
        <button type="button" class="undo" onclick={() => gameSession.undo()}>Undo</button>
    {:else}
        <span></span>
    {/if}
</div>

<style>
    .header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        height: 44px;
        padding: 0 14px;
        font-family: 'Arcs Cinzel', Georgia, serif;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .who {
        font-size: 1.15rem;
        color: var(--arcs-gold);
    }

    .middle {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .chapter {
        color: var(--arcs-muted);
        font-size: 0.9rem;
    }

    .undo {
        justify-self: end;
        padding: 4px 14px;
        border: 1px solid var(--arcs-gold);
        border-radius: 999px;
        color: var(--arcs-gold);
    }

    .undo:hover {
        background: rgb(216 178 94 / 0.15);
    }

    .who {
        white-space: nowrap;
    }

    @media (max-width: 640px) {
        .header {
            gap: 6px;
            height: 32px;
            padding: 0 6px;
            letter-spacing: 0.02em;
        }

        .who {
            font-size: 0.85rem;
        }

        .middle {
            gap: 6px;
        }

        .chapter {
            font-size: 0.75rem;
        }

        .undo {
            padding: 2px 10px;
            font-size: 0.8rem;
        }
    }
</style>
