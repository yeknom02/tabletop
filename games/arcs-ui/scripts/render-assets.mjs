// Converts the HRF Arcs art and the Arcs Development Kit into the images the UI shows, in
// src/lib/images, sized to about twice the size each is drawn at, and writes
// src/lib/images/art.generated.ts to import them, because the rollup bundle cannot resolve
// `import.meta.glob`.
//
// Neither source is in the repository. Needs ImageMagick (`convert`).
// Run from games/arcs-ui: node scripts/render-assets.mjs <HRF img folder> <development kit folder>
// then format the manifest: pnpm exec prettier --write src/lib/images/art.generated.ts
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [source, kit] = process.argv.slice(2)
if (!source || !kit) {
    console.error('Usage: node scripts/render-assets.mjs <HRF img folder> <development kit folder>')
    process.exit(1)
}
const kitPieces = path.join(kit, 'icon and punchboard')

const images = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'images')
rmSync(images, { recursive: true, force: true })

const manifest = []

function render(from, to, args, folder = source) {
    const target = path.join(images, to)
    mkdirSync(path.dirname(target), { recursive: true })
    execFileSync('convert', [path.join(folder, from), ...args, target])
    manifest.push(to)
}

const opaque = (width) => ['-resize', `${width}x`, '-quality', '80']
const alpha = ['-quality', '85', '-define', 'webp:alpha-quality=90']

render('asset-map-no-slots.webp', 'map/map.webp', opaque(2000))
render('asset-map-no-slots.webp', 'cover.webp', [
    '-gravity',
    'center',
    '-crop',
    '1500x900+0+0',
    '+repage',
    ...opaque(720)
])

for (let cluster = 1; cluster <= 6; cluster++) {
    render(`asset-map-out-${cluster}.webp`, `map/out-${cluster}.webp`, [
        '-resize',
        '2000x',
        ...alpha
    ])
}

// The kit's pieces: a building's back is its damaged side; a damaged ship is the same piece tipped.
const KitPieces = {
    ship: 'ship',
    city: 'city',
    'city-damaged': 'city back',
    starport: 'starport',
    'starport-damaged': 'starport back',
    agent: 'agent'
}
for (const color of ['red', 'blue', 'white', 'yellow']) {
    for (const [piece, file] of Object.entries(KitPieces)) {
        render(
            `arcs dev_player piece ${color} ${file}.png`,
            `pieces/${color}-${piece}.webp`,
            alpha,
            kitPieces
        )
    }
}
render('arcs dev_initiative marker.png', 'tokens/initiative.webp', alpha, kitPieces)
for (const resource of ['material', 'fuel', 'weapon', 'relic', 'psionic']) {
    render(
        `arcs dev_punchboard resource ${resource}.png`,
        `resources/${resource}.webp`,
        ['-resize', '96x96', ...alpha],
        kitPieces
    )
    render(
        `arcs dev_icon resource ${resource}.png`,
        `icons/${resource}.webp`,
        ['-resize', '64x64', ...alpha],
        kitPieces
    )
}
for (const symbol of ['hit', 'self hit', 'intercept', 'building hit', 'key']) {
    render(
        `arcs dev_icon dice ${symbol} white.png`,
        `icons/${symbol.replace(' ', '-')}.webp`,
        ['-resize', '48x48', ...alpha],
        kitPieces
    )
}
for (const side of ['front 5-3', 'front 3-2', 'front 2-0', 'back 9-4', 'back 6-3', 'back 4-2']) {
    render(
        `arcs dev_punchboard ambition ${side}.png`,
        `tokens/ambition-${side.replace(' ', '-')}.webp`,
        ['-resize', '112x', ...alpha],
        kitPieces
    )
}
// Raid costs printed under the player board's resource slots.
for (let keys = 1; keys <= 4; keys++) {
    render(`asset-keys-${keys}.webp`, `icons/keys-${keys}.webp`, ['-resize', '44x44', ...alpha])
}
render('CardAsset-Texture-Frame.png', 'textures/paper.webp', ['-quality', '80'], kit)
render('CardAsset-Texture-Space.png', 'textures/space.webp', ['-quality', '80'], kit)
for (const back of ['Action', 'Court', 'Lore']) {
    render(`CardAsset-Back-${back}.png`, `cards/back-${back.toLowerCase()}.webp`, opaque(240), kit)
}

for (const die of ['assault', 'skirmish', 'raid']) {
    for (let face = 1; face <= 6; face++) {
        render(`asset-${die}-die-${face}.webp`, `dice/${die}-${face}.webp`, [
            '-resize',
            '80x80',
            ...alpha
        ])
    }
}

for (const suit of ['administration', 'aggression', 'construction', 'mobilization']) {
    for (let number = 1; number <= 7; number++) {
        render(`asset-${suit}-${number}.webp`, `cards/action/${suit}-${number}.webp`, opaque(320))
    }
}

const twoDigits = (n) => String(n).padStart(2, '0')
for (let n = 1; n <= 31; n++) {
    render(`asset-bc${twoDigits(n)}.webp`, `cards/court/BC${twoDigits(n)}.webp`, opaque(320))
}
for (let n = 1; n <= 28; n++) {
    render(`asset-lore${twoDigits(n)}.webp`, `cards/lore/L${twoDigits(n)}.webp`, opaque(320))
}
for (let n = 1; n <= 16; n++) {
    render(`asset-leader${twoDigits(n)}.webp`, `cards/leader/LEAD${twoDigits(n)}.webp`, opaque(360))
}

const lines = [
    '// Generated by scripts/render-assets.mjs from the HRF art; do not edit.',
    '',
    ...manifest.map((file, index) => `import image${index} from './${file}'`),
    '',
    'export const Art: Readonly<Record<string, string>> = {',
    ...manifest.map((file, index) => `    '${file.replace(/\.webp$/, '')}': image${index},`),
    '}',
    ''
]
writeFileSync(path.join(images, 'art.generated.ts'), lines.join('\n'))
console.log(`${manifest.length} images`)
