<script lang="ts">
    import { Ambition, Court, Resources, type VoxChoice } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { cardId }: { cardId: string } = $props()
    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const me = gameSession.myPlayerId()

    type Option = { label: string; vox: VoxChoice }

    const options: Option[] = $derived.by(() => {
        const none = { label: 'No choice', vox: {} }
        switch (cardId) {
            case Court.MassUprising:
                return state
                    .clustersInPlay()
                    .map((cluster) => ({ label: `Cluster ${cluster}`, vox: { cluster } }))
            case Court.PopulistDemands:
                return [
                    none,
                    ...Object.values(Ambition).map((ambition) => ({
                        label: `Declare ${ambition}`,
                        vox: { ambition }
                    }))
                ]
            case Court.OutrageSpreads:
                return [
                    none,
                    ...Resources.map((outrage) => ({
                        label: `${outrage} Outrage`,
                        vox: { outrage }
                    }))
                ]
            case Court.SongOfFreedom:
                return [
                    none,
                    ...state.systems.flatMap((system) =>
                        state.buildingSlots(system.id).flatMap((building, slot) =>
                            building?.kind === 'city'
                                ? [false, true].map((seize) => ({
                                      label: `Return ${gameSession.getPlayerName(building.owner)}'s city in ${system.id}${seize ? ', seize' : ''}`,
                                      vox: { city: { system: system.id, slot }, seize }
                                  }))
                                : []
                        )
                    )
                ]
            case Court.GuildStruggle:
                return [
                    none,
                    ...state.players
                        .filter((player) => player.playerId !== me)
                        .flatMap((player) =>
                            player.guildCards.map((card) => ({
                                label: `Steal ${card} from ${gameSession.getPlayerName(player.playerId)}`,
                                vox: { steal: { playerId: player.playerId, cardId: card } }
                            }))
                        )
                ]
            default:
                return [{ label: 'Secure', vox: {} }]
        }
    })
    const valid = $derived(
        options.filter((option) => gameSession.canSecureWith(cardId, option.vox))
    )
</script>

<div class="picker">
    {#each valid as option (option.label)}
        <button type="button" class="choice" onclick={() => gameSession.secure(cardId, option.vox)}>
            {option.label}
        </button>
    {/each}
</div>

<style>
    .picker {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-height: 60vh;
        overflow: auto;
        padding: 10px;
        border: 2px solid var(--arcs-gold);
        border-radius: 10px;
        background: #1c2232;
        color: var(--arcs-ink);
        box-shadow: 0 10px 24px rgb(0 0 0 / 0.6);
        text-transform: capitalize;
    }
</style>
