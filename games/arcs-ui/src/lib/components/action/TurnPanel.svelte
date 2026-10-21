<script lang="ts">
    import { StandardAction } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { resourceIconArt } from '$lib/utils/art.js'

    const gameSession = getGameSession()
    const turn = $derived(gameSession.gameState.turn)
    const intent = $derived(gameSession.intent)

    const ActionNames: Record<StandardAction, string> = {
        [StandardAction.Tax]: 'Tax',
        [StandardAction.Build]: 'Build',
        [StandardAction.Move]: 'Move',
        [StandardAction.Repair]: 'Repair',
        [StandardAction.Influence]: 'Influence',
        [StandardAction.Secure]: 'Secure',
        [StandardAction.Battle]: 'Battle'
    }
    const Prompts: Record<StandardAction, string> = {
        [StandardAction.Tax]: 'Choose a city to tax.',
        [StandardAction.Build]: 'Choose where to build, or a starport to build a ship.',
        [StandardAction.Move]: 'Choose ships to move.',
        [StandardAction.Repair]: 'Choose something to repair.',
        [StandardAction.Influence]: 'Choose a Court card to influence.',
        [StandardAction.Secure]: 'Choose a Court card to secure.',
        [StandardAction.Battle]: 'Choose where to battle.'
    }
    // Options grouped under the card or action named before the colon in their labels.
    const abilityGroups = $derived.by(() => {
        const groups = new Map<
            string,
            { option: (typeof gameSession.abilityOptions)[number]; detail: string }[]
        >()
        for (const option of gameSession.abilityOptions) {
            const [title, ...rest] = option.label.split(': ')
            const detail = rest.length > 0 ? rest.join(': ') : 'Use'
            groups.set(title, [...(groups.get(title) ?? []), { option, detail }])
        }
        return [...groups].map(([title, options]) => ({ title, options }))
    })

    const movePrompt = $derived(
        gameSession.origin === undefined
            ? 'Choose ships to move.'
            : gameSession.path.length === 0
              ? 'Choose where they go.'
              : 'Choose how many go, or keep going.'
    )
</script>

<div class="turn">
    <p class="prompt">
        {#if gameSession.mustReturnFleet}
            You have nothing left on the map. Choose a gate for 3 new ships.
        {:else if intent}
            {intent.action === StandardAction.Move ? movePrompt : Prompts[intent.action]}
        {:else}
            {turn?.pips ?? 0} action{turn?.pips === 1 ? '' : 's'} left{turn?.prelude
                ? ', or spend resources first'
                : ''}.
        {/if}
    </p>
    {#if !intent && !gameSession.mustReturnFleet}
        <div class="offers">
            {#each gameSession.actionOffers as offer (offer.action)}
                <div class="offer">
                    <span class="name">{ActionNames[offer.action]}</span>
                    {#each offer.payments as payment (payment.label)}
                        <button
                            type="button"
                            class="choice pay"
                            onclick={() =>
                                gameSession.chooseIntent({ action: offer.action, payment })}
                        >
                            {#if payment.via}
                                <img
                                    src={resourceIconArt(payment.token ?? payment.via)}
                                    alt={payment.label}
                                />
                            {/if}
                            {payment.via ? '' : payment.label}
                        </button>
                    {/each}
                </div>
            {/each}
            {#if gameSession.weaponTokens.length > 0}
                <div class="offer">
                    <span class="name">Weapon: pips may battle</span>
                    {#each gameSession.weaponTokens as token (token)}
                        <button
                            type="button"
                            class="choice pay"
                            onclick={() => gameSession.spendWeapon(token)}
                        >
                            <img src={resourceIconArt(token)} alt={token} />
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
    {#if !intent && (gameSession.abilityOptions.length > 0 || gameSession.farseersDiscards.length > 0)}
        <details class="abilities">
            <summary
                >Card abilities ({gameSession.abilityOptions.length +
                    gameSession.farseersDiscards.length})</summary
            >
            <div class="ability-list">
                {#each abilityGroups as group (group.title)}
                    <div class="group">
                        <span class="group-title">{group.title}</span>
                        {#each group.options as { option, detail } (option.label)}
                            <button
                                type="button"
                                class="choice"
                                onclick={() => gameSession.useAbility(option)}>{detail}</button
                            >
                        {/each}
                    </div>
                {/each}
                {#each gameSession.farseersDiscards as discards (discards.join())}
                    <button
                        type="button"
                        class="choice"
                        onclick={() => gameSession.useFarseers(discards)}
                    >
                        Farseers: discard {discards.length > 0
                            ? discards.join(', ')
                            : 'only Farseers'}, draw {discards.length + 1}
                    </button>
                {/each}
            </div>
        </details>
    {/if}
    {#if gameSession.canEndTurn && !gameSession.mustReturnFleet && !intent}
        <button type="button" class="choice end" onclick={() => gameSession.endTurn()}
            >End turn</button
        >
    {/if}
</div>

<style>
    .turn {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 14px;
    }

    .prompt {
        flex-basis: 100%;
    }

    .offers {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
    }

    .offer {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .name {
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }

    .pay {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
    }

    .pay img {
        width: 22px;
        height: 22px;
    }

    .end {
        margin-left: auto;
    }

    .abilities {
        flex-basis: 100%;
    }

    .abilities summary {
        cursor: pointer;
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }

    .ability-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 220px;
        margin-top: 6px;
        overflow: auto;
    }

    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }

    .group-title {
        min-width: 130px;
        font-weight: 600;
    }
</style>
