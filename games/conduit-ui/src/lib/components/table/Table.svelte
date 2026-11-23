<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { CellSize } from '$lib/utils/boardLayout.js'
    import { centredTextShift, tableGeometry } from '$lib/utils/tableLayout.js'
    import { TileBackUrl, tileFaceUrl } from '$lib/utils/tileArt.js'
    import AuctionBoard from './AuctionBoard.svelte'
    import GridBoard from './GridBoard.svelte'

    const gameSession = getGameSession()
    const geometry = $derived(tableGeometry(gameSession.gameState.board))
    const flying = $derived(gameSession.tableAnimator.flyingTile)
    const half = CellSize / 2
</script>

<svg
    class="board"
    viewBox="0 0 {geometry.width} {geometry.height}"
    width={geometry.width}
    height={geometry.height}
    role="img"
    aria-label="Table"
    {@attach gameSession.tableAnimator.attach}
>
    <g transform="translate({geometry.auction.x} {geometry.auction.y})">
        <AuctionBoard />
    </g>
    <g transform="translate({geometry.grid.x} {geometry.grid.y})">
        <GridBoard />
    </g>
    {#if flying}
        <g data-flying-tile transform="translate({flying.from.x} {flying.from.y})">
            <g data-flying-scale>
                <image
                    href={flying.faceUp ? tileFaceUrl(flying.tileId) : TileBackUrl}
                    width={CellSize}
                    height={CellSize}
                    transform="rotate({flying.rotation * 90} {half} {half})"
                ></image>
            </g>
        </g>
    {/if}
    {#each gameSession.tableAnimator.payoutFloats as float (float.key)}
        <g data-payout={float.key} transform="translate({float.at.x} {float.at.y})" opacity="0">
            <rect class="payout" x="-26" y="-15" width="52" height="30" rx="15"></rect>
            <text class="payout-text" text-anchor="middle" dy={centredTextShift(18)}
                >+${float.amount}</text
            >
        </g>
    {/each}
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }

    .payout {
        fill: #f5c542;
        stroke: #1b1505;
        stroke-width: 1.5;
    }

    .payout-text {
        font-size: 18px;
        font-weight: 800;
        fill: #1b1505;
    }
</style>
