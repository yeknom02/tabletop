<script lang="ts">
    // PROTOTYPE H · Compact, one Besserrufer row: one line per bid in plain words (value, teams,
    // goal, talon, rule tags); the pointed-at row unfolds its details in place, and Besserrufer
    // unfolds its four bird buttons. Without hover, tap once to unfold, again to bid.
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'
    import BirdPicker from './BirdPicker.svelte'
    import { groupedRowsFor, type GroupedRow, type VariantProps } from './rows.js'

    let { choices, onchoose }: VariantProps = $props()
    const rows = $derived(groupedRowsFor(choices))
    const preview = new ChoicePreview<string>()
    const shown = $derived(preview.shownAmong(rows.map((row) => row.key)))

    function choose(row: GroupedRow) {
        if (row.birds.length > 0 || (preview.noHover.current && shown !== row.key)) {
            preview.previewed = row.key
            return
        }
        onchoose(row.choice)
    }
</script>

<div class="grid" role="list">
    <div class="head" aria-hidden="true">
        <span class="value">Value</span><span>Contract</span><span>Teams</span><span>Goal</span
        ><span class="wide">Talon</span><span class="wide">Rules</span>
    </div>
    {#each rows as row (row.key)}
        <div
            class="row"
            class:shown={shown === row.key}
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
                <span
                    ><span class="long">{row.goal}</span><span class="short">{row.goalShort}</span
                    ></span
                >
                <span class="extra">
                    <span class="talon"><span class="label">Talon:</span> {row.talon}</span>
                    <span class="tags">
                        {#each row.tags as tag (tag.text)}
                            <span class="tag {tag.tone}">{tag.text}</span>
                        {/each}
                    </span>
                </span>
            </button>
            {#if shown === row.key}
                <div class="unfold">
                    <p>{row.details}</p>
                    {#if row.birds.length > 0}
                        <div class="pick"><BirdPicker birds={row.birds} {onchoose} /></div>
                    {/if}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .grid {
        --cols: 2.6rem 7.6rem 4.6rem 8.6rem 6.4rem 1fr;
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
        background: rgb(242 201 76 / 0.1);
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

    .short,
    .label {
        display: none;
    }

    /* Talon and rule tags are two columns here; on phones they share a second line. */
    .extra {
        display: contents;
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

    .unfold {
        padding: 0 10px 8px calc(2.6rem + 16px);
        font-size: 0.8rem;
        line-height: 1.35;
    }

    .unfold p {
        margin: 0;
        opacity: 0.85;
    }

    .pick {
        margin-top: 6px;
    }

    @media (max-width: 640px) {
        .grid {
            --cols: 2.2rem 1fr 3.2rem 4.6rem;
            font-size: 0.78rem;
        }

        .head .wide,
        .long {
            display: none;
        }

        .short,
        .label {
            display: inline;
        }

        .label {
            opacity: 0.6;
        }

        .extra {
            display: flex;
            flex-wrap: wrap;
            grid-column: 2 / -1;
            align-items: baseline;
            gap: 4px 8px;
            font-size: 0.72rem;
        }

        .unfold {
            padding-left: calc(2.2rem + 16px);
        }
    }
</style>
