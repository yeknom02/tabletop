<script lang="ts">
    // PROTOTYPE I · F's side pane with H's table on wide screens; H itself on phones. The table
    // keeps H's plain columns; the pointed-at bid's description fills the pane, and Besserrufer
    // puts its four bird buttons there. Without hover, tap once to read, again to bid.
    import { MediaQuery } from 'svelte/reactivity'
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'
    import BirdPicker from './BirdPicker.svelte'
    import VariantH from './VariantH.svelte'
    import { groupedRowsFor, type GroupedRow, type VariantProps } from './rows.js'

    let { choices, onchoose }: VariantProps = $props()
    const wide = new MediaQuery('min-width: 641px')
    const rows = $derived(groupedRowsFor(choices))
    const preview = new ChoicePreview<string>()
    const shown = $derived(
        rows.find((row) => row.key === preview.shownAmong(rows.map((row) => row.key)))
    )

    function choose(row: GroupedRow) {
        if (row.birds.length > 0 || (preview.noHover.current && shown?.key !== row.key)) {
            preview.previewed = row.key
            return
        }
        onchoose(row.choice)
    }
</script>

{#if wide.current}
    <div class="split">
        <div class="grid" role="list">
            <div class="head" aria-hidden="true">
                <span class="value">Value</span><span>Contract</span><span>Teams</span><span
                    >Goal</span
                ><span>Talon</span><span>Rules</span>
            </div>
            {#each rows as row (row.key)}
                <div
                    class="row"
                    class:shown={shown?.key === row.key}
                    role="listitem"
                    onpointerenter={(event) => preview.showOnHover(event, row.key)}
                >
                    <button
                        type="button"
                        class="main"
                        onfocus={(event) => preview.showOnKeyboardFocus(event, row.key)}
                        onclick={() => choose(row)}
                    >
                        <span class="value">{row.value}</span>
                        <span class="name">{row.name}</span>
                        <span>{row.teams}</span>
                        <span>{row.goal}</span>
                        <span>{row.talon}</span>
                        <span class="tags">
                            {#each row.tags as tag (tag.text)}
                                <span class="tag {tag.tone}">{tag.text}</span>
                            {/each}
                        </span>
                    </button>
                </div>
            {/each}
        </div>
        <aside aria-live="polite">
            {#if shown}
                <div class="heading">
                    <span class="title">{shown.name}</span>
                    <span class="worth">{shown.value}</span>
                </div>
                <p>{shown.details}</p>
                {#if shown.birds.length > 0}
                    <BirdPicker birds={shown.birds} {onchoose} full />
                {:else if preview.noHover.current}
                    <p class="hint">Tap again to bid.</p>
                {/if}
            {/if}
        </aside>
    </div>
{:else}
    <VariantH {choices} {onchoose} />
{/if}

<style>
    .split {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 17em;
        gap: 14px;
        align-items: start;
    }

    .grid {
        --cols: 2.4rem 7.6rem 3.6rem 8.4rem 6.4rem minmax(6rem, 1fr);
        font-size: 0.85rem;
    }

    .head,
    .main {
        display: grid;
        grid-template-columns: var(--cols);
        align-items: baseline;
        gap: 8px;
    }

    .head {
        padding: 0 8px 4px;
        color: #f2c94c;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-bottom: 1px solid rgb(242 201 76 / 0.45);
    }

    .row {
        border-bottom: 1px solid rgb(241 231 207 / 0.08);
    }

    .main {
        width: 100%;
        padding: 6px 8px;
        border: 0;
        background: none;
        color: #f1e7cf;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .row:hover,
    .shown {
        background: rgb(242 201 76 / 0.12);
    }

    .shown {
        box-shadow: inset 3px 0 0 #f2c94c;
    }

    .value {
        text-align: right;
    }

    .main .value {
        color: #f2c94c;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .name {
        font-weight: 700;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .tag {
        padding: 0 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
    }

    .gold {
        background: rgb(242 201 76 / 0.2);
        color: #f2c94c;
    }

    .muted {
        background: rgb(241 231 207 / 0.12);
    }

    .warn {
        background: rgb(230 110 90 / 0.2);
        color: #f3a493;
    }

    aside {
        position: sticky;
        top: 0;
        min-height: 12em;
        padding: 10px 12px;
        border: 1px solid rgb(242 201 76 / 0.25);
        border-radius: 8px;
        background: rgb(255 255 255 / 0.03);
        font-size: 0.85rem;
        line-height: 1.35;
    }

    aside p {
        margin: 0 0 8px;
    }

    .heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 6px;
    }

    .title {
        font-size: 1.05rem;
        font-weight: 700;
    }

    .worth {
        color: #f2c94c;
        font-weight: 700;
    }

    .hint {
        margin-top: 8px;
        font-style: italic;
        opacity: 0.6;
    }
</style>
