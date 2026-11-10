<script lang="ts">
    // PROTOTYPE D · Compact, expanding row: a tight scannable grid (value pips, team marks, short
    // goal, symbol flags); the pointed-at row unfolds its details in place. Without hover, tap once
    // to unfold, again to bid.
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'
    import { rowsFor, type BidRow, type Tag, type VariantProps } from './rows.js'

    let { choices, onchoose }: VariantProps = $props()
    const rows = $derived(rowsFor(choices))
    const preview = new ChoicePreview<string>()
    const shown = $derived(preview.shownAmong(rows.map((row) => row.key)))

    const Symbols: Record<string, string> = {
        'Bonuses ×2': '×2',
        'No bonuses': '∅',
        'Valat only': 'V',
        'No trumps': '⊘T',
        'Open hands': '◫',
        'Bird required': 'B',
        'Forehand only': 'F',
        'Opening only': 'F¹'
    }

    function symbol(tag: Tag): string {
        return Symbols[tag.text] ?? tag.text
    }

    function choose(row: BidRow) {
        if (preview.noHover.current && shown !== row.key) {
            preview.previewed = row.key
            return
        }
        onchoose(row.choice)
    }
</script>

<div class="grid" role="list">
    <div class="head" aria-hidden="true">
        <span>Value</span><span>Contract</span><span>Teams</span><span>Goal</span><span>Talon</span
        ><span>Notes</span>
    </div>
    {#each rows as row (row.key)}
        {@const pips = Math.min(row.worth, 8)}
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
                <span class="value">
                    <b>{row.value}</b>
                    <span class="pips" aria-hidden="true"
                        >{'▮'.repeat(pips)}<span class="off">{'▮'.repeat(8 - pips)}</span></span
                    >
                </span>
                <span class="name">{row.name}</span>
                <span class="teams" title={row.teams}>{row.teamGlyph}</span>
                <span>{row.goalShort}</span>
                <span
                    >{row.talon === 'To defenders'
                        ? '→ def.'
                        : row.talon.replace('Take ', '+')}</span
                >
                <span class="flags">
                    {#each row.tags as tag (tag.text)}
                        <span class="flag {tag.tone}" title={tag.text}>{symbol(tag)}</span>
                    {/each}
                </span>
            </button>
            {#if shown === row.key}
                <div class="unfold">
                    <span class="full">{row.teams} · {row.goal} · Talon: {row.talon}</span>
                    {#each row.tags as tag (tag.text)}<span class="tag {tag.tone}">{tag.text}</span
                        >{/each}
                    <p>{row.details}</p>
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .grid {
        --cols: 5.6rem 7.4rem 4.2rem 4.4rem 3.6rem 1fr;
        font-size: 0.85rem;
    }

    .head,
    .main {
        display: grid;
        grid-template-columns: var(--cols);
        align-items: center;
        gap: 6px;
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
        padding: 5px 8px;
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
        display: flex;
        align-items: baseline;
        gap: 6px;
    }

    .value b {
        min-width: 2.2em;
        color: #f2c94c;
        font-size: 0.85em;
        font-variant-numeric: tabular-nums;
    }

    .pips {
        color: #f2c94c;
        font-size: 0.5rem;
        letter-spacing: 1px;
    }

    .off {
        opacity: 0.15;
    }

    .name {
        font-weight: 700;
    }

    .teams {
        font-size: 0.7rem;
        letter-spacing: 1px;
        opacity: 0.85;
    }

    .flags {
        display: flex;
        gap: 4px;
    }

    .flag {
        min-width: 1.6em;
        padding: 0 4px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 700;
        text-align: center;
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
        padding: 0 10px 8px calc(5.6rem + 14px);
        font-size: 0.8rem;
        line-height: 1.35;
    }

    .unfold p {
        margin: 3px 0 0;
        opacity: 0.85;
    }

    .full {
        margin-right: 8px;
        opacity: 0.7;
    }

    .tag {
        margin-right: 4px;
        padding: 0 6px;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
    }

    @media (max-width: 640px) {
        .grid {
            --cols: 2.8rem 1fr 3rem 3.4rem 2.4rem;
            font-size: 0.78rem;
        }

        .pips,
        .head span:last-child,
        .flags {
            display: none;
        }

        .unfold {
            padding-left: 8px;
        }
    }
</style>
