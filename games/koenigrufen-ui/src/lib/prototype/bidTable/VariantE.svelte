<script lang="ts">
    // PROTOTYPE E · Ledger, one Besserrufer row: as A, but Besserrufer is a single row with its
    // value range; its bird buttons sit in the details and bid. Other rows bid on one click.
    import BirdPicker from './BirdPicker.svelte'
    import { groupedRowsFor, type VariantProps } from './rows.js'

    let { choices, onchoose }: VariantProps = $props()
    const rows = $derived(groupedRowsFor(choices))
</script>

<table class="ledger">
    <thead>
        <tr>
            <th class="name">Contract</th>
            <th class="num">Value</th>
            <th>Teams</th>
            <th>Goal</th>
            <th>Talon</th>
            <th class="details">Details</th>
        </tr>
    </thead>
    <tbody>
        {#each rows as row (row.key)}
            {@const grouped = row.birds.length > 0}
            <tr class:grouped onclick={() => !grouped && onchoose(row.choice)}>
                <td class="name">
                    {#if grouped}
                        <span class="label">{row.name}</span>
                    {:else}
                        <button
                            type="button"
                            onclick={(event) => (event.stopPropagation(), onchoose(row.choice))}
                            >{row.name}</button
                        >
                    {/if}
                </td>
                <td class="num"><span class="value">{row.value}</span></td>
                <td class="basic">{row.teams}</td>
                <td class="basic">{row.goal}</td>
                <td class="basic">{row.talon}</td>
                <td class="details">
                    {#each row.tags as tag (tag.text)}
                        <span class="tag {tag.tone}">{tag.text}</span>
                    {/each}
                    {#if grouped}
                        <div class="pick"><BirdPicker birds={row.birds} {onchoose} /></div>
                    {/if}
                    <span class="text">{row.details}</span>
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .ledger {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        line-height: 1.3;
    }

    thead {
        position: sticky;
        top: -8px;
        z-index: 1;
        background: rgb(16 30 21);
    }

    th {
        padding: 4px 8px 6px;
        background: rgb(16 30 21);
        color: #f2c94c;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-align: left;
        text-transform: uppercase;
        border-bottom: 1px solid rgb(242 201 76 / 0.45);
    }

    td {
        padding: 6px 8px;
        vertical-align: top;
        border-bottom: 1px solid rgb(241 231 207 / 0.08);
    }

    tbody tr {
        cursor: pointer;
    }

    tbody tr:hover,
    tbody tr:focus-within {
        background: rgb(242 201 76 / 0.12);
    }

    tbody tr.grouped {
        cursor: default;
    }

    .grouped td {
        background: rgb(242 201 76 / 0.05);
    }

    .label {
        font-weight: 700;
    }

    .pick {
        margin: 3px 0 4px;
    }

    .name button {
        padding: 0;
        border: 0;
        background: none;
        color: #f1e7cf;
        font: inherit;
        font-weight: 700;
        white-space: nowrap;
        cursor: pointer;
    }

    .num {
        text-align: right;
        white-space: nowrap;
    }

    .value {
        color: #f2c94c;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }

    .basic {
        white-space: nowrap;
        opacity: 0.9;
    }

    td.details {
        min-width: 16em;
        opacity: 0.85;
    }

    .tag {
        display: inline-block;
        margin-right: 4px;
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
        color: #f1e7cf;
    }

    .warn {
        background: rgb(230 110 90 / 0.2);
        color: #f3a493;
    }

    @media (max-width: 640px) {
        th:nth-child(3),
        th:nth-child(5),
        td:nth-child(3),
        td:nth-child(5),
        th.details {
            display: none;
        }

        tbody tr {
            display: grid;
            grid-template-columns: 1fr auto auto;
            column-gap: 8px;
            padding: 4px 0;
            border-bottom: 1px solid rgb(241 231 207 / 0.08);
        }

        thead tr {
            display: grid;
            grid-template-columns: 1fr auto auto;
        }

        td {
            padding: 2px 4px;
            border: 0;
        }

        td.details {
            grid-column: 1 / -1;
            min-width: 0;
            font-size: 0.75rem;
        }
    }
</style>
