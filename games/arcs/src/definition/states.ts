export enum MachineState {
    // Leaders & Lore: players draft their leader and lore (rule 11.1).
    Drafting = 'Drafting',
    // Hands are dealt once the draft is done, which is a reveal.
    Dealing = 'Dealing',
    // Two players: after each deal, the player without initiative may redraw (rule 6.2.4.1).
    Mulligan = 'Mulligan',
    // The active player leads, passes the initiative, or follows the lead card.
    PlayingCard = 'PlayingCard',
    // The active player spends their Prelude and pips.
    TakingActions = 'TakingActions',
    // The active player resolves a battle they started: hits, Ransacks, then raiding.
    Battling = 'Battling',
    // The chapter is over: scoring, clean-up and a new deal, all in one System Action.
    EndingChapter = 'EndingChapter',
    EndOfGame = 'EndOfGame'
}
