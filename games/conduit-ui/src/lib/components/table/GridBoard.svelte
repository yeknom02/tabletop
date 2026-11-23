<script lang="ts">
    import { sameCoordinates, type OffsetCoordinates } from '@tabletop/common'
    import { CentralCell, neighborCell, Side, type PlacedStation } from '@tabletop/conduit'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        boardSize,
        CellSize,
        cellElementId,
        cellKey,
        cellOrigin
    } from '$lib/utils/boardLayout.js'
    import { centredTextShift } from '$lib/utils/tableLayout.js'
    import { TileBackUrl, tileFaceUrl } from '$lib/utils/tileArt.js'
    import CentralStation from './CentralStation.svelte'

    const gameSession = getGameSession()
    const bounds = $derived(gameSession.bounds)
    const size = $derived(boardSize(bounds))
    const stations = $derived(gameSession.gameState.board.stations)
    const centre = $derived(cellOrigin(CentralCell, bounds))
    const half = CellSize / 2

    function routePoints(cells: OffsetCoordinates[]): string {
        return cells
            .map((cell) => {
                const origin = cellOrigin(cell, bounds)
                return `${origin.x + half},${origin.y + half}`
            })
            .join(' ')
    }

    // The Central Station draws its own blocked ends.
    const sticks = $derived(
        gameSession.closedConnections.filter(
            (closed) =>
                !sameCoordinates(closed.cell, CentralCell) &&
                !sameCoordinates(neighborCell(closed.cell, closed.side), CentralCell)
        )
    )

    function stickOf(cell: OffsetCoordinates, side: Side) {
        const origin = cellOrigin(cell, bounds)
        return side === Side.East
            ? { x: origin.x + CellSize - 5, y: origin.y + half - 22, width: 10, height: 44 }
            : { x: origin.x + half - 22, y: origin.y + CellSize - 5, width: 44, height: 10 }
    }

    function isChosen(cell: OffsetCoordinates): boolean {
        return gameSession.chosenCell !== undefined && sameCoordinates(cell, gameSession.chosenCell)
    }

    function activate(event: KeyboardEvent, act: () => void) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        act()
    }

    function inspect(station: PlacedStation) {
        gameSession.inspectStation(station.cell)
    }
</script>

<rect class="ground" x="0" y="0" width={size.width} height={size.height} rx="12"></rect>

<CentralStation x={centre.x} y={centre.y} />

{#each stations as station (cellKey(station.cell))}
    {@const origin = cellOrigin(station.cell, bounds)}
    {@const owned = station.ownerId !== undefined}
    {@const badge = gameSession.stationBadges.get(cellKey(station.cell))}
    <g class="station" class:owned transform="translate({origin.x} {origin.y})">
        {#if station.faceUp}
            <image
                href={tileFaceUrl(station.tileId)}
                width={CellSize}
                height={CellSize}
                transform="rotate({station.rotation * 90} {half} {half})"
            ></image>
        {:else}
            <image href={TileBackUrl} width={CellSize} height={CellSize}></image>
        {/if}
        <rect class="edge" x="0.5" y="0.5" width={CellSize - 1} height={CellSize - 1}></rect>
        {#if station.ownerId}
            <rect
                class="cube"
                x="4"
                y="4"
                width="26"
                height="26"
                rx="3"
                fill={gameSession.colors.getPlayerBgColorValue(station.ownerId)}
            ></rect>
            <text
                class="count"
                x="17"
                y="17"
                dy={centredTextShift(16)}
                text-anchor="middle"
                fill={gameSession.colors.getPlayerTextColorValue(station.ownerId)}
                >{station.cubes}</text
            >
        {/if}
        {#if badge !== undefined}
            <rect class="badge" x={CellSize - 38} y={CellSize - 26} width="34" height="22" rx="11"
            ></rect>
            <text
                class="badge-text"
                x={CellSize - 21}
                y={CellSize - 15}
                dy={centredTextShift(14)}
                text-anchor="middle">${badge}</text
            >
        {/if}
        {#if owned}
            <rect
                class="hit"
                width={CellSize}
                height={CellSize}
                role="button"
                tabindex="0"
                aria-label="Show this station’s route"
                onclick={() => inspect(station)}
                onkeydown={(event) => activate(event, () => inspect(station))}
            ></rect>
        {/if}
    </g>
{/each}

{#each gameSession.shownRoutes as route (route.key)}
    <polyline class="route" points={routePoints(route.cells)} style:stroke={route.color}></polyline>
{/each}

{#each sticks as closed (`${cellKey(closed.cell)}-${closed.side}`)}
    {@const stick = stickOf(closed.cell, closed.side)}
    <rect class="stick" x={stick.x} y={stick.y} width={stick.width} height={stick.height} rx="3"
    ></rect>
{/each}

{#each gameSession.placementOptions as option (cellKey(option.cell))}
    {@const origin = cellOrigin(option.cell, bounds)}
    {@const chosen = isChosen(option.cell)}
    <g
        id={cellElementId(option.cell)}
        class="target"
        class:chosen
        transform="translate({origin.x} {origin.y})"
        role="button"
        tabindex="0"
        aria-label="Place the tile here"
        onclick={() => gameSession.chooseCell(option.cell)}
        onkeydown={(event) => activate(event, () => gameSession.chooseCell(option.cell))}
    >
        {#if chosen && gameSession.placement}
            <image
                class="preview"
                href={tileFaceUrl(gameSession.placement.tileId)}
                width={CellSize}
                height={CellSize}
                transform="rotate({(gameSession.chosenRotation ?? option.rotations[0]) *
                    90} {half} {half})"
            ></image>
        {/if}
        <rect class="outline" x="4" y="4" width={CellSize - 8} height={CellSize - 8} rx="8"></rect>
    </g>
{/each}

<style>
    .ground {
        fill: #141c26;
        stroke: #263243;
        stroke-width: 1;
    }

    .edge {
        fill: none;
        stroke: rgb(0 0 0 / 0.35);
        stroke-width: 1;
    }

    .station.owned {
        cursor: pointer;
    }

    .hit {
        fill: transparent;
        outline: none;
    }

    .station:has(.hit:focus-visible) .edge {
        stroke: #57d3ff;
        stroke-width: 3;
    }

    .cube {
        stroke: rgb(0 0 0 / 0.6);
        stroke-width: 1.5;
    }

    .count {
        font-size: 16px;
        font-weight: 800;
    }

    .badge {
        fill: #10161f;
        stroke: #f5c542;
        stroke-width: 1.5;
    }

    .badge-text {
        font-size: 14px;
        font-weight: 800;
        fill: #f5c542;
    }

    .route {
        fill: none;
        stroke: #57d3ff;
        stroke-width: 8;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-opacity: 0.85;
        pointer-events: none;
    }

    .stick {
        fill: #e3342f;
        stroke: #5c0f0c;
        stroke-width: 1.5;
        pointer-events: none;
    }

    .target {
        cursor: pointer;
    }

    .outline {
        fill: rgb(87 211 255 / 0.12);
        stroke: #57d3ff;
        stroke-width: 2.5;
        stroke-dasharray: 8 6;
    }

    .target:hover .outline,
    .target:focus-visible .outline {
        fill: rgb(87 211 255 / 0.28);
    }

    .target:focus-visible {
        outline: none;
    }

    .target.chosen .outline {
        fill: none;
        stroke: #f5c542;
        stroke-dasharray: none;
        stroke-width: 3;
    }

    .preview {
        opacity: 0.85;
    }
</style>
