<script lang="ts">
    import { PlayKind } from '@tabletop/arcs'
    import { cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const leading = $derived(gameSession.handChoices.some((choice) => choice.lead))
    const PlayLabels: Record<PlayKind, string> = {
        [PlayKind.Lead]: 'Lead',
        [PlayKind.Surpass]: 'Surpass',
        [PlayKind.Copy]: 'Copy',
        [PlayKind.Pivot]: 'Pivot'
    }
</script>

<p class="prompt">{leading ? 'Lead a card, or pass the initiative.' : 'Play a card.'}</p>
<div class="hand">
    {#each gameSession.handChoices as choice (choice.cardId)}
        <div class="card">
            <img src={cardArt(choice.cardId)} alt={choice.cardId} />
            <div class="plays">
                {#if choice.lead}
                    <button
                        type="button"
                        class="choice"
                        onclick={() => gameSession.lead(choice.cardId)}>Lead</button
                    >
                    {#each choice.declare as ambition (ambition)}
                        <button
                            type="button"
                            class="choice small"
                            onclick={() => gameSession.lead(choice.cardId, ambition)}
                            >Lead, declare {ambition}</button
                        >
                    {/each}
                {/if}
                {#each choice.follow as kind (kind)}
                    <button
                        type="button"
                        class="choice"
                        onclick={() => gameSession.follow(choice.cardId, kind)}
                        >{PlayLabels[kind]}</button
                    >
                {/each}
            </div>
        </div>
    {/each}
</div>
{#if gameSession.canPassInitiative}
    <button type="button" class="choice" onclick={() => gameSession.passInitiative()}
        >Pass the initiative</button
    >
{/if}

<style>
    .hand {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 8px 0;
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 120px;
    }

    .card img {
        width: 120px;
        border-radius: 6px;
    }

    .plays {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .small {
        font-size: 0.75rem;
    }
</style>
