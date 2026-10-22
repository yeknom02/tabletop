<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { PlayKind } from '@tabletop/arcs'
    import { cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const leading = $derived(gameSession.handChoices.some((choice) => choice.lead))
    const chosen = $derived(
        gameSession.handChoices.find((choice) => choice.cardId === gameSession.chosenHandCard)
    )
    const PlayLabels: Record<PlayKind, string> = {
        [PlayKind.Lead]: 'Lead',
        [PlayKind.Surpass]: 'Surpass',
        [PlayKind.Copy]: 'Copy',
        [PlayKind.Pivot]: 'Pivot'
    }
    const playable = (choice: (typeof gameSession.handChoices)[number]) =>
        choice.lead || choice.follow.length > 0
</script>

<div class="row">
    <p class="prompt">{leading ? 'Lead a card, or pass the initiative.' : 'Play a card.'}</p>
    {#if gameSession.canPassInitiative}
        <button type="button" class="choice" onclick={() => gameSession.passInitiative()}
            >Pass the initiative</button
        >
    {/if}
</div>
<div class="hand">
    {#each gameSession.handChoices as choice (choice.cardId)}
        <button
            type="button"
            id="arcs-hand-{choice.cardId}"
            class="card"
            class:chosen={choice.cardId === gameSession.chosenHandCard}
            disabled={!playable(choice)}
            onclick={() => gameSession.chooseHandCard(choice.cardId)}
        >
            <img src={cardArt(choice.cardId)} alt={choice.cardId} />
        </button>
    {/each}
</div>
{#if chosen}
    <Floater
        reference="#arcs-hand-{chosen.cardId}"
        placement="bottom"
        offset={10}
        onClose={() => gameSession.resetAction()}
    >
        <div class="picker">
            {#if chosen.lead}
                <button type="button" class="choice" onclick={() => gameSession.lead(chosen.cardId)}
                    >Lead</button
                >
                {#each chosen.declare as ambition (ambition)}
                    <button
                        type="button"
                        class="choice"
                        onclick={() => gameSession.lead(chosen.cardId, ambition)}
                        >Lead and declare {ambition}</button
                    >
                {/each}
            {/if}
            {#each chosen.follow as kind (kind)}
                <button
                    type="button"
                    class="choice"
                    onclick={() => gameSession.follow(chosen.cardId, kind)}
                    >{PlayLabels[kind]}</button
                >
            {/each}
        </div>
    </Floater>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .hand {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
    }

    .card img {
        width: 76px;
        border-radius: 5px;
        box-shadow: 0 3px 8px rgb(0 0 0 / 0.5);
        transition: transform 120ms ease;
    }

    .card:not(:disabled):hover img,
    .chosen img {
        transform: translateY(-4px);
        outline: 3px solid var(--arcs-gold);
    }

    .card:disabled img {
        filter: grayscale(0.7) brightness(0.6);
    }

    .picker {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px;
        border: 2px solid var(--arcs-gold);
        border-radius: 10px;
        background: var(--arcs-paper);
        box-shadow: 0 10px 24px rgb(0 0 0 / 0.6);
        text-transform: capitalize;
    }
</style>
