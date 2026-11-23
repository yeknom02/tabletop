# Conduit UI interaction visual contract

## Visual intents

- **Bid targets.** On the acting player's bidding turn, every spot whose track has room gets a blue frame and becomes a button over the whole spot. Hovering or focusing a spot shows a faint cube in the bidder's colour on the space the bid would take. Spots out of play (beyond players + 1) are dimmed and never interactive.
- **Offer.** While a tile is on offer, its spot has a gold frame, the bottom cube a gold outline and the price shows under the tile. Everyone sees this; only the offered player gets Buy and Pass in the action panel.
- **Placement targets.** On the placing player's turn, every legal cell shows a dashed blue square and is a button. Nothing else on the grid changes.
- **Chosen cell.** Choosing a target turns its outline gold and previews the tile in it, at the chosen turn or else the first legal one. For a face-up tile a popup beside the cell offers the legal turns (when more than one), then the extra cubes. A face-down tile, or a single turn with an empty supply, commits on the cell choice and shows no popup.
- **Inspected route.** Clicking (or Enter/Space on) an owned station draws its current best route as a blue line; clicking it again hides it.
- **Paid routes.** In History View on a revenue step, every route that step paid is drawn in its owner's colour, and each station's badge shows what it was paid instead of what it would earn now.
- **Tile flight and payouts.** A played or replayed placement flies the tile from its auction spot to its cell; a played or replayed revenue step floats "+$N" up from each paying station.

## Coexistence and precedence

- Bid targets, the offer and placement targets belong to different machine states, so they never overlap.
- Placement targets are empty cells and stations are occupied cells, so an inspected route and placement targets coexist without overlapping hit targets.
- Paid routes win over the inspected route: `shownRoutes` returns the paid routes in a viewed revenue step and the inspected route otherwise. Badges follow the same switch (`stationBadges`).
- The chosen cell's popup hides while the session is busy, so it never shows over a tile flight.

## Shared visual state

- **Placement selection** (`cell`, then `rotation`): produced by board clicks and the popup; consumed by the grid's target and preview, the popup and the action that commits. It is a registered staged selection: Undo pops the manual stages (an auto-picked single turn is skipped), and the session clears it whenever a new state is published. Choosing the chosen cell again clears it; clicking elsewhere leaves the popup open, so a click on Undo is never also a dismissal. It is valid only while the session has a placement for the viewer.
- **Inspected cell**: produced by station clicks; consumed by the grid's route line. It has no lifetime boundary of its own; it is valid only while that cell holds an owned station, since the route comes from `stationRoutes` of the displayed state. In History View it follows the displayed state, and is overridden by paid routes on a revenue step.
- **Flying tile and payout floats** (`TableAnimator`): written once per animated action for presence only; positions are tweened on the elements. Payout floats and the flying tile clear when the session publishes the next state (`beforeNewState`), because the action's cascade animates before that state is shown and the tile must stay where it landed until then. Actions without an action record (Undo, state-only history steps) animate nothing.

## Render ownership

- The table is one SVG: the auction board, the grid, the flying tile and the payout floats. The flying tile and floats are drawn last, above both boards.
- Red sticks for closed connections are drawn by the grid above the tiles, except on the Central Station's edges, which the Central Station draws itself.
- The placement popup is rendered in the scaling wrapper's toolbar, outside the board's zoom, and anchored to the chosen cell's element id.

## Verification scenarios

| Start             | Input                                         | Expected                                                                                            | Verified         |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------- |
| Mid game grid     | Hover a spot, click it                        | Ghost cube on the next space; the cube lands there and the turn passes                              | Manual (harness) |
| Stacked offer     | Pass, pass, pass                              | Gold frame stays on spot 1 as the price drops 4, 2, 1; then the Start Player gets face-down targets | Manual (harness) |
| Placing a station | Click the target, choose a turn, choose cubes | Gold outline and preview; popup turns then cubes; tile flies in and the badge appears               | Manual (harness) |
| Placing a station | Choose cell and turn, then Undo twice         | First Undo drops the turn, second drops the cell; no action undone                                  | Manual (harness) |
| Mid game grid     | Click a station, then click it again          | Blue route appears, then hides                                                                      | Manual (harness) |
| Mid game grid     | History: click the latest Revenue entry       | Routes in owners' colours, badges show amounts paid; stepping forward restores live badges          | Manual (harness) |
| Last tile         | Place the tile                                | Flight, then "+$N" floats for each payout round, then the end-of-game panel                         | Manual (harness) |
