<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { HydratedArcsPlayerState } from '@tabletop/arcs'
    import { resourceArt, cardArt } from '$lib/utils/art.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { player, playerState }: { player: Player; playerState: HydratedArcsPlayerState } = $props()
    const gameSession = getGameSession()
    const fill = $derived(gameSession.colors.getPlayerBgColorValue(player.id))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(player.id))
    const initiative = $derived(gameSession.gameState.initiative === player.id)
    const captives = $derived(playerState.captiveCount())
</script>

<div class="seat">
    <div class="name" style:background={fill} style:color={ink}>
        <span>{player.name}{initiative ? ' ✦' : ''}</span>
        <span class="power">{playerState.power} Power</span>
    </div>
    <div class="body">
        <div class="slots">
            {#each playerState.resources as resource, slot (slot)}
                <span class="slot" class:closed={!playerState.isSlotOpen(slot)}>
                    {#if resource}<img src={resourceArt(resource)} alt={resource} />{/if}
                </span>
            {/each}
        </div>
        <div class="counts">
            <span>Cards {playerState.handCount}</span>
            <span>Ships {playerState.ships}</span>
            <span>Agents {playerState.agents}</span>
            <span>Cities {playerState.citiesOnBoard}</span>
            <span>Starports {playerState.starports}</span>
            <span>Trophies {playerState.trophies.length}</span>
            <span>Captives {captives}</span>
            {#if playerState.outrage.length > 0}
                <span>Outrage {playerState.outrage.join(', ')}</span>
            {/if}
        </div>
        <div class="cards">
            {#each [playerState.leader, ...playerState.lore, ...playerState.guildCards].filter((cardId) => cardId !== undefined) as cardId (cardId)}
                <img src={cardArt(cardId)} alt={cardId} />
            {/each}
        </div>
    </div>
</div>

<style>
    .seat {
        overflow: hidden;
        border: 1px solid rgb(216 178 94 / 0.3);
        border-radius: 8px;
        background: var(--arcs-panel);
    }

    .name {
        display: flex;
        justify-content: space-between;
        padding: 4px 10px;
        font-weight: 600;
    }

    .body {
        padding: 6px 10px 8px;
    }

    .slots {
        display: flex;
        gap: 4px;
    }

    .slot {
        display: inline-flex;
        width: 26px;
        height: 26px;
        border: 1px solid rgb(255 255 255 / 0.3);
        border-radius: 50%;
    }

    .slot.closed {
        opacity: 0.3;
    }

    .slot img {
        width: 100%;
        height: 100%;
    }

    .counts {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 10px;
        margin-top: 6px;
        color: var(--arcs-muted);
        font-size: 0.8rem;
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
    }

    .cards img {
        width: 52px;
        border-radius: 3px;
    }
</style>
