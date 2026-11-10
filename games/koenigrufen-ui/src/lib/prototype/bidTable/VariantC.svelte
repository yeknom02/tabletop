<script lang="ts">
    // PROTOTYPE C · Value bands, full reference: every contract stays in the table, grouped under a
    // value column that spans its band; ones you can't bid now are dimmed. Basics on one line,
    // details beneath. One click bids.
    import { AllRows, type BidRow, type VariantProps } from './rows.js'
    import { bidKey } from '$lib/utils/contractText.js'

    let { choices, onchoose }: VariantProps = $props()
    const keys = $derived(choices.map(bidKey))

    type Band = { value: string; rows: BidRow[] }
    const bands: Band[] = AllRows.reduce<Band[]>((result, row) => {
        const last = result.at(-1)
        if (last?.value === row.value) {
            last.rows.push(row)
        } else {
            result.push({ value: row.value, rows: [row] })
        }
        return result
    }, [])
</script>

<table class="bands">
    <thead>
        <tr>
            <th class="value">Value</th>
            <th>Contract</th>
        </tr>
    </thead>
    {#each bands as band (band.value)}
        <tbody>
            {#each band.rows as row, index (row.key)}
                {@const open = keys.includes(row.key)}
                <tr class:closed={!open} onclick={() => open && onchoose(row.choice)}>
                    {#if index === 0}
                        <th class="value" rowspan={band.rows.length} scope="rowgroup"
                            >{band.value}</th
                        >
                    {/if}
                    <td>
                        <div class="line">
                            <button
                                type="button"
                                class="name"
                                disabled={!open}
                                onclick={(event) => (event.stopPropagation(), onchoose(row.choice))}
                                >{row.name}</button
                            >
                            <span class="basics"
                                >{row.teams}<i>·</i>{row.goal}<i>·</i>Talon: {row.talon}</span
                            >
                            {#each row.tags as tag (tag.text)}
                                <span class="tag {tag.tone}">{tag.text}</span>
                            {/each}
                            {#if !open}<span class="why">not open to you</span>{/if}
                        </div>
                        <p class="details">{row.details}</p>
                    </td>
                </tr>
            {/each}
        </tbody>
    {/each}
</table>

<style>
    .bands {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        line-height: 1.3;
    }

    thead th {
        padding: 0 10px 5px;
        color: #f2c94c;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-align: left;
        text-transform: uppercase;
    }

    tbody {
        border-top: 1px solid rgb(242 201 76 / 0.35);
    }

    th.value {
        width: 4.5em;
        padding: 8px 10px;
        color: #f2c94c;
        font-size: 1rem;
        font-weight: 700;
        text-align: center;
        vertical-align: middle;
        background: rgb(242 201 76 / 0.07);
        white-space: nowrap;
    }

    thead th.value {
        font-size: 0.72rem;
        background: none;
    }

    td {
        padding: 6px 10px;
        border-bottom: 1px dotted rgb(241 231 207 / 0.12);
    }

    tbody tr:last-child td {
        border-bottom: 0;
    }

    tr:not(.closed) {
        cursor: pointer;
    }

    tr:not(.closed):hover td,
    tr:not(.closed):focus-within td {
        background: rgb(242 201 76 / 0.12);
    }

    .closed td {
        opacity: 0.38;
    }

    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 10px;
    }

    .name {
        min-width: 8.5em;
        padding: 0;
        border: 0;
        background: none;
        color: #f1e7cf;
        font: inherit;
        font-size: 0.95rem;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
    }

    .name:disabled {
        cursor: default;
    }

    .basics {
        opacity: 0.9;
    }

    .basics i {
        margin: 0 6px;
        font-style: normal;
        opacity: 0.4;
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

    .why {
        font-size: 0.72rem;
        font-style: italic;
    }

    .details {
        margin: 2px 0 0;
        font-size: 0.8rem;
        opacity: 0.72;
    }

    @media (max-width: 640px) {
        th.value {
            width: 3em;
            padding: 6px 4px;
            font-size: 0.85rem;
        }

        td {
            padding: 4px 6px;
        }

        .name {
            min-width: 0;
        }

        .details {
            font-size: 0.72rem;
        }
    }
</style>
