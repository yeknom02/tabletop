<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardSize } from '$lib/utils/boardLayout.js'
    import {
        AuctionToBoardGap,
        AuctionWidth,
        SpotHeight,
        TableMargin
    } from '$lib/utils/tableLayout.js'
    import AuctionBoard from './AuctionBoard.svelte'
    import GridBoard from './GridBoard.svelte'

    const gameSession = getGameSession()
    const grid = $derived(boardSize(gameSession.bounds))
    const width = $derived(Math.max(AuctionWidth, grid.width) + 2 * TableMargin)
    const height = $derived(SpotHeight + AuctionToBoardGap + grid.height + 2 * TableMargin)
</script>

<svg class="board" viewBox="0 0 {width} {height}" {width} {height} role="img" aria-label="Table">
    <g transform="translate({(width - AuctionWidth) / 2} {TableMargin})">
        <AuctionBoard />
    </g>
    <g
        transform="translate({(width - grid.width) / 2} {TableMargin +
            SpotHeight +
            AuctionToBoardGap})"
    >
        <GridBoard />
    </g>
</svg>

<style>
    .board {
        display: block;
        user-select: none;
    }
</style>
