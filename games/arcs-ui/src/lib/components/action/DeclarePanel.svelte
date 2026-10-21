<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { DeclareStep } from '@tabletop/arcs'
    import { cardArt, resourceIconArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import VoxPicker from '$lib/components/board/VoxPicker.svelte'

    const gameSession = getGameSession()
    const step = $derived(gameSession.declareStep)
    const declaration = $derived(gameSession.declaration)
    const me = gameSession.myPlayerId()
    const myGuildCards = $derived(gameSession.gameState.getPlayerState(me).guildCards)
    const rivals = $derived(gameSession.gameState.turnManager.turnOrder.filter((id) => id !== me))

    let boldCards: string[] = $state([])
    const toggleBold = (cardId: string) => {
        boldCards = boldCards.includes(cardId)
            ? boldCards.filter((other) => other !== cardId)
            : [...boldCards, cardId]
    }

    let give: string | undefined = $state()
    let take: string | undefined = $state()
</script>

{#if step === DeclareStep.Generous}
    <p class="prompt">Generous: give a Guild card to the Rival with the least Power.</p>
    {#each myGuildCards as cardId (cardId)}
        <div class="row">
            <img class="card" src={cardArt(cardId)} alt={cardId} />
            {#each gameSession.generousRivals as rival (rival)}
                <button
                    type="button"
                    class="choice"
                    onclick={() => gameSession.giveGuildCard(cardId, rival)}
                >
                    Give to <PlayerName playerId={rival} />
                </button>
            {/each}
        </div>
    {/each}
{:else if step === DeclareStep.Connected && declaration?.drawn}
    <p class="prompt">Connected: you secured this card from the Court deck.</p>
    <div class="row">
        <img class="card" src={cardArt(declaration.drawn)} alt={declaration.drawn} />
        <VoxPicker
            cardId={declaration.drawn}
            canChoose={(_cardId, vox) => gameSession.canResolveConnectedWith(vox)}
            choose={(_cardId, vox) => gameSession.resolveConnected(vox)}
        />
    </div>
{:else if step === DeclareStep.Ambitious}
    <p class="prompt">Ambitious: gain any resource.</p>
    <div class="row">
        {#each gameSession.ambitiousGains as option (option.resource)}
            {#each option.discards as discard (discard.join())}
                <button
                    type="button"
                    class="choice pay"
                    onclick={() => gameSession.gainOnDeclaring(option.resource, discard)}
                >
                    <img src={resourceIconArt(option.resource)} alt={option.resource} />
                    {discard.length > 0 ? `discard ${discard.join(', ')}` : ''}
                </button>
            {/each}
        {/each}
        <button type="button" class="choice" onclick={() => gameSession.gainOnDeclaring()}
            >None</button
        >
    </div>
{:else if step === DeclareStep.Bold}
    <p class="prompt">Bold: influence any Court cards, once each.</p>
    <div class="row">
        {#each gameSession.gameState.court as slot (slot.cardId)}
            <button
                type="button"
                class="card-button"
                class:on={boldCards.includes(slot.cardId)}
                aria-pressed={boldCards.includes(slot.cardId)}
                onclick={() => toggleBold(slot.cardId)}
            >
                <img class="card" src={cardArt(slot.cardId)} alt={slot.cardId} />
            </button>
        {/each}
        <button
            type="button"
            class="choice"
            disabled={!gameSession.canBoldInfluence(boldCards)}
            onclick={() => gameSession.boldInfluence(boldCards)}
        >
            Influence {boldCards.length}
        </button>
    </div>
{:else if step === DeclareStep.Farsee}
    <p class="prompt">Farseers: look at a Rival's hand.</p>
    <div class="row">
        {#each rivals as rival (rival)}
            <button type="button" class="choice" onclick={() => gameSession.farsee(rival)}>
                <PlayerName playerId={rival} />
            </button>
        {/each}
    </div>
{:else if step === DeclareStep.Swap && declaration?.rival}
    <p class="prompt">Swap one of your cards for one of theirs, or neither.</p>
    <div class="row">
        <span class="label">Theirs</span>
        {#each declaration.rivalHand ?? [] as cardId, index (`${cardId}-${index}`)}
            <button
                type="button"
                class="card-button"
                class:on={take === cardId}
                onclick={() => (take = cardId)}
            >
                <img class="card" src={cardArt(cardId)} alt={cardId} />
            </button>
        {/each}
    </div>
    <div class="row">
        <span class="label">Yours</span>
        {#each gameSession.myHand as cardId, index (`${cardId}-${index}`)}
            <button
                type="button"
                class="card-button"
                class:on={give === cardId}
                onclick={() => (give = cardId)}
            >
                <img class="card" src={cardArt(cardId)} alt={cardId} />
            </button>
        {/each}
    </div>
    <div class="row">
        <button
            type="button"
            class="choice"
            disabled={!give || !take}
            onclick={() => gameSession.swapWithRival(give, take)}>Swap</button
        >
        <button type="button" class="choice" onclick={() => gameSession.swapWithRival()}
            >Don't swap</button
        >
    </div>
{/if}

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
    }

    .card {
        width: 64px;
        border-radius: 4px;
    }

    .card-button.on .card {
        outline: 3px solid #b8913f;
    }

    .label {
        width: 50px;
    }

    .pay {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .pay img {
        width: 22px;
    }
</style>
