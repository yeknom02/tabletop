<script lang="ts">
    import { Ambition, LastChapter } from '@tabletop/arcs'
    import { ambitionMarkerArt, PaperTexture } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)

    const AmbitionNames: Record<Ambition, string> = {
        [Ambition.Tycoon]: 'Tycoon',
        [Ambition.Tyrant]: 'Tyrant',
        [Ambition.Warlord]: 'Warlord',
        [Ambition.Keeper]: 'Keeper',
        [Ambition.Empath]: 'Empath'
    }
    const AmbitionMeasures: Record<Ambition, string> = {
        [Ambition.Tycoon]: 'Material and Fuel',
        [Ambition.Tyrant]: 'Captives',
        [Ambition.Warlord]: 'Trophies',
        [Ambition.Keeper]: 'Relics',
        [Ambition.Empath]: 'Psionics'
    }

    const markers = $derived(
        state.ambitionMarkers.map((marker, index) => ({
            index,
            ambition: marker.ambition,
            side: state.markerSide(index),
            flipped: marker.flipped
        }))
    )
    const available = $derived(markers.filter((marker) => marker.ambition === undefined))
    const rows = $derived(
        Object.values(Ambition).map((ambition) => ({
            ambition,
            markers: markers.filter((marker) => marker.ambition === ambition),
            standings: state.turnManager.turnOrder
                .map((playerId) => ({ playerId, count: state.ambitionCount(playerId, ambition) }))
                .filter((entry) => entry.count > 0)
                .sort((a, b) => b.count - a.count)
        }))
    )
</script>

<section class="ambitions" style:background-image="url({PaperTexture})">
    <header>
        <h2>Ambitions</h2>
        <span class="chapter">Chapter {state.chapter} of {LastChapter}</span>
    </header>
    <div class="available">
        {#each available as marker (marker.index)}
            <img
                src={ambitionMarkerArt(marker.side.first, marker.side.second, marker.flipped)}
                alt="{marker.side.first}/{marker.side.second} marker"
            />
        {/each}
    </div>
    {#each rows as row (row.ambition)}
        <div class="row" class:declared={row.markers.length > 0}>
            <div class="title">
                <span class="name">{AmbitionNames[row.ambition]}</span>
                <span class="measure">{AmbitionMeasures[row.ambition]}</span>
            </div>
            <div class="standings">
                {#each row.standings as entry (entry.playerId)}
                    <span
                        class="standing"
                        style:background={gameSession.colors.getPlayerBgColorValue(entry.playerId)}
                        style:color={gameSession.colors.getPlayerTextColorValue(entry.playerId)}
                        >{entry.count}</span
                    >
                {/each}
            </div>
            <div class="placed">
                {#each row.markers as marker (marker.index)}
                    <img
                        src={ambitionMarkerArt(
                            marker.side.first,
                            marker.side.second,
                            marker.flipped
                        )}
                        alt="{marker.side.first}/{marker.side.second} marker"
                    />
                {/each}
            </div>
        </div>
    {/each}
</section>

<style>
    .ambitions {
        padding: 26px 30px;
        border: 6px solid #b8913f;
        border-radius: 18px;
        background-size: cover;
        color: var(--arcs-paper-ink);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.6);
    }

    header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
    }

    h2 {
        font-family: 'Arcs Cinzel', serif;
        font-size: 52px;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .chapter {
        font-size: 30px;
        opacity: 0.75;
    }

    .available {
        display: flex;
        gap: 14px;
        min-height: 100px;
        margin: 10px 0 14px;
    }

    .available img,
    .placed img {
        width: 86px;
        filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.5));
    }

    .row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 16px;
        align-items: center;
        min-height: 104px;
        padding: 8px 4px;
        border-top: 2px solid rgb(42 33 22 / 0.2);
    }

    .row.declared {
        background: rgb(184 145 63 / 0.18);
    }

    .name {
        display: block;
        font-family: 'Arcs Cinzel', serif;
        font-size: 40px;
        font-weight: 700;
    }

    .measure {
        font-size: 24px;
        opacity: 0.7;
    }

    .standings {
        display: flex;
        gap: 6px;
    }

    .standing {
        min-width: 44px;
        padding: 0 8px;
        border: 2px solid rgb(0 0 0 / 0.35);
        border-radius: 8px;
        font-size: 30px;
        font-weight: 600;
        text-align: center;
    }

    .placed {
        display: flex;
        gap: 8px;
    }
</style>
