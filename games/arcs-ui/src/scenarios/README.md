# Arcs harness scenarios

Written by `scripts/build-scenarios.mjs` (build the logic package first). Each is a 3-player game
without leaders or lore, with the first player taking actions after leading a card.

## Battle ready

The first player led Aggression 3. In the first cluster in play they have 4 ships at the arrow
planet, where the second player has 2 ships and a city; 2 ships at the gate, with the third
player's fresh and damaged ship; and the second player has a starport and a ship at the hex planet.
The second player holds Fuel, Relic and Weapon, and has 2 agents on the first Court card, the third
player 1.

- Choose Battle, then the arrow planet: the battle popup offers the second player as defender and
  dice up to 4 (raid dice allowed, since a defending city is there). Roll.
- Assign the hits the panel lists; destroying the city Outrages the attacker and asks for a Ransack
  of the first Court card, whose agents become Trophies.
- With keys left and a ship left, raid the second player's resources; Stop raiding ends the battle.

## Mid-chapter

The first player led Construction 4. Ships, cities and starports of all three players across three
clusters (one starport damaged, ships damaged at two systems), resources in every player's slots, a
Trophy and a Captive, Tycoon declared, and agents on three Court cards.

- Look over the board, the ambitions' standings and the player panels.
- Build: city or starport where you have pieces, or a ship at your starport.
