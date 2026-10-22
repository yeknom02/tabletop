<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { agentArt, cardArt, cardBackArt } from '$lib/utils/art.js'
    import VoxPicker from './VoxPicker.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.shownState)
    const colorOf = (playerId: string) => state.getPlayerState(playerId).color

    const targeted = (cardId: string) =>
        gameSession.influenceTargets.includes(cardId) ||
        gameSession.secureTargets.includes(cardId) ||
        gameSession.ransackTargets.includes(cardId) ||
        gameSession.belovedTargets.includes(cardId)

    function chooseCard(cardId: string) {
        if (gameSession.influenceTargets.includes(cardId)) {
            void gameSession.influence(cardId)
        } else if (gameSession.belovedTargets.includes(cardId)) {
            void gameSession.belovedInfluence(cardId)
        } else if (gameSession.ransackTargets.includes(cardId)) {
            if (gameSession.canRansackWith(cardId)) void gameSession.ransack(cardId)
            else gameSession.chooseCourtCard(cardId)
        } else if (gameSession.canSecureWith(cardId)) {
            void gameSession.secure(cardId)
        } else {
            gameSession.chooseCourtCard(cardId)
        }
    }

    const securing = $derived(gameSession.ransackTargets.length === 0)
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
            <div
                class="slot"
                {@attach gameSession.highlights.attach(`court:${slot.cardId}`, (shown) =>
                    shown.court.some((candidate) => candidate.cardId === slot.cardId)
                        ? 'in'
                        : undefined
                )}
            >
                {#if targeted(slot.cardId)}
                    <button
                        type="button"
                        id="arcs-court-{slot.cardId}"
                        class="target"
                        aria-label="Choose {slot.cardId}"
                        onclick={() => chooseCard(slot.cardId)}
                    ></button>
                {/if}
                <img class="card" src={cardArt(slot.cardId)} alt={slot.cardId} />
                <div class="agents">
                    {#each Object.entries(slot.agents) as [owner, count] (owner)}
                        <span
                            class="agent"
                            {@attach gameSession.highlights.attach(
                                `court:${slot.cardId}:${owner}`,
                                (shown) =>
                                    String(
                                        shown.court.find(
                                            (candidate) => candidate.cardId === slot.cardId
                                        )?.agents[owner] ?? ''
                                    ) || undefined
                            )}
                        >
                            <img src={agentArt(colorOf(owner))} alt="{count} agents" />
                            {#if count > 1}<span class="count">{count}</span>{/if}
                        </span>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</section>
{#if gameSession.chosenCourtCard}
    <Floater
        reference="#arcs-court-{gameSession.chosenCourtCard}"
        placement="left"
        offset={16}
        onClose={() => gameSession.undo()}
    >
        <VoxPicker
            cardId={gameSession.chosenCourtCard}
            canChoose={(cardId, vox) =>
                securing
                    ? gameSession.canSecureWith(cardId, vox)
                    : gameSession.canRansackWith(cardId, vox)}
            choose={(cardId, vox) =>
                securing ? gameSession.secure(cardId, vox) : gameSession.ransack(cardId, vox)}
        />
    </Floater>
{/if}

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

    .target {
        position: absolute;
        inset: -10px;
        z-index: 1;
        border: 8px solid rgb(255 214 120 / 0.95);
        border-radius: 20px;
        box-shadow: 0 0 30px rgb(255 214 120 / 0.85);
        cursor: pointer;
    }

    .target:hover {
        background: rgb(255 214 120 / 0.15);
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
