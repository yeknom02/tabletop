<script lang="ts">
    import { untrack } from 'svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { BattleStep, Die, shipsOf, anyRerolls } from '@tabletop/arcs'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { resourceIconArt, cardArt } from '$lib/utils/art.js'
    import DiceRoll from '$lib/components/DiceRoll.svelte'
    import HitsPanel from './HitsPanel.svelte'
    import Stepper from '$lib/components/Stepper.svelte'

    const gameSession = getGameSession()
    const battle = $derived(gameSession.battleState)
    const step = $derived(gameSession.battleStep)
    const game = $derived(gameSession.gameState)

    const attackerShips = $derived(
        battle ? shipsOf(game.system(battle.system), battle.attacker) : { fresh: 0, damaged: 0 }
    )

    let rerolling: number[] = $state([])
    const toggleReroll = (index: number) => {
        rerolling = rerolling.includes(index)
            ? rerolling.filter((other) => other !== index)
            : [...rerolling, index]
    }

    let assault = $state(untrack(() => attackerShips.fresh + attackerShips.damaged))
    let skirmish = $state(0)
    let raid = $state(0)
    const dice = $derived({ [Die.Assault]: assault, [Die.Skirmish]: skirmish, [Die.Raid]: raid })

    const sensorSources = $derived(
        battle
            ? game
                  .adjacent(battle.system)
                  .map((system) => ({
                      system,
                      fresh: shipsOf(game.system(system), battle.defender).fresh
                  }))
                  .filter((source) => source.fresh > 0)
            : []
    )
    let sensorMoves: Record<string, number> = $state({})
    const moves = $derived(
        Object.entries(sensorMoves)
            .filter(([, fresh]) => fresh > 0)
            .flatMap(([from, fresh]) => {
                const system = sensorSources.find((source) => source.system === from)?.system
                return system ? [{ from: system, fresh }] : []
            })
    )
</script>

{#if battle}
    <div class="battle">
        <p class="prompt">
            Battle in {battle.system}: <PlayerName playerId={battle.attacker} /> against
            <PlayerName playerId={battle.defender} />.
        </p>
        {#if battle.rolled.length > 0}
            <DiceRoll
                rolled={battle.rolled}
                selected={rerolling}
                onToggle={step === BattleStep.Hits && anyRerolls(battle.rerolls)
                    ? toggleReroll
                    : undefined}
            />
        {/if}

        {#if step === BattleStep.Sensors}
            <p>Move fresh ships in with Predictive Sensors?</p>
            {#each sensorSources as source (source.system)}
                <Stepper
                    label="From {source.system}"
                    bind:value={sensorMoves[source.system]}
                    max={source.fresh}
                />
            {/each}
            <button
                type="button"
                class="choice"
                disabled={!gameSession.canMoveInBySensors(moves)}
                onclick={() => gameSession.moveInBySensors(moves)}
            >
                {moves.length > 0 ? 'Move them in' : 'Move none'}
            </button>
        {:else if step === BattleStep.Dice}
            <Stepper label="Assault" bind:value={assault} max={12} />
            <Stepper label="Skirmish" bind:value={skirmish} max={12} />
            <Stepper label="Raid" bind:value={raid} max={12} />
            <button
                type="button"
                class="choice"
                disabled={!gameSession.canRollDice(dice)}
                onclick={() => gameSession.rollDice(dice)}>Roll</button
            >
        {:else if step === BattleStep.Hits}
            {#if anyRerolls(battle.rerolls)}
                <button
                    type="button"
                    class="choice"
                    disabled={!gameSession.canReroll(rerolling)}
                    onclick={() => gameSession.reroll(rerolling)}
                >
                    Reroll {rerolling.length}
                    {rerolling.length === 1 ? 'die' : 'dice'}
                </button>
            {/if}
            {#key JSON.stringify(battle.rolled)}
                <HitsPanel {battle} />
            {/key}
        {:else if step === BattleStep.Ransack}
            <p>A city fell: Ransack the Court. Choose a card with their agents.</p>
        {:else if step === BattleStep.Raid}
            <p>{battle.keys} key{battle.keys === 1 ? '' : 's'} to raid with.</p>
            <div class="raids">
                {#each gameSession.raidTargets as option (`${option.target.slot}-${option.target.cardId}`)}
                    {#each option.discards as discard (discard ?? 'none')}
                        <button
                            type="button"
                            class="choice raid"
                            onclick={() => gameSession.raid(option.target, discard)}
                        >
                            {#if option.target.cardId}
                                <img
                                    class="card"
                                    src={cardArt(option.target.cardId)}
                                    alt={option.target.cardId}
                                />
                            {:else if option.target.slot !== undefined}
                                {@const resource = game.getPlayerState(battle.defender).resources[
                                    option.target.slot
                                ]}
                                {#if resource}<img
                                        src={resourceIconArt(resource)}
                                        alt={resource}
                                    />{/if}
                            {/if}
                            {option.cost} key{option.cost === 1 ? '' : 's'}{discard
                                ? `, discard ${discard}`
                                : ''}
                        </button>
                    {/each}
                {/each}
            </div>
            {#if gameSession.canEndBattle}
                <button type="button" class="choice" onclick={() => gameSession.endBattle()}
                    >Stop raiding</button
                >
            {/if}
        {:else if step === BattleStep.Beloved}
            <p>Influence a Court card, or not.</p>
            <button type="button" class="choice" onclick={() => gameSession.belovedInfluence()}
                >Don't influence</button
            >
        {/if}
    </div>
{/if}

<style>
    .battle {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .raids {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .raid {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .raid img {
        width: 24px;
    }

    .raid img.card {
        width: 40px;
    }
</style>
