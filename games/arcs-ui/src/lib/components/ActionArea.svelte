<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PaperTexture } from '$lib/utils/art.js'
    import DraftPanel from './action/DraftPanel.svelte'
    import MulliganPanel from './action/MulliganPanel.svelte'
    import PlayCardPanel from './action/PlayCardPanel.svelte'
    import TurnPanel from './action/TurnPanel.svelte'
    import BattlePanel from './action/BattlePanel.svelte'
    import DeclarePanel from './action/DeclarePanel.svelte'
    import ArchivePanel from './action/ArchivePanel.svelte'
    import WaitingPanel from './action/WaitingPanel.svelte'
    import GameOverPanel from './action/GameOverPanel.svelte'

    const gameSession = getGameSession()
</script>

<section
    class="panel"
    class:settling={gameSession.busy}
    aria-label="Actions"
    style:background-image="url({PaperTexture})"
>
    {#if gameSession.isViewingHistory}
        <p class="note">Viewing an earlier position.</p>
    {:else if gameSession.gameState.result}
        <GameOverPanel />
    {:else if gameSession.isDrafting}
        <DraftPanel />
    {:else if gameSession.isMulliganing}
        <MulliganPanel />
    {:else if gameSession.isPlayingCard}
        <PlayCardPanel />
    {:else if gameSession.isTakingActions}
        <TurnPanel />
    {:else if gameSession.isBattling}
        <BattlePanel />
    {:else if gameSession.declareStep}
        <DeclarePanel />
    {:else if gameSession.archive}
        <ArchivePanel />
    {:else}
        <WaitingPanel />
    {/if}
</section>

<style>
    .panel {
        margin: 0 10px 10px;
        padding: 10px 16px 12px;
        border: 3px solid #b8913f;
        border-radius: 12px;
        background-color: var(--arcs-paper);
        background-size: cover;
        color: var(--arcs-paper-ink);
        box-shadow: 0 6px 18px rgb(0 0 0 / 0.5);
    }

    .panel :global(.choice) {
        border-color: #8a6a2a;
        background: rgb(184 145 63 / 0.18);
        color: var(--arcs-paper-ink);
        font-weight: 500;
    }

    .panel :global(.choice:hover) {
        background: rgb(184 145 63 / 0.35);
    }

    .settling {
        pointer-events: none;
    }

    .note {
        color: var(--arcs-muted);
    }
</style>
