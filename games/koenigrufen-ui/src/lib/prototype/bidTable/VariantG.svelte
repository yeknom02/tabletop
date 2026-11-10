<script lang="ts">
    // PROTOTYPE G · Value ladder, Besserrufer column: open bids grouped in value bands; Besserrufer
    // gets its own column, one rail down the ladder with each bird at the band of its value.
    // One click bids.
    import { bonusGoal, bonusName } from '$lib/utils/announcementText.js'
    import { rowsFor, type BidRow, type VariantProps } from './rows.js'

    let { choices, onchoose }: VariantProps = $props()

    type Band = { worth: number; rows: BidRow[]; bird: BidRow | undefined }

    const bands = $derived(
        rowsFor(choices).reduce<Band[]>((result, row) => {
            let band = result.find((entry) => entry.worth === row.worth)
            if (!band) {
                band = { worth: row.worth, rows: [], bird: undefined }
                result.push(band)
            }
            if (row.choice.bird === undefined) {
                band.rows.push(row)
            } else {
                band.bird = row
            }
            return result
        }, [])
    )
    const firstBird = $derived(bands.findIndex((band) => band.bird))
    const lastBird = $derived(bands.findLastIndex((band) => band.bird))

    function birdGoal(row: BidRow): string {
        return row.choice.bird === undefined ? '' : bonusGoal(row.choice.bird)
    }

    function birdName(row: BidRow): string {
        return row.choice.bird === undefined ? row.name : bonusName(row.choice.bird)
    }
</script>

<table class="ladder">
    <thead>
        <tr>
            <th class="value">Value</th>
            <th>Contract</th>
            <th class="besser">Besserrufer <small>call a King, name a bird</small></th>
        </tr>
    </thead>
    <tbody>
        {#each bands as band, index (band.worth)}
            <tr>
                <th class="value" scope="row">{band.worth}</th>
                <td class="contracts">
                    {#each band.rows as row (row.key)}
                        <button type="button" class="line" onclick={() => onchoose(row.choice)}>
                            <span class="name">{row.name}</span>
                            {#if row.value !== String(row.worth)}
                                <span class="loss">{row.value}</span>
                            {/if}
                            <span class="basics"
                                >{row.teams}<i>·</i>{row.goal}<i>·</i>Talon: {row.talon}</span
                            >
                            {#each row.tags as tag (tag.text)}
                                <span class="tag {tag.tone}">{tag.text}</span>
                            {/each}
                            <span class="details">{row.details}</span>
                        </button>
                    {/each}
                </td>
                <td
                    class="besser"
                    class:rail={firstBird >= 0 && index >= firstBird && index <= lastBird}
                    class:start={index === firstBird}
                    class:end={index === lastBird}
                >
                    {#if band.bird}
                        {@const bird = band.bird}
                        <button type="button" class="bird" onclick={() => onchoose(bird.choice)}>
                            <span class="birdname">{birdName(bird)} <b>{bird.value}</b></span>
                            <span class="goal">{birdGoal(bird)}</span>
                        </button>
                    {/if}
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .ladder {
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
        border-bottom: 1px solid rgb(242 201 76 / 0.45);
    }

    thead small {
        display: block;
        font-size: 0.68rem;
        font-weight: 400;
        letter-spacing: 0;
        text-transform: none;
        opacity: 0.75;
    }

    tbody tr {
        border-bottom: 1px solid rgb(241 231 207 / 0.1);
    }

    th.value {
        width: 3.5em;
        padding: 6px 8px;
        color: #f2c94c;
        font-size: 1rem;
        font-weight: 700;
        text-align: center;
        vertical-align: middle;
        background: rgb(242 201 76 / 0.07);
    }

    thead th.value {
        font-size: 0.72rem;
        background: none;
    }

    td {
        padding: 3px 6px;
        vertical-align: middle;
    }

    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 10px;
        width: 100%;
        padding: 4px 6px;
        border: 0;
        border-radius: 6px;
        background: none;
        color: #f1e7cf;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .line:hover,
    .line:focus-visible {
        background: rgb(242 201 76 / 0.12);
    }

    .name {
        min-width: 8em;
        font-size: 0.95rem;
        font-weight: 700;
    }

    .loss {
        color: #f2c94c;
        font-size: 0.75rem;
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

    .details {
        flex-basis: 100%;
        font-size: 0.78rem;
        opacity: 0.7;
    }

    .besser {
        width: 11em;
        position: relative;
    }

    td.rail::before {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 14px;
        border-left: 2px solid rgb(242 201 76 / 0.5);
        content: '';
    }

    td.start::before {
        top: 50%;
    }

    td.end::before {
        bottom: 50%;
    }

    td.start.end::before {
        display: none;
    }

    .bird {
        position: relative;
        display: grid;
        width: 100%;
        padding: 4px 8px 4px 10px;
        border: 1px solid rgb(242 201 76 / 0.6);
        border-radius: 8px;
        background: rgb(22 40 28);
        color: #f1e7cf;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }

    .bird:hover,
    .bird:focus-visible {
        background: rgb(70 66 30);
    }

    .birdname {
        font-weight: 700;
    }

    .birdname b {
        color: #f2c94c;
    }

    .goal {
        font-size: 0.72rem;
        opacity: 0.75;
    }

    @media (max-width: 640px) {
        th.value {
            width: 2.4em;
            padding: 4px;
            font-size: 0.85rem;
        }

        .name {
            min-width: 0;
        }

        .basics,
        .details,
        .goal {
            display: none;
        }

        .besser {
            width: 6em;
        }
    }
</style>
