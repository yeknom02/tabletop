# The Reach: map and setup data

Where `src/components/map.ts` and `src/components/setupCards.ts` come from.

## Systems

Six clusters of a gate and three planets. Each planet is named by the ID symbol printed beside it on the map's edge: arrow (A), crescent (C) and hex (H). A system id is its cluster then its kind: `3G`, `5H`.

Planet types and building slots were read from the map art and its slot overlay, and checked against an independent implementation (HRF 0.8.161).

| Planet | Type     | Slots |     | Planet | Type     | Slots |
| ------ | -------- | ----- | --- | ------ | -------- | ----- |
| 1A     | Weapon   | 2     |     | 4A     | Relic    | 2     |
| 1C     | Fuel     | 1     |     | 4C     | Fuel     | 2     |
| 1H     | Material | 2     |     | 4H     | Material | 1     |
| 2A     | Psionic  | 1     |     | 5A     | Weapon   | 1     |
| 2C     | Weapon   | 1     |     | 5C     | Relic    | 1     |
| 2H     | Relic    | 2     |     | 5H     | Psionic  | 2     |
| 3A     | Material | 1     |     | 6A     | Material | 1     |
| 3C     | Fuel     | 1     |     | 6C     | Fuel     | 2     |
| 3H     | Weapon   | 2     |     | 6H     | Psionic  | 1     |

## Adjacency

- A gate is adjacent to its three planets and to the gates of the neighbouring clusters. Out-of-play clusters are skipped: their path marker joins the gates either side.
- A crescent planet is adjacent to its gate and the arrow and hex planets of its cluster; arrow and hex planets to their gate and crescent.
- Across clusters, only two pairs of planets share a thin border: 2H–3A and 5H–6A.

## Setup cards

Seat 1 is the player with initiative. A gets 3 ships and a city, B 3 ships and a starport, each C 2 ships.

| Card             | Out of play | Seat 1        | Seat 2        | Seat 3     | Seat 4     |
| ---------------- | ----------- | ------------- | ------------- | ---------- | ---------- |
| 2P Frontiers     | 1, 6        | 5H, 4H, 3G+3H | 3A, 5A, 5G+4A |            |            |
| 2P Mix Up 1      | 2, 5        | 4C, 3C, 1G+6A | 6H, 3H, 4G+1C |            |            |
| 2P Homelands     | 1, 4        | 5A, 6A, 5G+5H | 3H, 3A, 3G+2A |            |            |
| 2P Mix Up 2      | 1, 4        | 5C, 2A, 3G+6C | 2C, 6A, 5G+3H |            |            |
| 3P Mix Up        | 1, 4        | 3H, 5C, 2G    | 5H, 2A, 3G    | 2H, 3A, 5G |            |
| 3P Frontiers     | 2, 3        | 1H, 4H, 6G    | 5H, 1C, 5G    | 4C, 6A, 1G |            |
| 3P Homelands     | 5, 6        | 2H, 3C, 3G    | 1H, 2A, 2G    | 1A, 4H, 4G |            |
| 3P Core Conflict | 3, 6        | 1H, 2C, 1G    | 2H, 1C, 2G    | 1A, 2A, 4G |            |
| 4P Mix Up 1      | 3           | 4A, 6H, 1G    | 4H, 5H, 6G    | 5A, 1H, 4G | 6A, 1A, 5G |
| 4P Mix Up 2      | 4           | 5H, 3A, 2G    | 3H, 5C, 1G    | 2H, 1H, 3G | 1A, 2A, 5G |
| 4P Frontiers     | 5           | 1H, 3C, 2G    | 2H, 6H, 3G    | 4C, 2A, 6G | 1A, 6A, 4G |
| 4P Mix Up 3      | 6           | 3H, 5C, 1G    | 1A, 3A, 2G    | 1H, 4H, 3G | 4A, 2C, 5G |

2P Frontiers, 2P Mix Up 1, 3P Homelands, 4P Frontiers and 4P Mix Up 3 were read from the cards by laying each card's diagram over the map's system regions. The others match HRF's data, which also agrees with the 4P Mix Up 1 card read the same way.
