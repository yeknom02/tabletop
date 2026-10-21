<script lang="ts">
    import { MapArt } from '$lib/utils/art.js'
    import { MapSize, systemLayout } from '$lib/utils/mapLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SystemPieces from '$lib/components/map/SystemPieces.svelte'

    const gameSession = getGameSession()
    const layouts = $derived(
        gameSession.gameState.systems
            .filter((system) => gameSession.gameState.inPlay(system.id))
            .map((system) => systemLayout(system))
    )
    const outOfPlay = $derived(
        gameSession.gameState.systems.filter((system) => !gameSession.gameState.inPlay(system.id))
    )
</script>

<div class="board" style:width="{MapSize.width}px" style:height="{MapSize.height}px">
    <img class="map" src={MapArt} alt="The Reach" draggable="false" />
    {#each outOfPlay as system (system.id)}
        <div
            class="out-of-play"
            style:left="{systemLayout(system).anchor.x}px"
            style:top="{systemLayout(system).anchor.y}px"
        >
            Out of play
        </div>
    {/each}
    {#each layouts as layout (layout.id)}
        <SystemPieces {layout} />
    {/each}
</div>

<style>
    .board {
        position: relative;
        user-select: none;
    }

    .map {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    .out-of-play {
        position: absolute;
        transform: translate(-50%, -50%);
        padding: 4px 12px;
        border-radius: 6px;
        background: rgb(0 0 0 / 0.6);
        color: #aaa;
        font-size: 28px;
        white-space: nowrap;
    }
</style>
