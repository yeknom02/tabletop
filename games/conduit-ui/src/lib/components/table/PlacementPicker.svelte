<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cellElementId } from '$lib/utils/boardLayout.js'
    import { tileFaceUrl } from '$lib/utils/tileArt.js'

    const gameSession = getGameSession()
    const cell = $derived(gameSession.chosenCell)
    const tileId = $derived(gameSession.placement?.tileId)
    const rotations = $derived(gameSession.rotationsForChosenCell)
    const rotation = $derived(gameSession.chosenRotation)
    const cubeChoices = $derived(
        Array.from({ length: gameSession.mySupply + 1 }, (_, count) => count)
    )
</script>

{#if cell && tileId !== undefined && !gameSession.busy}
    {#key `${cell.col},${cell.row}`}
        <Floater placement="right" reference="#{cellElementId(cell)}" trigger="manual">
            <div class="picker">
                {#if rotations.length > 1}
                    <div class="title">Turn the tile</div>
                    <div class="row">
                        {#each rotations as choice (choice)}
                            <button
                                type="button"
                                class="turn"
                                class:selected={rotation === choice}
                                aria-label="Turn {choice * 90} degrees"
                                onclick={() => gameSession.chooseRotation(choice)}
                            >
                                <img
                                    src={tileFaceUrl(tileId)}
                                    alt=""
                                    style:transform="rotate({choice * 90}deg)"
                                />
                            </button>
                        {/each}
                    </div>
                {/if}
                {#if rotation !== undefined}
                    <div class="title">Extra cubes</div>
                    <div class="row">
                        {#each cubeChoices as count (count)}
                            <button
                                type="button"
                                class="count"
                                onclick={() => gameSession.chooseExtraCubes(count)}>{count}</button
                            >
                        {/each}
                    </div>
                {/if}
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        padding: 10px;
        border-radius: 10px;
        color: #e8eef6;
        background: #18212d;
        box-shadow:
            inset 0 0 0 1px #33445a,
            0 8px 20px rgb(0 0 0 / 0.5);
    }

    .title {
        margin: 2px 2px 6px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #93a4b8;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-width: 240px;
    }

    .row + .title {
        margin-top: 10px;
    }

    .turn {
        width: 52px;
        height: 52px;
        padding: 2px;
        border-radius: 6px;
        background: #222e3d;
        box-shadow: inset 0 0 0 1px #33445a;
    }

    .turn img {
        width: 100%;
        height: 100%;
    }

    .turn.selected {
        box-shadow: inset 0 0 0 3px #f5c542;
    }

    .count {
        min-width: 36px;
        height: 36px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 700;
        color: #e8eef6;
        background: #222e3d;
        box-shadow: inset 0 0 0 1px #33445a;
    }

    .turn:hover,
    .count:hover {
        background: #33445a;
    }
</style>
