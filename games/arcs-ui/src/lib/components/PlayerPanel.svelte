<script lang="ts">
    import type { Color, Player } from '@tabletop/common'
    import {
        BuildingKind,
        CitiesPerPlayer,
        HoldingsSlot,
        openResourceSlots,
        slotRaidCost,
        TrophyKind,
        wonAmbitionBonus,
        type HydratedArcsGameState,
        type HydratedArcsPlayerState
    } from '@tabletop/arcs'
    import {
        agentArt,
        buildingArt,
        cardArt,
        cardBackArt,
        InitiativeArt,
        keysArt,
        resourceArt,
        resourceIconArt,
        shipArt,
        SpaceTexture
    } from '$lib/utils/art.js'
    import { cardName } from '$lib/utils/cards.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { player, playerState }: { player: Player; playerState: HydratedArcsPlayerState } = $props()
    const gameSession = getGameSession()
    const fill = $derived(gameSession.colors.getPlayerBgColorValue(player.id))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(player.id))
    const initiative = $derived(gameSession.shownState.initiative === player.id)
    const id = $derived(player.id)
    const mine = (state: HydratedArcsGameState) => state.getPlayerState(id)
    const pop = (part: string, signature: (state: HydratedArcsGameState) => unknown) =>
        gameSession.highlights.attach(`player:${id}:${part}`, (state) => {
            const shown = signature(state)
            return shown === undefined ? undefined : JSON.stringify(shown)
        })

    // The board as printed: six resource slots, then the two ambition bonuses. Each city sits on
    // the slots or bonus it covers, and cities leave from the left.
    const SlotColumns = 6
    const covers = Array.from({ length: CitiesPerPlayer }, (_, city) => {
        const onBoard = CitiesPerPlayer - city
        const first = openResourceSlots(onBoard)
        const last = openResourceSlots(onBoard - 1)
        return last > first
            ? { column: first + 1, span: last - first, bonus: 0 }
            : { column: 0, span: 1, bonus: wonAmbitionBonus(onBoard - 1) }
    })
    const bonuses = covers.filter((cover) => cover.bonus > 0)
    const cityCells = covers.map((cover) =>
        cover.bonus > 0 ? { ...cover, column: SlotColumns + bonuses.indexOf(cover) + 1 } : cover
    )

    const built = $derived(CitiesPerPlayer - playerState.citiesOnBoard)
    const holdings = $derived(playerState.resources.length > HoldingsSlot)
    const columns = $derived(SlotColumns + bonuses.length + (holdings ? 1 : 0))
    const slotColumn = (slot: number) =>
        slot === HoldingsSlot ? SlotColumns + bonuses.length + 1 : slot + 1

    const colorOf = (owner: string): Color | undefined =>
        gameSession.shownState.players.find((candidate) => candidate.playerId === owner)?.color
    const nameOf = (owner: string) =>
        gameSession.game.players.find((candidate) => candidate.id === owner)?.name ?? owner

    // Trophies and captives, one stack per owner and kind.
    const spoils = $derived.by(() => {
        const stacks: { owner: string; kind: TrophyKind; count: number; captive: boolean }[] = []
        for (const trophy of playerState.trophies) {
            const stack = stacks.find(
                (candidate) => candidate.owner === trophy.owner && candidate.kind === trophy.kind
            )
            if (stack) stack.count += 1
            else stacks.push({ ...trophy, count: 1, captive: false })
        }
        for (const [owner, count] of Object.entries(playerState.captives)) {
            if (count > 0) stacks.push({ owner, kind: TrophyKind.Agent, count, captive: true })
        }
        return stacks
    })

    function pieceArt(color: Color, kind: TrophyKind): string {
        if (kind === TrophyKind.Ship) return shipArt(color)
        if (kind === TrophyKind.Agent) return agentArt(color)
        return buildingArt(
            color,
            kind === TrophyKind.City ? BuildingKind.City : BuildingKind.Starport,
            false
        )
    }

    type Spoils = { owner: string; kind: TrophyKind; captive: boolean }
    function spoilCount(seat: HydratedArcsPlayerState, stack: Spoils): number | undefined {
        const count = stack.captive
            ? (seat.captives[stack.owner] ?? 0)
            : seat.trophies.filter(
                  (trophy) => trophy.owner === stack.owner && trophy.kind === stack.kind
              ).length
        return count > 0 ? count : undefined
    }

    const holds = (seat: HydratedArcsPlayerState, cardId: string) =>
        seat.leader === cardId || seat.lore.includes(cardId) || seat.guildCards.includes(cardId)

    const cards = $derived(
        [playerState.leader, ...playerState.lore, ...playerState.guildCards].filter(
            (cardId) => cardId !== undefined
        )
    )
</script>

<div class="seat" style:--seat={fill}>
    <div class="name" style:background={fill} style:color={ink}>
        <span class="who">
            {#if initiative}
                <img
                    class="initiative"
                    src={InitiativeArt}
                    alt=""
                    title="Initiative"
                    {@attach pop('initiative', (state) =>
                        state.initiative === id ? true : undefined
                    )}
                />
            {/if}
            {player.name}
        </span>
        <span class="power" title="Power" {@attach pop('power', (state) => mine(state).power)}
            >{playerState.power}</span
        >
    </div>

    <div
        class="board"
        style:background-image="linear-gradient(rgb(13 17 27 / 0.8), rgb(13 17 27 / 0.8)), url({SpaceTexture})"
        style:grid-template-columns="repeat({columns}, minmax(0, 1fr))"
    >
        {#each playerState.resources as resource, slot (slot)}
            {@const raid = slotRaidCost(slot)}
            <span
                class="slot"
                class:closed={!playerState.isSlotOpen(slot)}
                style:grid-column={slotColumn(slot)}
                title={resource ?? 'Empty slot'}
                {@attach pop(`slot:${slot}`, (state) => mine(state).resources[slot] ?? null)}
            >
                {#if resource}<img src={resourceArt(resource)} alt={resource} />{/if}
            </span>
            {#if raid !== undefined}
                <img
                    class="keys"
                    style:grid-column={slotColumn(slot)}
                    src={keysArt(raid)}
                    alt="{raid} to raid"
                    title="Raid cost {raid}"
                />
            {/if}
        {/each}
        {#each bonuses as bonus, index (index)}
            <span
                class="bonus"
                style:grid-column={SlotColumns + index + 1}
                title="Power for winning an ambition outright"
            >
                +{bonus.bonus}
            </span>
            <span class="caption" style:grid-column={SlotColumns + index + 1}>1st</span>
        {/each}
        {#each cityCells as cell, city (city)}
            {#if city >= built}
                <img
                    class="city"
                    style:grid-column="{cell.column} / span {cell.span}"
                    src={buildingArt(playerState.color, BuildingKind.City, false)}
                    alt="City"
                />
            {/if}
        {/each}
    </div>

    <div class="supply">
        <span
            class="count"
            title="Cards in hand"
            {@attach pop('hand', (state) => mine(state).handCount)}
        >
            <img class="card-back" src={cardBackArt('action')} alt="" />{playerState.handCount}
        </span>
        <span
            class="count"
            title="Ships in supply"
            {@attach pop('ships', (state) => mine(state).ships)}
        >
            <img src={shipArt(playerState.color)} alt="" />{playerState.ships}
        </span>
        <span
            class="count"
            title="Agents in supply"
            {@attach pop('agents', (state) => mine(state).agents)}
        >
            <img src={agentArt(playerState.color)} alt="" />{playerState.agents}
        </span>
        <span
            class="count"
            title="Starports in supply"
            {@attach pop('starports', (state) => mine(state).starports)}
        >
            <img
                src={buildingArt(playerState.color, BuildingKind.Starport, false)}
                alt=""
            />{playerState.starports}
        </span>
        {#if playerState.outrage.length > 0}
            <span
                class="outrage"
                title="Outraged: {playerState.outrage.join(', ')}"
                {@attach pop('outrage', (state) =>
                    mine(state).outrage.length > 0 ? mine(state).outrage : undefined
                )}
            >
                {#each playerState.outrage as resource (resource)}
                    <img src={resourceIconArt(resource)} alt="{resource} Outrage" />
                {/each}
            </span>
        {/if}
    </div>

    {#if spoils.length > 0}
        <div class="spoils">
            {#each spoils as stack (`${stack.captive}-${stack.owner}-${stack.kind}`)}
                {@const color = colorOf(stack.owner)}
                <span
                    class="count"
                    {@attach pop(`spoils:${stack.captive}:${stack.owner}:${stack.kind}`, (state) =>
                        spoilCount(mine(state), stack)
                    )}
                    title="{stack.count} {nameOf(stack.owner)} {stack.kind}{stack.count === 1
                        ? ''
                        : 's'} as {stack.captive ? 'Captives' : 'Trophies'}"
                >
                    <span class="spoil-kind">{stack.captive ? 'Captive' : 'Trophy'}</span>
                    {#if color}<img src={pieceArt(color, stack.kind)} alt="" />{/if}{stack.count}
                </span>
            {/each}
        </div>
    {/if}

    {#if cards.length > 0}
        <div class="cards">
            {#each cards as cardId (cardId)}
                <img
                    src={cardArt(cardId)}
                    alt={cardName(cardId)}
                    title={cardName(cardId)}
                    {@attach pop(`card:${cardId}`, (state) =>
                        holds(mine(state), cardId) ? true : undefined
                    )}
                />
            {/each}
        </div>
    {/if}
</div>

<style>
    .seat {
        overflow: hidden;
        border: 1px solid rgb(216 178 94 / 0.35);
        border-radius: 8px;
        background: var(--arcs-panel);
    }

    .name {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 6px 3px 10px;
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
    }

    .who {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .initiative {
        width: 22px;
        height: 22px;
    }

    .power {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0 6px;
        border: 2px solid var(--arcs-gold);
        border-radius: 14px;
        background: var(--arcs-space);
        color: var(--arcs-gold);
        font-size: 0.95rem;
    }

    .board {
        display: grid;
        grid-template-rows: auto auto;
        gap: 3px 4px;
        align-items: center;
        justify-items: center;
        padding: 8px 8px 6px;
        border-bottom: 1px solid rgb(216 178 94 / 0.25);
        background-size: cover;
        box-shadow: inset 3px 0 0 var(--seat);
    }

    .slot,
    .bonus,
    .city {
        grid-row: 1;
    }

    .keys,
    .caption {
        grid-row: 2;
    }

    .slot {
        width: 100%;
        max-width: 30px;
        aspect-ratio: 1;
        border: 1.5px dashed rgb(233 226 208 / 0.45);
        border-radius: 50%;
    }

    .slot.closed {
        border-color: transparent;
    }

    .slot img {
        width: 100%;
        height: 100%;
    }

    .keys {
        width: 18px;
        height: 18px;
    }

    .slot.closed + .keys {
        opacity: 0.5;
    }

    .bonus {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 30px;
        aspect-ratio: 1;
        border: 1.5px solid rgb(216 178 94 / 0.6);
        border-radius: 4px;
        color: var(--arcs-gold);
        font-family: 'Arcs Cinzel', serif;
        font-weight: 700;
        font-size: 0.85rem;
    }

    .caption {
        color: var(--arcs-muted);
        font-size: 0.65rem;
        line-height: 18px;
    }

    .city {
        z-index: 1;
        width: 34px;
        height: 34px;
        object-fit: contain;
        filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.7));
    }

    .supply,
    .spoils {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        padding: 6px 10px 0;
        font-size: 0.85rem;
    }

    .spoils {
        gap: 4px 10px;
        color: var(--arcs-muted);
    }

    .count {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: var(--arcs-ink);
    }

    .count img {
        width: 20px;
        height: 20px;
        object-fit: contain;
    }

    .count img.card-back {
        width: 14px;
        height: 20px;
        object-fit: cover;
        border-radius: 2px;
    }

    .spoil-kind {
        color: var(--arcs-muted);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .outrage {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 1px 4px;
        border: 1px solid #c0392b;
        border-radius: 4px;
    }

    .outrage img {
        width: 18px;
        height: 18px;
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 6px 10px 0;
    }

    .cards img {
        width: 52px;
        border-radius: 3px;
    }

    .seat > :last-child {
        padding-bottom: 8px;
    }

    .board:last-child {
        padding-bottom: 6px;
    }
</style>
