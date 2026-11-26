<script lang="ts">
    import {
        TileFrameSize,
        TileSheetHeight,
        TileSheetUrl,
        TileSheetWidth,
        tileFrame
    } from '$lib/utils/tileArt.js'

    // A tile's face, or its back when no tile is given, drawn from the shared sheet.
    let {
        tileId,
        x = 0,
        y = 0,
        size
    }: { tileId?: number; x?: number; y?: number; size: number } = $props()

    // The image is the whole sheet, so without a clip WebKit sizes the tile's repaint area, and
    // every fade of it, to the sheet.
    const uid = $props.id()
    const clipId = `conduit-tile-${uid}`
    const frame = $derived(tileFrame(tileId))
</script>

<svg
    {x}
    {y}
    width={size}
    height={size}
    viewBox="{frame.x} {frame.y} {TileFrameSize} {TileFrameSize}"
    preserveAspectRatio="none"
>
    <clipPath id={clipId}>
        <rect x={frame.x} y={frame.y} width={TileFrameSize} height={TileFrameSize}></rect>
    </clipPath>
    <image
        href={TileSheetUrl}
        width={TileSheetWidth}
        height={TileSheetHeight}
        clip-path="url(#{clipId})"
    ></image>
</svg>
