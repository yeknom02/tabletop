// PROTOTYPE: which candidate bid table the contract menu shows, from `?variant=` (dev builds only).
export const Variants = [
    { key: 'A', name: 'Ledger', width: 960 },
    { key: 'B', name: 'Table + detail pane', width: 860 },
    { key: 'C', name: 'Value bands, full reference', width: 760 },
    { key: 'D', name: 'Compact, expanding row', width: 640 },
    { key: 'E', name: 'Ledger, one Besserrufer row', width: 960 },
    { key: 'F', name: 'Table + pane, one Besserrufer row', width: 860 },
    { key: 'G', name: 'Value ladder, Besserrufer column', width: 820 },
    { key: 'H', name: 'Compact, one Besserrufer row', width: 820 },
    { key: 'I', name: 'H table + side pane; H on phones', width: 1040 },
    { key: 'now', name: 'Current list', width: 620 }
] as const

export type VariantKey = (typeof Variants)[number]['key']

function initial(): VariantKey {
    const param = new URLSearchParams(location.search).get('variant')
    return Variants.find((variant) => variant.key === param)?.key ?? 'A'
}

class BidTableVariant {
    current: VariantKey = $state(initial())

    get entry() {
        return Variants.find((variant) => variant.key === this.current) ?? Variants[0]
    }

    step(by: number) {
        const index = Variants.findIndex((variant) => variant.key === this.current)
        const next = Variants[(index + by + Variants.length) % Variants.length]
        this.current = next.key
        const url = new URL(location.href)
        url.searchParams.set('variant', next.key)
        history.replaceState(history.state, '', url)
    }
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- Vite's built-in flag, not an env var
export const bidTableVariant: BidTableVariant | undefined = import.meta.env.DEV
    ? new BidTableVariant()
    : undefined
