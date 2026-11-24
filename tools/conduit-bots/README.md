# Conduit bots

Bots for Conduit, served to the game's dev harness and played in batches. The server imports the
built `@tabletop/conduit` engine (`games/conduit/esm`), so build the game after changing its rules:
`pnpm --filter @tabletop/conduit build`.

## Running

```bash
pnpm --filter @tabletop/conduit-bots start      # bot server on port 4196 (PORT to change)
pnpm --filter @tabletop/conduit-ui dev          # harness on port 5240; proxies /bots to the server
```

Open the harness at `http://tabletop:5240` and use the Bots bar in its navbar. The harness's dev
server finds the bot server at `http://127.0.0.1:4196`; set `CONDUIT_BOT_SERVER` to point it
elsewhere.

Batches of bot games, kept as a named run:

```bash
pnpm --filter @tabletop/conduit-bots play --run <name> --games 20 --players 4 --seed 1 --bots random@v1
pnpm --filter @tabletop/conduit-bots test
pnpm --filter @tabletop/conduit-bots check
```

## Routes

All under `/bots`, JSON in and out:

| Route                                  | What it does                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GET specs`                            | The bots, and the one new seats start with                                                                              |
| `POST move` `{ game, state, seats }`   | The active player's bot's move, checked by the engine. The harness applies it through the engine like a player's action |
| `POST play` `{ players, seed, seats }` | Plays a whole bot game and keeps it in the `harness` run. `seats` lists bots by seat, repeated round the table          |
| `GET runs`                             | The runs of kept games                                                                                                  |
| `GET games?run=`                       | A run's kept games, newest first                                                                                        |
| `GET game?file=`                       | One kept game, as a scenario the harness opens                                                                          |

## How bots play

- Every bot move goes through the engine. The server lists legal moves from the engine's own state
  handler (the action types it offers the player, and the candidates its validity check accepts),
  and a game is played by `executeCanonicalAction`, exactly as the game applies a player's action.
- A bot sees the table as its player does: hidden tiles stay hidden.
- Play is reproducible. In a batch or `play`, the seed deals the game and drives the bots. For a
  harness `move`, the decision is seeded from the game and the position, so the same bot in the
  same position makes the same move.
- Every bot game keeps its whole action history, one JSON file per game under
  `tmp/conduit/bot-games/<run>/` (`CONDUIT_BOT_GAMES` to change). The harness opens a kept game as
  a scenario, with its history and Undo.
- A bot is a name and version (`random@v1`). Changing a bot's habits makes a new version, so kept
  games always name the bot that played them.
