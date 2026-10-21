<script lang="ts">
    import { agentArt, cardArt, cardBackArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const colorOf = (playerId: string) => state.getPlayerState(playerId).color
</script>

<section class="court">
    <header>
        <h2>The Court</h2>
        <span class="deck">
            <img src={cardBackArt('court')} alt="Court deck" />
            {state.courtDeck.remaining}
        </span>
    </header>
    <div class="cards">
        {#each state.court as slot (slot.cardId)}
            <div class="slot">
                <img class="card" src={cardArt(slot.cardId)} alt={slot.cardId} />
                <div class="agents">
                    {#each Object.entries(slot.agents) as [owner, count] (owner)}
                        <span class="agent">
                            <img src={agentArt(colorOf(owner))} alt="{count} agents" />
                            {#if count > 1}<span class="count">{count}</span>{/if}
                        </span>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</section>

<style>
    .court {
        flex: 1;
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
        color: var(--arcs-gold);
    }

    h2 {
        font-family: 'Arcs Cinzel', serif;
        font-size: 52px;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .deck {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 34px;
    }

    .deck img {
        width: 56px;
        border-radius: 4px;
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 26px 18px;
    }

    .slot {
        position: relative;
    }

    .card {
        width: 100%;
        border-radius: 14px;
        box-shadow: 0 8px 22px rgb(0 0 0 / 0.65);
    }

    .agents {
        position: absolute;
        right: 6px;
        bottom: -18px;
        left: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
    }

    .agent {
        position: relative;
    }

    .agent img {
        width: 64px;
        filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.8));
    }

    .count {
        position: absolute;
        right: -6px;
        bottom: 0;
        min-width: 32px;
        padding: 0 6px;
        border-radius: 16px;
        background: rgb(12 14 22 / 0.92);
        color: #fff;
        font-size: 24px;
        font-weight: 600;
        text-align: center;
    }
</style>
