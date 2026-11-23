<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        AuctionSpots,
        SpotGap,
        SpotWidth,
        SpotHeight,
        TrackCell,
        TileInSpot,
        trackCellOrigin,
        centredTextShift
    } from '$lib/utils/tableLayout.js'
    import { tileFaceUrl } from '$lib/utils/tileArt.js'
    import { BidTrackSpaces } from '@tabletop/conduit'

    const gameSession = getGameSession()
    const market = $derived(gameSession.gameState.market)
    const offerSlot = $derived(gameSession.offer?.slot)
    const placingSlot = $derived(gameSession.pendingPlacement?.slot)
    const myColor = $derived(
        gameSession.myPlayer
            ? gameSession.colors.getPlayerBgColorValue(gameSession.myPlayer.id)
            : undefined
    )
    const tracks = Array.from({ length: BidTrackSpaces }, (_, index) => index)

    function activate(event: KeyboardEvent, slot: number) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        void gameSession.bid(slot)
    }
</script>

{#each Array.from({ length: AuctionSpots }, (_, index) => index) as slot (slot)}
    {@const spot = market[slot]}
    {@const biddable = gameSession.biddableSlots.includes(slot)}
    {@const inPlay = slot < market.length}
    <g
        class="spot"
        class:biddable
        class:unused={!inPlay}
        transform="translate({slot * (SpotWidth + SpotGap)} 0)"
    >
        <rect
            class="frame"
            class:offer={offerSlot === slot}
            class:placing={placingSlot === slot}
            x="0"
            y="0"
            width={SpotWidth}
            height={SpotHeight}
            rx="8"
        ></rect>
        <g transform="translate(8 8)">
            {#each tracks as index (index)}
                {@const origin = trackCellOrigin(index)}
                {@const bidder = spot?.bids[index]}
                <rect class="track" x={origin.x} y={origin.y} width={TrackCell} height={TrackCell}
                ></rect>
                {#if bidder}
                    <rect
                        class="cube"
                        class:bottom={index === 0 && offerSlot === slot}
                        x={origin.x + 6}
                        y={origin.y + 6}
                        width={TrackCell - 12}
                        height={TrackCell - 12}
                        rx="2"
                        fill={gameSession.colors.getPlayerBgColorValue(bidder)}
                    ></rect>
                {:else if biddable && index === spot?.bids.length && myColor}
                    <rect
                        class="ghost"
                        x={origin.x + 6}
                        y={origin.y + 6}
                        width={TrackCell - 12}
                        height={TrackCell - 12}
                        rx="2"
                        fill={myColor}
                    ></rect>
                {/if}
            {/each}
            {#if spot?.tileId !== undefined}
                <image
                    href={tileFaceUrl(spot.tileId)}
                    x={TrackCell + 6}
                    y={TrackCell + 10}
                    width={TileInSpot}
                    height={TileInSpot}
                ></image>
            {/if}
            {#if offerSlot === slot && gameSession.offer}
                <text
                    class="price"
                    x={TrackCell + 6 + TileInSpot / 2}
                    y={TrackCell + 10 + TileInSpot + 24}
                    dy={centredTextShift(20)}
                    text-anchor="middle">${gameSession.offer.price}</text
                >
            {/if}
        </g>
        <text
            class="number"
            x={SpotWidth - 10}
            y={SpotHeight - 12}
            dy={centredTextShift(14)}
            text-anchor="end">{slot + 1}</text
        >
        {#if biddable}
            <rect
                class="hit"
                width={SpotWidth}
                height={SpotHeight}
                rx="8"
                role="button"
                tabindex="0"
                aria-label="Bid on spot {slot + 1}"
                onclick={() => gameSession.bid(slot)}
                onkeydown={(event) => activate(event, slot)}
            ></rect>
        {/if}
    </g>
{/each}

<style>
    .frame {
        fill: #18212d;
        stroke: #33445a;
        stroke-width: 1.5;
    }

    .frame.offer {
        stroke: #f5c542;
        stroke-width: 3;
    }

    .frame.placing {
        stroke: #57d3ff;
        stroke-width: 3;
    }

    .unused {
        opacity: 0.35;
    }

    .track {
        fill: #222e3d;
        stroke: #4a5d75;
        stroke-width: 1;
    }

    .cube {
        stroke: rgb(0 0 0 / 0.6);
        stroke-width: 1.5;
    }

    .cube.bottom {
        stroke: #f5c542;
        stroke-width: 3;
    }

    .ghost {
        opacity: 0;
    }

    .biddable {
        cursor: pointer;
    }

    .biddable .frame {
        stroke: #57d3ff;
        stroke-width: 2.5;
    }

    .hit {
        fill: transparent;
        outline: none;
    }

    .biddable:hover .ghost,
    .biddable:has(.hit:focus-visible) .ghost {
        opacity: 0.55;
    }

    .biddable:hover .frame {
        fill: #222e3d;
    }

    .biddable:has(.hit:focus-visible) .frame {
        stroke: #f5c542;
    }

    .price {
        font-size: 20px;
        font-weight: 800;
        fill: #f5c542;
    }

    .number {
        font-size: 14px;
        font-weight: 700;
        fill: #93a4b8;
    }
</style>
