<script lang="ts">
    import { PlayKind, type CardPlay } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { actionCardName } from '$lib/utils/cards.js'

    // The ink of each suit's cards.
    const SuitInk: Record<string, string> = {
        administration: '#6f706b',
        aggression: '#a32a2e',
        construction: '#cc5933',
        mobilization: '#3a8a9a'
    }

    const gameSession = getGameSession()
    const plays = $derived(gameSession.gameState.round.plays)

    function label(play: CardPlay): string {
        const who = gameSession.getPlayerName(play.playerId)
        const card = play.cardId ? actionCardName(play.cardId) : 'a face-down card'
        const seized = play.faceDownCount > (play.kind === PlayKind.Copy ? 1 : 0)
        return `${who}: ${play.kind} with ${card}${play.zeroed ? ' (zeroed)' : ''}${seized ? ', seizing the initiative' : ''}`
    }
</script>

{#if plays.length > 0}
    <ol class="plays" aria-label="This round's plays">
        {#each plays as play (play.playerId)}
            {@const [suit, number] = play.cardId?.split('-') ?? []}
            <li
                class="play"
                style:--seat={gameSession.colors.getPlayerBgColorValue(play.playerId)}
                title={label(play)}
            >
                {#if suit}
                    <span class="card" style:color={SuitInk[suit]}>
                        {play.zeroed ? '0' : number}
                    </span>
                {:else}
                    <span class="card back"></span>
                {/if}
                <span class="kind">{play.kind}</span>
                {#if play.faceDownCount > (play.kind === PlayKind.Copy ? 1 : 0)}
                    <span class="card back seize" title="Seized the initiative"></span>
                {/if}
            </li>
        {/each}
    </ol>
{/if}

<style>
    .plays {
        display: flex;
        gap: 6px;
    }

    .play {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px 2px 2px;
        border-radius: 6px;
        border-bottom: 3px solid var(--seat);
        background: rgb(255 255 255 / 0.06);
    }

    .card {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 28px;
        border-radius: 3px;
        background: #fdf8f5;
        font-family: 'Arcs Cinzel', serif;
        font-size: 1rem;
        font-weight: 700;
    }

    .card.back {
        background: linear-gradient(135deg, #2a3350, #11162a);
        border: 1px solid var(--arcs-gold);
    }

    .kind {
        color: var(--arcs-muted);
        font-family: 'Arcs Jost', sans-serif;
        font-size: 0.7rem;
        font-weight: 500;
        letter-spacing: 0.03em;
        text-transform: capitalize;
    }
</style>
