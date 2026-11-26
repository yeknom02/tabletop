import {
    ActionSource,
    GameEngine,
    MachineContext,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameState
} from '@tabletop/common'
import {
    ActionType,
    ConduitInfo,
    ConduitRuntime,
    Definition,
    MachineState,
    type ConduitProjectedState,
    type HydratedConduitGameState
} from '@tabletop/conduit'

// The engine every bot move goes through, exactly as a player's move does in the game.
export const engine = new GameEngine(ConduitRuntime)

const Names = ['Ada', 'Ben', 'Cleo', 'Dev', 'Eve']

// A move as a bot proposes it: the action's type and its own fields, for the active player.
export type Move = { type: ActionType } & Record<string, unknown>

export type BotAction = Move & { playerId: string }

export type Table = {
    game: Game
    state: ConduitProjectedState
    actions: GameAction[]
}

// A new game under the default (printed) rules, dealt from the seed: the same seed and the same
// seats deal the same game. Players are named for their seat's bot unless names are given.
export function newTable(
    players: number,
    seed: number,
    seatNames: string[],
    playerNames: string[] = seatNames.map((spec, index) => `${Names[index]} (${spec})`)
): Table {
    const id = `conduit-bots-${players}p-${seed}-${Date.now().toString(36)}`
    const game = ConduitRuntime.initializer.initializeGame(
        {
            id,
            name: `Bots ${players}p seed ${seed}`,
            typeId: ConduitInfo.id,
            ownerId: 'conduit-bots',
            config: {},
            players: Array.from({ length: players }, (_, index) => ({
                id: `p${index}`,
                name: playerNames[index],
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const masterSeed = seed.toString(16).padStart(32, '0')
    const started = engine.startGame(game, { masterSeed })
    return {
        game: started.startedGame,
        state: started.initialState as ConduitProjectedState,
        actions: []
    }
}

export function hydrate(state: GameState): HydratedConduitGameState {
    return ConduitRuntime.hydrator.hydrateState(
        structuredClone(state) as ConduitProjectedState
    ) as HydratedConduitGameState
}

export function activePlayerId(state: GameState): string | undefined {
    return state.activePlayerIds[0]
}

export function isOver(state: GameState): boolean {
    return state.machineState === MachineState.EndOfGame
}

function asAction(game: Game, move: BotAction, id = 'candidate'): GameAction {
    return { ...move, id, gameId: game.id, source: ActionSource.User }
}

// Candidate fields for each action type. The engine decides which of them are legal; this only
// lists what could be tried.
function candidates(state: HydratedConduitGameState, type: ActionType): Move[] {
    switch (type) {
        case ActionType.PlaceBid:
            return state.market.map(({ spot }) => ({ type, spot }))
        case ActionType.PlaceTile: {
            const placement = state.pendingPlacement()
            if (!placement) return []
            const extras = placement.faceUp ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0]
            return state
                .grid()
                .legalPlacements(placement.tileId, placement.faceUp)
                .flatMap((option) =>
                    option.rotations.flatMap((rotation) =>
                        extras.map((extraCubes) => ({
                            type,
                            cell: option.cell,
                            rotation,
                            extraCubes
                        }))
                    )
                )
        }
        case ActionType.ChooseRoute: {
            const choice = state.pendingRouteChoice()
            if (!choice) return []
            return choice.options.map((option) => ({
                type,
                tileId: choice.tileId,
                route: option.cells
            }))
        }
        default:
            return [{ type }]
    }
}

// Every legal move for the player, grouped by action type, from the engine's own state handler:
// the action types it offers the player, and the candidates its validity check accepts.
export function legalMoves(
    game: Game,
    state: GameState,
    playerId: string
): Map<ActionType, Move[]> {
    const hydrated = hydrate(state)
    const context = new MachineContext({ gameConfig: game.config, gameState: hydrated })
    const handler = ConduitRuntime.stateHandlers[hydrated.machineState as MachineState]
    const moves = new Map<ActionType, Move[]>()
    for (const type of handler.validActionsForPlayer(playerId, context) as ActionType[]) {
        const legal = candidates(hydrated, type).filter((move) => {
            const action = ConduitRuntime.hydrator.hydrateAction(
                asAction(game, { ...move, playerId })
            )
            return handler.isValidAction(action, context)
        })
        if (legal.length > 0) moves.set(type, legal)
    }
    return moves
}

// Applies a bot's move through the engine, as a player's action, with the cascade of system
// actions it sets off. Throws if the engine refuses it.
export function applyMove(table: Table, move: BotAction): Table {
    const action = asAction(table.game, move, `${table.game.id}-${table.state.actionCount}`)
    const result = engine.executeCanonicalAction({ game: table.game, state: table.state, action })
    return {
        game: table.game,
        state: result.updatedState as ConduitProjectedState,
        actions: [...table.actions, ...result.processedActions]
    }
}

// Checks a move against a position without keeping the result.
export function checkMove(game: Game, state: GameState, move: BotAction) {
    engine.executeAction({
        game,
        state: structuredClone(state) as ConduitProjectedState,
        action: asAction(game, move)
    })
}
