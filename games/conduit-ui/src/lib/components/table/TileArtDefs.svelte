<script lang="ts">
    import { BaseLetters } from '@tabletop/conduit'
    import {
        CopperCentreColor,
        CopperEdgeColor,
        EmblemStroke,
        Emblems,
        LetterGlowWidths,
        TileArtCentre,
        TileArtSize,
        TileBoardColor,
        TileBoardId,
        TraceHalfWidth,
        TraceOutlineColor,
        TraceOutlineHalfWidth,
        emblemId,
        emblemPath
    } from '$lib/utils/tileArt.js'

    const near = TileArtCentre - TraceHalfWidth
    const far = TileArtCentre + TraceHalfWidth
    const outlineStart = TileArtCentre - TraceOutlineHalfWidth
    // The north and south runs end in mitred points over the east-west run, as the art draws them.
    const north = `M${near} 0L${far} 0L${far} ${near}L${TileArtCentre} ${TileArtCentre}L${near} ${near}Z`
    const south = `M${near} ${TileArtSize}L${far} ${TileArtSize}L${far} ${far}L${TileArtCentre} ${TileArtCentre}L${near} ${far}Z`
</script>

<defs>
    <linearGradient
        id="conduit-copper-across-x"
        x1={near}
        y1="0"
        x2={far}
        y2="0"
        gradientUnits="userSpaceOnUse"
    >
        {@render copper()}
    </linearGradient>
    <linearGradient
        id="conduit-copper-across-y"
        x1="0"
        y1={near}
        x2="0"
        y2={far}
        gradientUnits="userSpaceOnUse"
    >
        {@render copper()}
    </linearGradient>
    <g id={TileBoardId}>
        <rect width={TileArtSize} height={TileArtSize} fill={TileBoardColor}></rect>
        <rect
            x={outlineStart}
            width={2 * TraceOutlineHalfWidth}
            height={TileArtSize}
            fill={TraceOutlineColor}
        ></rect>
        <rect
            y={outlineStart}
            width={TileArtSize}
            height={2 * TraceOutlineHalfWidth}
            fill={TraceOutlineColor}
        ></rect>
        <rect
            y={near}
            width={TileArtSize}
            height={2 * TraceHalfWidth}
            fill="url(#conduit-copper-across-y)"
        ></rect>
        <path d={north} fill="url(#conduit-copper-across-x)"></path>
        <path d={south} fill="url(#conduit-copper-across-x)"></path>
    </g>
    {#each BaseLetters as letter (letter)}
        {@const art = Emblems[letter]}
        <g id={emblemId(letter)}>
            <path
                d={emblemPath(letter)}
                fill={art.fill}
                stroke="#000"
                stroke-width={EmblemStroke}
                stroke-linejoin="round"
            ></path>
            {#each LetterGlowWidths as width (width)}
                <path
                    d={art.letter}
                    fill="none"
                    stroke="#fff"
                    stroke-opacity="0.2"
                    stroke-width={width}
                    stroke-linejoin="round"
                ></path>
            {/each}
            <path d={art.letter} fill="#fff"></path>
        </g>
    {/each}
</defs>

{#snippet copper()}
    <stop offset="0" stop-color={CopperEdgeColor}></stop>
    <stop offset="0.5" stop-color={CopperCentreColor}></stop>
    <stop offset="1" stop-color={CopperEdgeColor}></stop>
{/snippet}
