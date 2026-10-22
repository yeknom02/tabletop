<script lang="ts">
    import { BuildingSize, ShipWidth } from '$lib/utils/mapLayout.js'
    import { buildingArt, shipArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const colorOf = (playerId: string) => gameSession.gameState.getPlayerState(playerId).color
</script>

{#snippet ship(owner: string, count: number, damaged: boolean)}
    <span class="stack" class:damaged>
        <img
            src={shipArt(colorOf(owner))}
            alt="{damaged ? 'Damaged' : 'Fresh'} ships"
            style:width="{ShipWidth}px"
        />
        {#if count > 1}<span class="count">{count}</span>{/if}
    </span>
{/snippet}

{#each gameSession.mapPieces as piece (piece.key)}
    <div
        class="piece"
        style:left="{piece.at.x}px"
        style:top="{piece.at.y}px"
        {@attach gameSession.mapAnimator.attach(piece.key)}
    >
        {#if piece.kind === 'building'}
            <img
                class="building"
                src={buildingArt(
                    colorOf(piece.building.owner),
                    piece.building.kind,
                    piece.building.damaged
                )}
                alt="{piece.building.damaged ? 'Damaged ' : ''}{piece.building.kind}"
                style:width="{BuildingSize}px"
                style:height="{BuildingSize}px"
            />
        {:else if piece.kind === 'slot'}
            <span
                class="empty"
                aria-label="Empty building slot"
                style:width="{BuildingSize}px"
                style:height="{BuildingSize}px"
            ></span>
        {:else}
            <span class="ships">
                {#if piece.fresh > 0}{@render ship(piece.owner, piece.fresh, false)}{/if}
                {#if piece.damaged > 0}{@render ship(piece.owner, piece.damaged, true)}{/if}
            </span>
        {/if}
    </div>
{/each}
{#each gameSession.flights as flight (flight.key)}
    <div
        class="piece flight"
        style:left="{flight.points[0].x}px"
        style:top="{flight.points[0].y}px"
        {@attach gameSession.mapAnimator.attach(flight.key)}
    >
        <span class="ships">{@render ship(flight.owner, flight.ships, false)}</span>
    </div>
{/each}

<style>
    /* Placed at its centre with no transform of its own, so the animator owns the transform. */
    .piece {
        position: absolute;
        width: 0;
        height: 0;
    }

    .piece > * {
        position: absolute;
        transform: translate(-50%, -50%);
    }

    /* The page's img max-width would be a share of the zero-size wrapper. */
    .piece img {
        max-width: none;
    }

    .flight {
        z-index: 2;
    }

    .building {
        filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.75));
    }

    .empty {
        display: block;
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
