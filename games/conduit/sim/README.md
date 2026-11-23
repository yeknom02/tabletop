# Conduit bot studies

Bots that play Conduit through the real engine, to probe the design for weaknesses. **This folder
stays out of pull requests by default**: keep it in its own commits and leave it off any PR branch
unless the designer asks otherwise.

## Map

- Rules authority: the designer's rules (`games/conduit-ui/src/lib/rules/rules.md`) and the rulings
  recorded with the game. The engine is `games/conduit/src`; the bots drive it through
  `GameEngine`, so a rule change there reaches the bots with no other edits.
- `src/game.ts` plays one seeded game and returns its record (cash by round, bids, buys, passes,
  offers, placements with what the bot saw, revenues).
- `src/bots/`: `evaluate.ts` (what a placement earns each player now), `habitBot.ts` (one knob per
  habit), `randomBot.ts`, `catalog.ts` (named presets and the spec syntax).
- `src/run.ts` plays a study in parallel; `src/worker.ts` is its worker.
- `src/analyze/` reads a run and reports, with 95% intervals.

## Bots

A spec is a preset, optionally a letter and habit overrides: `balanced`, `focus:B`,
`balanced{keep=2,margin=0}`. Presets: `random`, `balanced`, `greedy`, `cautious`, `passer`,
`blocker`, `stacker`, `hoarder`, `focus:<A-D>`. Habits are listed in `habitBot.ts`.

The bots value a tile by what its best placement would earn them **now**, times the cubes they
would put on it, discounted for later payouts. They do not look ahead at how the network will
grow, so their measure of placement choices is myopic: read "tied" placements as "tied by
immediate revenue", not as "meaningless".

## Running

From `games/conduit`:

```bash
/workspace/node_modules/.bin/tsx sim/src/run.ts --name <run> --lineup balanced,balanced,passer,balanced \
  --games 500 --rotate --cubes 2 --workers 12 --purpose "<question>"
/workspace/node_modules/.bin/tsx sim/src/analyze/summary.ts /workspace/tmp/conduit/runs/<run>
```

Runs are written to `/workspace/tmp/conduit/runs/<run>/` (`run.json` with the commit and a dirty
flag, `games-*.jsonl` one game per line). Seeds start at 1, so runs with the same `--games` play
the same deals and can be compared pair by pair. `--rotate` plays every rotation of the lineup on
each seed. Play a few check games before a long run; a game takes about 0.5 s per worker.
Results compare only within one engine and bot version: name runs for their version and purpose.
