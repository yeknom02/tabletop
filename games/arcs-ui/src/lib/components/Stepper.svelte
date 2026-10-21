<script lang="ts">
    let {
        label,
        value = $bindable(0),
        min = 0,
        max
    }: { label: string; value?: number; min?: number; max: number } = $props()
</script>

<div class="stepper">
    <span class="label">{label}</span>
    <button
        type="button"
        aria-label="Fewer {label}"
        disabled={value <= min}
        onclick={() => (value -= 1)}>−</button
    >
    <span class="value">{value}</span>
    <button
        type="button"
        aria-label="More {label}"
        disabled={value >= max}
        onclick={() => (value += 1)}>+</button
    >
</div>

<style>
    .stepper {
        display: grid;
        grid-template-columns: 1fr 32px 32px 32px;
        align-items: center;
        gap: 4px;
    }

    button {
        height: 30px;
        border: 1px solid var(--arcs-gold);
        border-radius: 6px;
        font-size: 1.1rem;
    }

    button:disabled {
        opacity: 0.3;
    }

    .value {
        text-align: center;
        font-weight: 600;
    }
</style>
