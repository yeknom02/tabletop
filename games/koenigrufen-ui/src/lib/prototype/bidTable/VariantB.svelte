<script lang="ts">
    // PROTOTYPE B · Table + detail pane: a lean table of the basics; the pointed-at contract's
    // details fill a pane beside it (below it on phones). Without hover, tap once to read, again to bid.
    import { ChoicePreview } from '$lib/utils/choicePreview.svelte.js'
    import { rowsFor, type BidRow, type VariantProps } from './rows.js'

    let { choices, onchoose }: VariantProps = $props()
    const rows = $derived(rowsFor(choices))
    const preview = new ChoicePreview<string>()
    const shown = $derived(
        rows.find((row) => row.key === preview.shownAmong(rows.map((row) => row.key)))
    )

    function choose(row: BidRow) {
        if (preview.noHover.current && shown?.key !== row.key) {
            preview.previewed = row.key
            return
        }
        onchoose(row.choice)
    }
</script>

<div class="split">
    <table>
        <thead>
            <tr>
                <th class="num">Value</th>
                <th>Contract</th>
                <th>Teams</th>
                <th>Goal</th>
                <th>Talon</th>
            </tr>
        </thead>
        <tbody>
            {#each rows as row (row.key)}
                <tr
                    class:shown={shown?.key === row.key}
                    onpointerenter={(event) => preview.showOnHover(event, row.key)}
                    onclick={() => choose(row)}
                >
                    <td class="num">{row.value}</td>
                    <td class="name">
                        <button
                            type="button"
                            onfocus={(event) => preview.showOnKeyboardFocus(event, row.key)}
                            onclick={(event) => (event.stopPropagation(), choose(row))}
                            >{row.name}</button
                        >
                    </td>
                    <td>{row.teams}</td>
                    <td>{row.goal}</td>
                    <td>{row.talon}</td>
                </tr>
            {/each}
        </tbody>
    </table>
    <aside aria-live="polite">
        {#if shown}
            <div class="heading">
                <span class="title">{shown.name}</span>
                <span class="value">{shown.value}</span>
            </div>
            <dl>
                <dt>Teams</dt>
                <dd>{shown.teams}</dd>
                <dt>Goal</dt>
                <dd>{shown.goal}</dd>
                <dt>Talon</dt>
                <dd>{shown.talon}</dd>
            </dl>
            {#if shown.tags.length > 0}
                <div class="tags">
                    {#each shown.tags as tag (tag.text)}
                        <span class="tag {tag.tone}">{tag.text}</span>
                    {/each}
                </div>
            {/if}
            <p>{shown.details}</p>
            <p class="hint">
                {preview.noHover.current ? 'Tap again to bid.' : 'Click to bid.'}
            </p>
        {:else}
            <p class="hint">
                {preview.noHover.current
                    ? 'Tap a contract to read it, then tap again to bid.'
                    : 'Point at a contract to read it; click to bid.'}
            </p>
        {/if}
    </aside>
</div>

<style>
    .split {
        display: grid;
        grid-template-columns: auto minmax(14em, 1fr);
        gap: 14px;
        align-items: start;
    }

    table {
        border-collapse: collapse;
        font-size: 0.85rem;
    }

    th {
        padding: 2px 8px 5px;
        color: #f2c94c;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-align: left;
        text-transform: uppercase;
        border-bottom: 1px solid rgb(242 201 76 / 0.45);
    }

    td {
        padding: 5px 8px;
        white-space: nowrap;
        border-bottom: 1px solid rgb(241 231 207 / 0.08);
    }

    tbody tr {
        cursor: pointer;
    }

    tbody tr:hover,
    .shown {
        background: rgb(242 201 76 / 0.14);
    }

    .shown td:first-child {
        box-shadow: inset 3px 0 0 #f2c94c;
    }

    .num {
        color: #f2c94c;
        font-weight: 700;
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .name button {
        padding: 0;
        border: 0;
        background: none;
        color: #f1e7cf;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
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

    .value {
        color: #f2c94c;
        font-weight: 700;
    }

    dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2px 10px;
        margin: 0 0 8px;
    }

    dt {
        color: #f2c94c;
        font-size: 0.75rem;
        opacity: 0.85;
    }

    dd {
        margin: 0;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 6px;
    }

    .tag {
        padding: 0 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 600;
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

    .hint {
        margin-top: 8px;
        font-style: italic;
        opacity: 0.6;
    }

    @media (max-width: 640px) {
        .split {
            grid-template-columns: 1fr;
            gap: 8px;
        }

        table {
            width: 100%;
            font-size: 0.78rem;
        }

        th:nth-child(5),
        td:nth-child(5) {
            display: none;
        }

        td,
        th {
            padding: 4px 5px;
        }

        aside {
            position: static;
            min-height: 8em;
            font-size: 0.78rem;
        }

        dl {
            display: none;
        }
    }
</style>
