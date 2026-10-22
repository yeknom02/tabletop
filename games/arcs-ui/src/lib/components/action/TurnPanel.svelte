<script lang="ts">
    import { choiceOf } from '$lib/utils/abilities.js'
    import MoveControls from './MoveControls.svelte'
    import GuideControls from './GuideControls.svelte'
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
    type Option = (typeof gameSession.abilityOptions)[number]
    type Choice = { key: string; detail: string; options: Option[] }

    // Options grouped under the card or action named before the colon in their labels, with the
    // ways of making room for one choice kept together.
    const abilityGroups = $derived.by(() => {
        const groups = new Map<string, Map<string, Choice>>()
        for (const option of gameSession.abilityOptions) {
            const key = choiceOf(option)
            const [title, ...rest] = key.split(': ')
            const detail = rest.length > 0 ? rest.join(': ') : 'Use'
            const choices = groups.get(title) ?? new Map<string, Choice>()
            const choice = choices.get(key) ?? { key, detail, options: [] }
            choice.options.push(option)
            choices.set(key, choice)
            groups.set(title, choices)
        }
        return [...groups].map(([title, choices]) => ({ title, choices: [...choices.values()] }))
    })

    const choiceCount = $derived(
        abilityGroups.reduce((sum, group) => sum + group.choices.length, 0)
    )

    // A choice that only fits by discarding shows its discards once picked.
    const withoutDiscard = (choice: Choice) =>
        choice.options.find((option) => (option.makesRoom ?? []).length === 0)
    function pick(choice: Choice) {
        const plain = withoutDiscard(choice)
        if (plain) gameSession.useAbility(plain)
        else if (choice.options.length === 1) gameSession.useAbility(choice.options[0])
        else gameSession.showDiscardsFor(choice.key)
    }

    const movePrompt = $derived(
        gameSession.firstMove
            ? gameSession.sprintOrigin === undefined
                ? 'Choose where the sprint starts.'
                : gameSession.sprintPath.length === 0
                  ? 'Choose where they sprint.'
                  : gameSession.sprintSteps.length > 0
                    ? 'Choose how many sprint, or keep going.'
                    : 'Choose how many sprint.'
            : gameSession.origin === undefined
              ? 'Choose ships to move.'
              : gameSession.path.length === 0
                ? 'Choose where they go.'
                : gameSession.moveSteps.length > 0
                  ? 'Choose how many go, or keep going.'
                  : 'Choose how many go.'
    )
</script>

<div class="turn">
    <p class="prompt">
        {#if gameSession.mustReturnFleet}
            You have nothing left on the map. Choose a gate for 3 new ships.
        {:else if gameSession.guide}
            Choose ships to guide from {gameSession.guide.system} to {gameSession.guide.to}.
        {:else if intent}
            {intent.action === StandardAction.Move ? movePrompt : Prompts[intent.action]}
        {:else}
            {turn?.pips ?? 0} action{turn?.pips === 1 ? '' : 's'} left{turn?.prelude
                ? ', or spend resources first'
                : ''}.
        {/if}
    </p>
    {#if gameSession.guide}
        <GuideControls />
    {:else if gameSession.sprintPath.length > 0}
        <MoveControls sprint />
    {:else if gameSession.path.length > 0 && !gameSession.firstMove}
        <MoveControls />
    {/if}
    {#if !intent && !gameSession.guide && !gameSession.mustReturnFleet}
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
    {#if !intent && !gameSession.guide && (gameSession.abilityOptions.length > 0 || gameSession.farseersDiscards.length > 0)}
        <details class="abilities">
            <summary>Card abilities ({choiceCount + gameSession.farseersDiscards.length})</summary>
            <div class="ability-list">
                {#each abilityGroups as group (group.title)}
                    <div class="group">
                        <span class="group-title">{group.title}</span>
                        {#each group.choices as choice (choice.key)}
                            <button
                                type="button"
                                class="choice"
                                class:open={gameSession.makingRoom === choice.key}
                                onclick={() => pick(choice)}>{choice.detail}</button
                            >
                            {#if gameSession.makingRoom === choice.key && !withoutDiscard(choice)}
                                {#each choice.options as option (option.label)}
                                    <button
                                        type="button"
                                        class="choice discard"
                                        onclick={() => gameSession.useAbility(option)}
                                        >discard {option.makesRoom?.join(' and ')}</button
                                    >
                                {/each}
                            {/if}
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
    {#if gameSession.canEndTurn && !gameSession.mustReturnFleet && !intent && !gameSession.guide}
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

    .choice.open {
        background: rgb(184 145 63 / 0.4);
    }

    .choice.discard {
        font-style: italic;
    }
</style>
