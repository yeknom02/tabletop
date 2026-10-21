<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { BuildingKind, type SystemId } from '@tabletop/arcs'
    import type { Point } from '@tabletop/common'
    import { systemLayout, BuildingSize } from '$lib/utils/mapLayout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { SlotTarget } from '$lib/model/session.svelte.js'
    import MovePicker from './MovePicker.svelte'
    import BattlePicker from './BattlePicker.svelte'

    const gameSession = getGameSession()

    type SystemRing = { system: SystemId; at: Point; onclick: () => void; selected?: boolean }
    type SlotRing = { target: SlotTarget; at: Point; onclick: () => void }

    const layouts = $derived(
        new Map(gameSession.gameState.systems.map((system) => [system.id, systemLayout(system)]))
    )
    const anchorOf = (system: SystemId): Point => {
        const layout = layouts.get(system)
        if (!layout) throw new Error(`No layout for ${system}`)
        return layout.anchor
    }
    const slotAt = (target: SlotTarget): Point => {
        const placed = layouts.get(target.system)?.buildings[target.slot]
        if (!placed) throw new Error(`No slot ${target.slot} in ${target.system}`)
        return placed.at
    }

    const slotRings: SlotRing[] = $derived([
        ...gameSession.taxTargets.map((target) => ({
            target,
            at: slotAt(target),
            onclick: () =>
                target.discards.length === 1 && target.discards[0].length === 0
                    ? gameSession.tax(target, [])
                    : gameSession.chooseTarget({ system: target.system, slot: target.slot })
        })),
        ...gameSession.shipBuildTargets.map((target) => ({
            target,
            at: slotAt(target),
            onclick: () => gameSession.buildShip(target)
        })),
        ...gameSession.repairBuildingTargets.map((target) => ({
            target,
            at: slotAt(target),
            onclick: () => gameSession.repair(target.system, target.slot)
        }))
    ])

    const systemRings: SystemRing[] = $derived([
        ...gameSession.buildingTargets.map(({ system }) => ({
            system,
            at: anchorOf(system),
            onclick: () => gameSession.chooseTarget({ system })
        })),
        ...gameSession.repairShipTargets.map((system) => ({
            system,
            at: anchorOf(system),
            onclick: () => gameSession.repair(system)
        })),
        ...gameSession.moveOrigins.map((system) => ({
            system,
            at: anchorOf(system),
            onclick: () => gameSession.chooseMoveOrigin(system)
        })),
        ...gameSession.moveSteps.map((system) => ({
            system,
            at: anchorOf(system),
            onclick: () => gameSession.chooseMoveStep(system)
        })),
        ...gameSession.battleTargets.map((system) => ({
            system,
            at: anchorOf(system),
            onclick: () => gameSession.chooseTarget({ system })
        })),
        ...gameSession.returnFleetTargets.map((system) => ({
            system,
            at: anchorOf(system),
            onclick: () => gameSession.endTurn(system)
        }))
    ])

    const marked: { system: SystemId; at: Point }[] = $derived(
        [gameSession.origin, ...gameSession.path]
            .filter((system): system is SystemId => system !== undefined)
            .map((system) => ({ system, at: anchorOf(system) }))
    )

    const target = $derived(gameSession.target)
    const taxTarget = $derived(
        target?.slot === undefined
            ? undefined
            : gameSession.taxTargets.find(
                  (candidate) =>
                      candidate.system === target.system && candidate.slot === target.slot
              )
    )
    const buildChoice = $derived(
        target && target.slot === undefined
            ? gameSession.buildingTargets.find((candidate) => candidate.system === target.system)
            : undefined
    )
    const battleSystem = $derived(
        target && target.slot === undefined && gameSession.battleTargets.includes(target.system)
            ? target.system
            : undefined
    )
    const moveEnd = $derived(gameSession.path.at(-1))
    const discardLabel = (discard: string[]) => `Discard ${discard.join(' and ')}`
</script>

{#each marked as mark (mark.system)}
    <div class="mark" style:left="{mark.at.x}px" style:top="{mark.at.y}px"></div>
{/each}
{#each systemRings as ring (ring.system)}
    <button
        type="button"
        id="arcs-system-{ring.system}"
        class="ring system"
        style:left="{ring.at.x}px"
        style:top="{ring.at.y}px"
        aria-label="System {ring.system}"
        onclick={ring.onclick}
    ></button>
{/each}
{#each slotRings as ring (`${ring.target.system}-${ring.target.slot}`)}
    <button
        type="button"
        id="arcs-slot-{ring.target.system}-{ring.target.slot}"
        class="ring slot"
        style:left="{ring.at.x}px"
        style:top="{ring.at.y}px"
        style:width="{BuildingSize + 28}px"
        style:height="{BuildingSize + 28}px"
        aria-label="Slot {ring.target.slot} of {ring.target.system}"
        onclick={ring.onclick}
    ></button>
{/each}
{#if moveEnd}
    <span
        id="arcs-move-end"
        class="anchor"
        style:left="{anchorOf(moveEnd).x}px"
        style:top="{anchorOf(moveEnd).y}px"
    ></span>
    <Floater
        reference="#arcs-move-end"
        placement="right"
        offset={60}
        onClose={() => gameSession.undo()}
    >
        <MovePicker />
    </Floater>
{/if}
{#if taxTarget}
    <Floater
        reference="#arcs-slot-{taxTarget.system}-{taxTarget.slot}"
        placement="right"
        offset={20}
        onClose={() => gameSession.undo()}
    >
        <div class="picker">
            <p>Your slots are full.</p>
            {#each taxTarget.discards as discard (discard.join())}
                <button
                    type="button"
                    class="choice"
                    onclick={() => gameSession.tax(taxTarget, discard)}
                    >{discardLabel(discard)}</button
                >
            {/each}
        </div>
    </Floater>
{/if}
{#if buildChoice}
    <Floater
        reference="#arcs-system-{buildChoice.system}"
        placement="right"
        offset={20}
        onClose={() => gameSession.undo()}
    >
        <div class="picker">
            {#each buildChoice.kinds as kind (kind)}
                <button
                    type="button"
                    class="choice"
                    onclick={() => gameSession.buildBuilding(buildChoice.system, kind)}
                >
                    Build a {kind === BuildingKind.City ? 'city' : 'starport'}
                </button>
            {/each}
        </div>
    </Floater>
{/if}
{#if battleSystem}
    <Floater
        reference="#arcs-system-{battleSystem}"
        placement="right"
        offset={20}
        onClose={() => gameSession.undo()}
    >
        <BattlePicker system={battleSystem} />
    </Floater>
{/if}

<style>
    .ring {
        position: absolute;
        transform: translate(-50%, -50%);
        border: 8px solid rgb(255 214 120 / 0.95);
        border-radius: 50%;
        background: rgb(255 214 120 / 0.12);
        box-shadow:
            0 0 24px rgb(255 214 120 / 0.8),
            inset 0 0 18px rgb(255 214 120 / 0.5);
        cursor: pointer;
        animation: pulse 1.6s ease-in-out infinite;
    }

    .ring.system {
        width: 210px;
        height: 210px;
    }

    .ring:hover {
        background: rgb(255 214 120 / 0.3);
    }

    .mark {
        position: absolute;
        width: 230px;
        height: 230px;
        transform: translate(-50%, -50%);
        border: 6px dashed rgb(255 255 255 / 0.85);
        border-radius: 50%;
        pointer-events: none;
    }

    .anchor {
        position: absolute;
        width: 1px;
        height: 1px;
    }

    .picker {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        border: 2px solid var(--arcs-gold);
        border-radius: 10px;
        background: #1c2232;
        color: var(--arcs-ink);
        box-shadow: 0 10px 24px rgb(0 0 0 / 0.6);
        text-transform: capitalize;
    }

    @keyframes pulse {
        50% {
            box-shadow:
                0 0 40px rgb(255 214 120 / 1),
                inset 0 0 24px rgb(255 214 120 / 0.6);
        }
    }
</style>
