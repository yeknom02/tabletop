// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus
} from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    ActionType,
    Ambition,
    ArcsGameStateValidator,
    ArcsInfo,
    ArcsRuntime,
    Definition,
    LeadersAndLore,
    Resource
} from '@tabletop/arcs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const engine = new GameEngine(ArcsRuntime)

// A 3-player game without leaders, its map cleared, in which the first player has led `cardId`.
function leading(cardId) {
    const game = ArcsRuntime.initializer.initializeGame(
        {
            id: 'arcs-scenario',
            typeId: ArcsInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(ArcsInfo.configurator.options),
                leadersAndLore: LeadersAndLore.None
            }),
            players: ['Amira', 'Bashir', 'Chen'].map((name, index) => ({
                id: `p${index}`,
                name,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const started = engine.startGame(game, { masterSeed: MASTER_SEED })
    let state = structuredClone(started.initialState)
    const [first] = state.turnManager.turnOrder
    const player = state.players.find(({ playerId }) => playerId === first)
    player.hand = [cardId, ...player.hand.filter((card) => card !== cardId).slice(0, 5)]
    player.handCount = player.hand.length
    for (const system of state.systems) {
        system.ships = {}
        system.slots = system.slots.map(() => null)
    }
    for (const seated of state.players) {
        seated.ships = 15
        seated.citiesOnBoard = 5
        seated.starports = 5
    }
    state = engine.executeCanonicalAction({
        game: started.startedGame,
        state,
        action: {
            id: 'scenario-lead',
            gameId: started.startedGame.id,
            playerId: first,
            source: ActionSource.User,
            type: ActionType.LeadCard,
            cardId
        }
    }).updatedState
    return { game: started.startedGame, state: structuredClone(state) }
}

const seat = (state, index) =>
    state.players.find(({ playerId }) => playerId === state.turnManager.turnOrder[index])
const system = (state, id) => state.systems.find((candidate) => candidate.id === id)

function ships(state, id, player, fresh, damaged = 0) {
    system(state, id).ships[player.playerId] = { fresh, damaged }
    player.ships -= fresh + damaged
}

function building(state, id, slot, player, kind, damaged = false) {
    system(state, id).slots[slot] = { owner: player.playerId, kind, damaged }
    if (kind === 'city') player.citiesOnBoard -= 1
    else player.starports -= 1
}

function agents(state, courtIndex, player, count) {
    state.court[courtIndex].agents[player.playerId] = count
    player.agents -= count
}

// The first cluster in play, for systems that exist on this setup card.
function cluster(state, offset = 0) {
    return [1, 2, 3, 4, 5, 6].filter((n) => !state.outOfPlay.includes(n))[offset]
}

function write(slug, name, { game, state }) {
    if (!ArcsGameStateValidator.Check(state)) {
        throw new Error(`The ${slug} position is not a valid state`)
    }
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

mkdirSync(OUT, { recursive: true })

write(
    'battle-ready',
    'Battle ready',
    (() => {
        const position = leading('aggression-3')
        const { state } = position
        const [a, b, c] = [0, 1, 2].map((index) => seat(state, index))
        const n = cluster(state)
        ships(state, `${n}A`, a, 4)
        ships(state, `${n}A`, b, 2)
        building(state, `${n}A`, 0, b, 'city')
        ships(state, `${n}G`, a, 2)
        ships(state, `${n}G`, c, 1, 1)
        building(state, `${n}H`, 0, b, 'starport')
        ships(state, `${n}H`, b, 1)
        b.resources = [Resource.Fuel, Resource.Relic, Resource.Weapon, null, null, null]
        agents(state, 0, b, 2)
        agents(state, 0, c, 1)
        return position
    })()
)

write(
    'mid-chapter',
    'Mid-chapter',
    (() => {
        const position = leading('construction-4')
        const { state } = position
        const [a, b, c] = [0, 1, 2].map((index) => seat(state, index))
        const [n1, n2, n3] = [0, 1, 2].map((offset) => cluster(state, offset))
        ships(state, `${n1}A`, a, 3)
        building(state, `${n1}A`, 0, a, 'city')
        ships(state, `${n1}G`, a, 2, 1)
        ships(state, `${n1}H`, b, 2)
        building(state, `${n1}H`, 0, b, 'starport', true)
        ships(state, `${n2}C`, b, 4)
        building(state, `${n2}C`, 0, b, 'city')
        ships(state, `${n2}G`, c, 3)
        ships(state, `${n2}G`, a, 1)
        ships(state, `${n3}A`, c, 2, 2)
        building(state, `${n3}A`, 0, c, 'city')
        building(state, `${n3}H`, 0, c, 'starport')
        a.resources = [Resource.Material, Resource.Fuel, Resource.Weapon, null, null, null]
        b.resources = [Resource.Relic, Resource.Psionic, null, null, null, null]
        c.resources = [Resource.Fuel, Resource.Fuel, null, null, null, null]
        a.trophies = [{ owner: c.playerId, kind: 'ship' }]
        b.captives = { [a.playerId]: 1 }
        a.agents -= 1
        state.ambitionMarkers[0].ambition = Ambition.Tycoon
        agents(state, 0, a, 1)
        agents(state, 1, b, 2)
        agents(state, 1, c, 1)
        agents(state, 2, c, 1)
        return position
    })()
)
