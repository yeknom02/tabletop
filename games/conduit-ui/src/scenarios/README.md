# Conduit harness scenarios

Each file is a position reached by real play from a seeded start, so the history and Undo work.
`node scripts/build-scenarios.mjs` writes them all (build `@tabletop/conduit` first).

## Mid game grid

Four players, round 3, bidding. The grid has owned stations, face-down tiles and a closed
connection.

- Click an owned station: its route to another station of the same letter lights up, matching its revenue badge.
- Check the red stick sits on the edge where two opposite terminals meet.
- Bid on any spot: the cube goes on the lowest free space of that track.

## Stacked offer

Three players. Spot 1's track holds, from the bottom, the Start Player, the Start Player again,
the third player and the Start Player.

- Pass as the Start Player: both bottom cubes go back to supply for $1, and the third player is
  offered the tile at $2.
- Pass as the third player: the Start Player is offered it again at $1, and passing pays another $1.
- With everyone passed, the Start Player places the tile face down.

## Placing a station

Four players, round 2. A bought tile waits to be placed, and the grid already spans six tiles one
way.

- Every lit cell borders a tile, and none would stretch the grid past 6×6: the cells beyond the
  six-tile side stay dark.
- Choose a cell, then a turn and the extra cubes: the station shows its cubes and revenue badge.
- Undo steps back through the cube, turn and cell choices before undoing anything played.

## Last tile

Three players, the last tile of round 5.

- Place it: revenue and infrastructure loss repeat until no cubes are left, the history shows
  Final payouts, and the game ends with the most cash winning.
