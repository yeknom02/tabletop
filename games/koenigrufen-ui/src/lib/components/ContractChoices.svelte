<script lang="ts">
    import type { BidChoice } from '@tabletop/koenigrufen'
    import {
        bidHeading,
        bidKey,
        bidName,
        bidValueText,
        contractSummary
    } from '$lib/utils/contractText.js'
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'
    import ChoiceSummary from './ChoiceSummary.svelte'

    let {
        choices,
        onchoose
    }: {
        choices: readonly BidChoice[]
        onchoose: (choice: BidChoice) => void
    } = $props()

    // Without hover, the first tap shows the summary and a second tap on it chooses.
    const preview = new ChoicePreview<string>()
    const shownKey = $derived(preview.shownAmong(choices.map(bidKey)))
    const shown = $derived(choices.find((choice) => bidKey(choice) === shownKey))

    function choose(choice: BidChoice) {
        if (preview.noHover.current && shownKey !== bidKey(choice)) {
            preview.previewed = bidKey(choice)
            return
        }
        onchoose(choice)
    }
</script>

<div class="choices">
    {#each choices as choice (bidKey(choice))}
        {@const key = bidKey(choice)}
        <button
            type="button"
            class="choice contract"
            class:previewed={shownKey === key}
            onpointerenter={(event) => preview.showOnHover(event, key)}
            onfocus={(event) => preview.showOnKeyboardFocus(event, key)}
            onclick={() => choose(choice)}
        >
            <span>{bidName(choice)}</span>
            <span class="value" title="Points from each opponent">{bidValueText(choice)}</span>
        </button>
    {/each}
</div>
<ChoiceSummary
    heading={shown ? bidHeading(shown) : undefined}
    summary={shown ? contractSummary(shown) : undefined}
    hint={preview.noHover.current
        ? 'Tap a contract to see what it takes, then tap it again to choose it.'
        : 'Point at a contract to see what it takes.'}
/>

<style>
    .contract {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .value {
        min-width: 1.6em;
        padding: 0 5px;
        border-radius: 999px;
        background: rgb(242 201 76 / 0.2);
        color: #f2c94c;
        font-size: 0.8em;
        font-weight: 700;
        text-align: center;
    }

    .previewed {
        box-shadow: 0 0 0 2px #f2c94c;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    @media (max-width: 640px) {
        .choices {
            gap: 4px;
        }

        .contract {
            gap: 4px;
        }

        .value {
            min-width: 1.4em;
            padding: 0 4px;
        }
    }
</style>
