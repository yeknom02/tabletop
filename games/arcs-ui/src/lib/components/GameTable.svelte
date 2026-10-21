<script lang="ts">
    import { untrack } from 'svelte'
    import {
        DefaultTableLayout,
        DefaultTabs,
        GameChat,
        GameSession,
        HistoryControls,
        ScalingWrapper
    } from '@tabletop/frontend-components'
    import type { ArcsProjectedState, HydratedArcsGameState } from '@tabletop/arcs'
    import Header from '$lib/components/Header.svelte'
    import ActionArea from '$lib/components/ActionArea.svelte'
    import Board from '$lib/components/Board.svelte'
    import PlayersPanel from '$lib/components/PlayersPanel.svelte'
    import History from '$lib/components/History.svelte'
    import { ArcsGameSession } from '$lib/model/session.svelte'
    import { setGameSession } from '$lib/model/sessionContext.svelte'

    let { gameSession }: { gameSession: GameSession<ArcsProjectedState, HydratedArcsGameState> } =
        $props()

    function ensureArcsGameSession(
        session: GameSession<ArcsProjectedState, HydratedArcsGameState>
    ): ArcsGameSession {
        if (session instanceof ArcsGameSession) {
            return session
        }
        throw new Error('GameTable expected an ArcsGameSession')
    }

    const arcsSession = untrack(() => ensureArcsGameSession(gameSession))
    setGameSession(arcsSession)
</script>

<div class="arcs-table" aria-busy={gameSession.busy}>
    <DefaultTableLayout>
        {#snippet mobileControlsContent()}
            <HistoryControls />
        {/snippet}
        {#snippet sideContent()}
            <div class="max-sm:hidden"><HistoryControls /></div>
            <DefaultTabs>
                {#snippet playersPanel()}
                    <PlayersPanel />
                {/snippet}
                {#snippet history()}
                    <History />
                {/snippet}
                {#snippet chat()}
                    <GameChat />
                {/snippet}
            </DefaultTabs>
        {/snippet}
        {#snippet gameContent()}
            <div class="shrink-0">
                <Header />
                <ActionArea />
            </div>
            <div class="relative grow-0 overflow-hidden" style="flex:1;">
                <ScalingWrapper justify="center" controls="bottom-left" expandable>
                    <Board />
                </ScalingWrapper>
            </div>
        {/snippet}
    </DefaultTableLayout>
</div>

<style>
    .arcs-table {
        --arcs-space: #0d111b;
        --arcs-panel: #171d2b;
        --arcs-gold: #d8b25e;
        --arcs-paper: #efe4cc;
        --arcs-paper-ink: #2a2116;
        --arcs-ink: #e9e2d0;
        --arcs-muted: #9aa0ad;
        min-height: 100%;
        background: radial-gradient(ellipse at top, #1b2233, var(--arcs-space) 70%);
        color: var(--arcs-ink);
    }
</style>
