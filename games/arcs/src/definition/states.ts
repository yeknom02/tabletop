export enum MachineState {
    // Leaders & Lore: players draft their leader and lore (rule 11.1).
    Drafting = 'Drafting',
    // Hands are dealt once the draft is done, which is a reveal.
    Dealing = 'Dealing',
    // The Archivist draws 5 lore after setup and keeps 2.
    Archiving = 'Archiving',
    // Two players: after each deal, the player without initiative may redraw (rule 6.2.4.1).
    Mulligan = 'Mulligan',
    // The active player leads, passes the initiative, or follows the lead card.
    PlayingCard = 'PlayingCard',
    // The active player spends their Prelude and pips.
    TakingActions = 'TakingActions',
    // The active player resolves a battle they started: hits, Ransacks, then raiding.
    Battling = 'Battling',
    // The declarer of an ambition resolves what it set off: Generous, Connected, Ambitious, Bold,
    // Farseers.
    Declaring = 'Declaring',
    // The chapter is over: scoring, clean-up and a new deal, all in one System Action.
    EndingChapter = 'EndingChapter',
    EndOfGame = 'EndOfGame'
}
