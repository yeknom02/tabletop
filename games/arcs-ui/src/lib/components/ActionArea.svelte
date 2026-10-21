<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import DraftPanel from './action/DraftPanel.svelte'
    import MulliganPanel from './action/MulliganPanel.svelte'
    import PlayCardPanel from './action/PlayCardPanel.svelte'
    import TurnPanel from './action/TurnPanel.svelte'
    import WaitingPanel from './action/WaitingPanel.svelte'

    const gameSession = getGameSession()
</script>

<section class="panel" class:settling={gameSession.busy} aria-label="Actions">
    {#if gameSession.isViewingHistory}
        <p class="note">Viewing an earlier position.</p>
    {:else if gameSession.gameState.result}
        <p class="note">The game is over.</p>
    {:else if gameSession.isDrafting}
        <DraftPanel />
    {:else if gameSession.isMulliganing}
        <MulliganPanel />
    {:else if gameSession.isPlayingCard}
        <PlayCardPanel />
    {:else if gameSession.isTakingActions}
        <TurnPanel />
    {:else}
        <WaitingPanel />
    {/if}
</section>

<style>
    .panel {
        margin: 0 10px 10px;
        padding: 12px 16px;
        border: 1px solid rgb(216 178 94 / 0.35);
        border-radius: 10px;
        background: var(--arcs-panel);
    }

    .settling {
        pointer-events: none;
    }

    .note {
        color: var(--arcs-muted);
    }
</style>
