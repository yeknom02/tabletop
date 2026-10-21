<script lang="ts">
    import { MapArt, outOfPlayArt } from '$lib/utils/art.js'
    import { MapSize, SideColumnWidth, systemLayout } from '$lib/utils/mapLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SystemPieces from '$lib/components/map/SystemPieces.svelte'
    import Ambitions from '$lib/components/board/Ambitions.svelte'
    import Court from '$lib/components/board/Court.svelte'
    import Targets from '$lib/components/map/Targets.svelte'

    const gameSession = getGameSession()
    const layouts = $derived(
        gameSession.gameState.systems
            .filter((system) => gameSession.gameState.inPlay(system.id))
            .map((system) => systemLayout(system))
    )
</script>

<div
    class="board"
    style:width="{MapSize.width + SideColumnWidth}px"
    style:height="{MapSize.height}px"
>
    <div class="map" style:width="{MapSize.width}px" style:height="{MapSize.height}px">
        <img class="layer" src={MapArt} alt="The Reach" draggable="false" />
        {#each gameSession.gameState.outOfPlay as cluster (cluster)}
            <img
                class="layer"
                src={outOfPlayArt(cluster)}
                alt="Cluster {cluster} is out of play"
                draggable="false"
            />
        {/each}
        {#each layouts as layout (layout.id)}
            <SystemPieces {layout} />
        {/each}
        <Targets />
    </div>
    <div class="side" style:width="{SideColumnWidth}px">
        <Ambitions />
        <Court />
    </div>
</div>

<style>
    .board {
        position: relative;
        display: flex;
        user-select: none;
        font-family: 'Arcs Jost', sans-serif;
    }

    .map {
        position: relative;
        flex: none;
    }

    .layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .side {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding: 28px 28px 28px 36px;
    }
</style>
