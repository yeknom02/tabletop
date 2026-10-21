<script lang="ts">
    import type { SystemLayout } from '$lib/utils/mapLayout.js'
    import { BuildingSize, ShipWidth } from '$lib/utils/mapLayout.js'
    import { buildingArt, EmptySlotArt, shipArt } from '$lib/utils/art.js'
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
            <img class="empty" src={EmptySlotArt} alt="Empty slot" />
        {/if}
    </div>
{/each}
{#each layout.ships as stack (stack.owner)}
    <div class="piece ships" style:left="{stack.at.x}px" style:top="{stack.at.y}px">
        {#if stack.fresh > 0}
            <span class="stack">
                <img
                    src={shipArt(colorOf(stack.owner), false)}
                    alt="Fresh ships"
                    style:width="{ShipWidth}px"
                />
                {#if stack.fresh > 1}<span class="count">×{stack.fresh}</span>{/if}
            </span>
        {/if}
        {#if stack.damaged > 0}
            <span class="stack">
                <img
                    src={shipArt(colorOf(stack.owner), true)}
                    alt="Damaged ships"
                    style:width="{ShipWidth}px"
                />
                {#if stack.damaged > 1}<span class="count">×{stack.damaged}</span>{/if}
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
        filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.7));
    }

    .building .empty {
        opacity: 0.55;
    }

    .ships {
        display: flex;
        gap: 6px;
        align-items: center;
        white-space: nowrap;
    }

    .stack {
        position: relative;
        display: inline-flex;
        align-items: center;
    }

    .stack img {
        filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.7));
    }

    .count {
        margin-left: 2px;
        padding: 0 8px;
        border-radius: 14px;
        background: rgb(10 12 20 / 0.85);
        color: #fff;
        font-size: 30px;
        font-weight: 700;
    }
</style>
