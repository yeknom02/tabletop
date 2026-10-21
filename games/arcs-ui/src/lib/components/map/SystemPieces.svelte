<script lang="ts">
    import type { SystemLayout } from '$lib/utils/mapLayout.js'
    import { BuildingSize, ShipWidth } from '$lib/utils/mapLayout.js'
    import { buildingArt, shipArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { layout }: { layout: SystemLayout } = $props()
    const gameSession = getGameSession()
    const colorOf = (playerId: string) => gameSession.gameState.getPlayerState(playerId).color
</script>

{#each layout.buildings as placed (placed.slot)}
    <div
        class="piece building"
        style:left="{placed.at.x}px"
        style:top="{placed.at.y}px"
        style:width="{BuildingSize}px"
        style:height="{BuildingSize}px"
    >
        {#if placed.building}
            <img
                src={buildingArt(
                    colorOf(placed.building.owner),
                    placed.building.kind,
                    placed.building.damaged
                )}
                alt="{placed.building.damaged ? 'Damaged ' : ''}{placed.building.kind}"
            />
        {:else}
            <span class="empty" aria-label="Empty building slot"></span>
        {/if}
    </div>
{/each}
{#each layout.ships as stack (stack.owner)}
    <div class="piece ships" style:left="{stack.at.x}px" style:top="{stack.at.y}px">
        {#if stack.fresh > 0}
            <span class="stack">
                <img
                    src={shipArt(colorOf(stack.owner))}
                    alt="Fresh ships"
                    style:width="{ShipWidth}px"
                />
                {#if stack.fresh > 1}<span class="count">{stack.fresh}</span>{/if}
            </span>
        {/if}
        {#if stack.damaged > 0}
            <span class="stack damaged">
                <img
                    src={shipArt(colorOf(stack.owner))}
                    alt="Damaged ships"
                    style:width="{ShipWidth}px"
                />
                {#if stack.damaged > 1}<span class="count">{stack.damaged}</span>{/if}
            </span>
        {/if}
    </div>
{/each}

<style>
    .piece {
        position: absolute;
        transform: translate(-50%, -50%);
    }

    .building img {
        width: 100%;
        height: 100%;
        filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.75));
    }

    .empty {
        display: block;
        width: 100%;
        height: 100%;
        border: 4px dashed rgb(240 228 200 / 0.5);
        border-radius: 50%;
        background: rgb(10 12 20 / 0.35);
    }

    .ships {
        display: flex;
        gap: 10px;
        align-items: center;
        white-space: nowrap;
    }

    .stack {
        position: relative;
        display: inline-flex;
        align-items: center;
    }

    .stack img {
        filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.75));
    }

    /* A damaged ship is tipped over. */
    .damaged img {
        transform: rotate(-90deg) scale(0.9);
        opacity: 0.9;
    }

    .count {
        position: absolute;
        right: -14px;
        bottom: -12px;
        min-width: 40px;
        padding: 0 8px;
        border: 3px solid rgb(240 228 200 / 0.85);
        border-radius: 22px;
        background: rgb(12 14 22 / 0.92);
        color: #fff;
        font-size: 30px;
        font-weight: 600;
        line-height: 36px;
        text-align: center;
    }
</style>
