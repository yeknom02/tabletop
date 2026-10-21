import { Resource } from './resources.js'

// The base game's Court (BC01–31), lore (L01–28) and leaders (LEAD01–16), from the Buried Giant card
// database, current printing, with its errata applied. L15–28 and LEAD09–16 are the Leaders & Lore pack.

export type CourtCardKind = 'guild' | 'vox'

export type CourtCardData = {
    id: string
    name: string
    kind: CourtCardKind
    suit?: Resource
    raidCost?: number
    text: string
}

export type PersonaCardData = {
    id: string
    name: string
    pack: boolean
    text: string
}

export const CourtCards: readonly CourtCardData[] = [
    {
        id: 'BC01',
        name: 'Loyal Engineers',
        kind: 'guild',
        suit: Resource.Material,
        raidCost: 3,
        text: 'If you **Provoke Outrage**, keep this card.\nYou may spend any resources as Material. You ignore Outrage when spending Material for its Prelude action.'
    },
    {
        id: 'BC02',
        name: 'Mining Interest',
        kind: 'guild',
        suit: Resource.Material,
        raidCost: 2,
        text: '**Manufacture (Build):** Gain 1 Material.\n**Prelude:** You may discard this to gain Material up to your number of empty resource slots. If the Material supply empties, steal the Material instead.'
    },
    {
        id: 'BC03',
        name: 'Material Cartel',
        kind: 'guild',
        suit: Resource.Material,
        raidCost: 2,
        text: "You keep the Material supply on here. *(You add it to Tycoon but can't spend it.)*\nAfter **scoring**, Rivals discard all Material. **Prelude:** You may discard this to steal 1 Material."
    },
    {
        id: 'BC04',
        name: 'Admin Union',
        kind: 'guild',
        suit: Resource.Material,
        raidCost: 2,
        text: '**Prelude:** You may place this card next to a face-up played Administration card. When the round ends, draw that card into your hand and discard this card.'
    },
    {
        id: 'BC05',
        name: 'Construction Union',
        kind: 'guild',
        suit: Resource.Material,
        raidCost: 2,
        text: '**Prelude:** You may place this card next to a face-up played Construction card. When the round ends, draw that card into your hand and discard this card.'
    },
    {
        id: 'BC06',
        name: 'Fuel Cartel',
        kind: 'guild',
        suit: Resource.Fuel,
        raidCost: 2,
        text: "You keep the Fuel supply on here. *(You add it to Tycoon but can't spend it.)*\nAfter **scoring**, Rivals discard all Fuel.\n**Prelude:** You may discard this to steal 1 Fuel."
    },
    {
        id: 'BC07',
        name: 'Loyal Pilots',
        kind: 'guild',
        suit: Resource.Fuel,
        raidCost: 3,
        text: 'If you **Provoke Outrage**, keep this card.\nYou may spend any resources as Fuel. You ignore Outrage when spending Fuel for its Prelude action.'
    },
    {
        id: 'BC08',
        name: 'Gatekeepers',
        kind: 'guild',
        suit: Resource.Fuel,
        raidCost: 2,
        text: 'When you **battle** in a gate, you may collect 2 more dice.\n**Prelude:** You may discard this to place 1 ship in each gate *(unless out of play)*.'
    },
    {
        id: 'BC09',
        name: 'Shipping Interest',
        kind: 'guild',
        suit: Resource.Fuel,
        raidCost: 2,
        text: '**Synthesize (Build):** Gain 1 Fuel.\n**Prelude:** You may discard this to gain Fuel up to your number of empty resource slots. If the Fuel supply empties, steal the Fuel instead.'
    },
    {
        id: 'BC10',
        name: 'Spacing Union',
        kind: 'guild',
        suit: Resource.Fuel,
        raidCost: 2,
        text: '**Prelude:** You may place this card next to a face-up played Mobilization card. When the round ends, draw that card into your hand and discard this card.'
    },
    {
        id: 'BC11',
        name: 'Arms Union',
        kind: 'guild',
        suit: Resource.Weapon,
        raidCost: 2,
        text: '**Prelude:** You may place this card next to a face-up played Aggression card. When the round ends, draw that card into your hand and discard this card.'
    },
    {
        id: 'BC12',
        name: 'Prison Wardens',
        kind: 'guild',
        suit: Resource.Weapon,
        raidCost: 2,
        text: '**Pressgang (Build):** Return any number of your Captives to gain any 1 resource for each.\n**Execute (Influence):** Move any number of your Captives to your Trophies.\n**Prelude:** You may discard this to place 3 ships in a system you control.'
    },
    {
        id: 'BC13',
        name: 'Skirmishers',
        kind: 'guild',
        suit: Resource.Weapon,
        raidCost: 2,
        text: 'After you roll in **battle**, you may reroll a number of skirmish dice up to your total Weapon icons from resources and cards.\n**Prelude:** You may discard this to place 3 ships in a system you control.'
    },
    {
        id: 'BC14',
        name: 'Court Enforcers',
        kind: 'guild',
        suit: Resource.Weapon,
        raidCost: 2,
        text: '**Abduct (Battle):** Capture all Rival agents from a card in the Court that has fewer Rival agents than your total Weapon icons from resources and cards.\n**Prelude:** You may discard this to place 3 ships in a system you control.'
    },
    {
        id: 'BC15',
        name: 'Loyal Marines',
        kind: 'guild',
        suit: Resource.Weapon,
        raidCost: 3,
        text: 'If you **Provoke Outrage**, keep this card.\nYou may spend any resources as Weapons. You ignore Outrage when spending Weapons for their Prelude action.\n**Prelude:** You may discard this to place 3 ships in a system you control.'
    },
    {
        id: 'BC16',
        name: 'Lattice Spies',
        kind: 'guild',
        suit: Resource.Psionic,
        raidCost: 2,
        text: "**Prelude:** Before any other actions, you may discard this to seize the initiative.\n*You can't seize the initiative if you have it or if it's already seized this round!*"
    },
    {
        id: 'BC17',
        name: 'Farseers',
        kind: 'guild',
        suit: Resource.Psionic,
        raidCost: 2,
        text: 'When you **declare an ambition**, look at a Rival’s hand. You may swap 1 card with them.\nPrelude: You may discard this and any number of cards from your hand. Draw the same number of cards *(including Farseers)* from the bottom of the action discard pile.'
    },
    {
        id: 'BC18',
        name: 'Secret Order',
        kind: 'guild',
        suit: Resource.Psionic,
        raidCost: 2,
        text: 'When you **declare** Keeper or Empath, do not place the zero marker.'
    },
    {
        id: 'BC19',
        name: 'Loyal Empaths',
        kind: 'guild',
        suit: Resource.Psionic,
        raidCost: 3,
        text: 'If you **Provoke Outrage**, keep this card.\nYou may spend any resources as Psionic. You ignore Outrage when spending Psionic for its Prelude action.'
    },
    {
        id: 'BC20',
        name: 'Silver-Tongues',
        kind: 'guild',
        suit: Resource.Psionic,
        raidCost: 2,
        text: '**Prelude:** You may discard this to steal a Guild card or resource.'
    },
    {
        id: 'BC21',
        name: 'Loyal Keepers',
        kind: 'guild',
        suit: Resource.Relic,
        raidCost: 3,
        text: 'If you **Provoke Outrage**, keep this card.\nYou may spend any resources as Relics. You ignore Outrage when spending Relics for their Prelude action.'
    },
    {
        id: 'BC22',
        name: 'Sworn Guardians',
        kind: 'guild',
        suit: Resource.Relic,
        raidCost: 1,
        text: 'Rivals cannot steal your resources and other Guild cards. *(In battle they can steal this first and then spend `symbol:key`.)*\nIf this card is stolen, bury it. *(Place it on the bottom of the Court deck.)*'
    },
    {
        id: 'BC23',
        name: 'Elder Broker',
        kind: 'guild',
        suit: Resource.Relic,
        raidCost: 2,
        text: "**Trade (Tax):** Choose a Rival city you control. Swap 1 resource with that Rival—take a resource of that city type from them, and give them a resource they don't have.\n**Prelude:** You may discard this to gain 1 Material, 1 Fuel, and 1 Weapon."
    },
    {
        id: 'BC24',
        name: 'Relic Fence',
        kind: 'guild',
        suit: Resource.Relic,
        raidCost: 2,
        text: '**Prelude:** Once per turn, you may discard 1 resource to gain 1 Relic.'
    },
    {
        id: 'BC25',
        name: 'Galactic Bards',
        kind: 'guild',
        suit: Resource.Relic,
        raidCost: 1,
        text: 'When you **Surpass** or **Pivot**, before taking ***any*** actions, you may declare the ambition on your played card if an ambition has not been declared yet this round. Do not place the zero marker.'
    },
    {
        id: 'BC26',
        name: 'Mass Uprising',
        kind: 'vox',
        text: '**When Secured:** Choose a cluster on the map. You place 1 ship in each system of that cluster. Discard this card.'
    },
    {
        id: 'BC27',
        name: 'Populist Demands',
        kind: 'vox',
        text: "**When Secured:** You may declare any ambition. *(An ambition marker must be Available.)* Don't place the zero marker. Discard this card."
    },
    {
        id: 'BC28',
        name: 'Outrage Spreads',
        kind: 'vox',
        text: '**When Secured:** You may choose an Outrage type. Each player *(even you)* must Provoke Outrage of that type. Discard this card.'
    },
    {
        id: 'BC29',
        name: 'Song of Freedom',
        kind: 'vox',
        text: "**When Secured:** You may return ***any*** one city you control to its player board. If you do, you may seize the initiative. Shuffle this card into the Court deck.\n*You can't seize the initiative if you have it or if it's already seized this round!*"
    },
    {
        id: 'BC30',
        name: 'Guild Struggle',
        kind: 'vox',
        text: '**When Secured:** You may steal 1 Guild card from a Rival. Shuffle all Guild cards from the Court discard pile into the Court deck. Discard Guild Struggle.'
    },
    {
        id: 'BC31',
        name: 'Call to Action',
        kind: 'vox',
        text: '**When Secured:** Draw 1 action card from the bottom of the action discard pile. Discard Call to Action.'
    }
]

export const LoreCards: readonly PersonaCardData[] = [
    {
        id: 'L01',
        name: 'Tool-Priests',
        pack: false,
        text: '**Summon (Build):** Once per turn, build 1 ship at ***any*** city you control.\n*Yes, even Rival cities you control!*'
    },
    {
        id: 'L02',
        name: 'Galactic Rifles',
        pack: false,
        text: '**Fire Rifles (Battle):** Like in a battle, choose a system and collect **skirmish** dice for fresh Loyal ships there, choose a defender in an adjacent system, roll the collected dice, and deal 1 hit to the defender per `symbol:hit` rolled. \n*(Hit ships before buildings.)*'
    },
    {
        id: 'L03',
        name: 'Sprinter Drives',
        pack: false,
        text: "When you **move** fresh Loyal ships, you may move any of them one more time. *(Damaged ships can move with them once, but won't move one more time. Resolve this after all Catapult moves.)*"
    },
    {
        id: 'L04',
        name: 'Mirror Plating',
        pack: false,
        text: 'When you defend in **battle**, add 1 `symbol:intercept` to the attacker’s roll if they rolled any number of assault dice.'
    },
    {
        id: 'L05',
        name: 'Hidden Harbors',
        pack: false,
        text: 'You always **build** ships fresh.\nWhen defending in **battle**, the attacker cannot collect raid dice if you have a fresh defending starport.'
    },
    {
        id: 'L06',
        name: 'Signal Breaker',
        pack: false,
        text: 'When attacking in **battle**, if all attacking ships are fresh at the start of the battle, you ignore 1 `symbol:intercept` you roll.'
    },
    {
        id: 'L07',
        name: 'Repair Drones',
        pack: false,
        text: 'After you **battle** as the attacker, repair 1 Loyal attacking ship.'
    },
    {
        id: 'L08',
        name: 'Gate Ports',
        pack: false,
        text: 'You may **build** starports on gates, max 1 per gate.\nWhen Rival ships take a **move** into a gate you control with a fresh Loyal starport, capture 1 agent of that Rival.'
    },
    {
        id: 'L09',
        name: 'Cloud Cities',
        pack: false,
        text: 'You may **build** cities on planets outside their building slots, max 1 per planet.\nThis costs 1 resource of the planet type.'
    },
    {
        id: 'L10',
        name: 'Living Structures',
        pack: false,
        text: '**Nurture (Build):** Tax a Loyal city.\n**Prune (Repair):** Replace a Loyal starport in a slot with a Loyal city or vice versa.'
    },
    {
        id: 'L11',
        name: 'Gate Stations',
        pack: false,
        text: "You may **build** cities on gates, max 1 per gate.\nA gate city's type matches all cities in its cluster. *(Players may tax it for 1 resource of any of those cities. If it is destroyed, Provoke Outrage of all those city types.)*"
    },
    {
        id: 'L12',
        name: 'Railgun Arrays',
        pack: false,
        text: 'When defending in **battle**, before the attacker collects dice, they must take 1 hit if any Loyal defending ships are fresh.'
    },
    {
        id: 'L13',
        name: 'Ancient Holdings',
        pack: false,
        text: 'This card has one resource slot with a raid cost of `symbol:key` `symbol:key` `symbol:key` `symbol:key`.\n*(You can hold one resource here. It adds to your ambitions. You can spend it.)*'
    },
    {
        id: 'L14',
        name: 'Seeker Torpedoes',
        pack: false,
        text: 'When attacking in **battle**, after rolling dice, you may reroll up to 1 assault die for each fresh Loyal attacking ship.'
    },
    {
        id: 'L15',
        name: 'Predictive Sensors',
        pack: true,
        text: 'When defending in **battle**, before the attacker collects dice, you may move any number of fresh Loyal ships from systems adjacent to the battle system into it.'
    },
    {
        id: 'L16',
        name: 'Force Beams',
        pack: true,
        text: '**Guide (Move):** Move any number of ***any*** ships *(even if not Loyal)* from a system with a fresh Loyal starport to an adjacent system, or vice versa, ignoring **move** modifiers in play areas.'
    },
    {
        id: 'L17',
        name: 'Raider Exosuits',
        pack: true,
        text: 'When attacking in **battle**, if there are no defending buildings, you may collect up to 1 raid die. *(This is not an extra die. Follow the limit of 1 die per ship.)*'
    },
    {
        id: 'L18',
        name: 'Survival Overrides',
        pack: true,
        text: '**Martyr (Move):** Destroy 1 fresh Loyal ship on the map to destroy 1 ship that is not Loyal in its system, taking it as a Trophy. *(Your Loyal ship does not become a Trophy.)*'
    },
    {
        id: 'L19',
        name: "Empath's Vision",
        pack: true,
        text: '***While Empath is declared***, if you roll ***any*** dice *(even outside battle)*, you may reroll any number of them once.\n  \n**Prelude:** You may discard this to clear your Psionic Outrage.'
    },
    {
        id: 'L20',
        name: "Empath's Bond",
        pack: true,
        text: "***While Empath is declared***, you may **tax** ***any*** cities, and **build** ships and Catapult **move** with ***any*** starports, like they are Loyal. *(Don't take Captives. Build ships damaged in systems controlled by anyone else.)*"
    },
    {
        id: 'L21',
        name: "Keeper's Trust",
        pack: true,
        text: '***While Keeper is declared***, Rivals cannot steal resources from you that are the same as resources they have already.\n**Prelude:** You may discard this to clear your Relic Outrage.'
    },
    {
        id: 'L22',
        name: "Keeper's Solidarity",
        pack: true,
        text: '***While Keeper is declared***, Rivals cannot steal Guild cards from you while you have any resources of the same type. *(If you have both Relics and Sworn Guardians, neither can be stolen!)*'
    },
    {
        id: 'L23',
        name: "Warlord's Cruelty",
        pack: true,
        text: '***While Warlord is declared***, you may **tax** cities that you already taxed this turn.\n**Prelude:** You may discard this to clear your Weapon Outrage.'
    },
    {
        id: 'L24',
        name: "Warlord's Terror",
        pack: true,
        text: '***While Warlord is declared***, you may spend Trophies in your Prelude, returning them, to influence once for each.'
    },
    {
        id: 'L25',
        name: "Tyrant's Ego",
        pack: true,
        text: '***While Tyrant is declared***, you may spend Captives in your Prelude, returning them, to secure once for each.\n**Prelude:** You may discard this to clear your Weapon Outrage.'
    },
    {
        id: 'L26',
        name: "Tyrant's Authority",
        pack: true,
        text: '**Annex (Build):** ***While Tyrant is declared***, replace ***any*** city or starport you control with a Loyal city or starport, respectively. *(Cities return to player boards.)*'
    },
    {
        id: 'L27',
        name: "Tycoon's Ambition",
        pack: true,
        text: '**Prelude:** ***While Tycoon is declared***, before taking any other actions, you may discard all of your Material and Fuel to declare exactly 1 undeclared ambition. Do not place the zero marker. *(You may do this just after declaring Tycoon.)*'
    },
    {
        id: 'L28',
        name: "Tycoon's Charm",
        pack: true,
        text: '**Prelude:** ***While Tycoon is declared***, you may discard any number of Material and Fuel to gain 1 resource for each.\n**Prelude:** You may discard this to clear your Material and Fuel Outrage.'
    }
]

export const LeaderCards: readonly PersonaCardData[] = [
    {
        id: 'LEAD01',
        name: 'Elder',
        pack: false,
        text: "*Beloved*. After defending in **battle**, you may influence if the attacker took any Trophies. Rivals cannot Ransack the Court when they **battle** you.\n*Just*. When you're **scoring** Tyrant, gain no Power for second place, and gain Power for second place if you get first place. *(Don't get bonus city Power.)*"
    },
    {
        id: 'LEAD02',
        name: 'Mystic',
        pack: false,
        text: '*Attuned*. When you Copy or Pivot in order to **tax**, you gain 1 Psionic along with the taxed resource.\n*Cryptic*. In **setup**, place agents on your Material and Fuel Outrage slots on your player board.'
    },
    {
        id: 'LEAD03',
        name: 'Fuel-Drinker',
        pack: false,
        text: '*Insatiable*. When you Copy or Pivot in order to **tax**, you gain 1 Fuel along with the taxed resource.\n*Lavish*. After **scoring**, you must discard all of your Fuel if the Tycoon ambition was scored.'
    },
    {
        id: 'LEAD04',
        name: 'Upstart',
        pack: false,
        text: '*Ambitious*. When you **declare an ambition**, you may gain any resource. *(You must declare the ambition before taking any actions, including Prelude actions from resources.)*\n*Callow*. You cannot **tax** cities that you do not control.'
    },
    {
        id: 'LEAD05',
        name: 'Rebel',
        pack: false,
        text: '*Committed*. In **battle**, you collect 2 extra dice.\n*Disorganized*. You cannot **move** more than 2 ships at a time.'
    },
    {
        id: 'LEAD06',
        name: 'Warrior',
        pack: false,
        text: "*Tactical*. When you Copy or Pivot to **battle**, you may move before or after you battle. *(You may do this even if you spent a Weapon to let you battle.)*\n*Violent*. When you're **scoring** Empath, gain no Power for second place, and gain Power for second place if you get first place. *(Don't get bonus city Power.)*"
    },
    {
        id: 'LEAD07',
        name: 'Feastbringer',
        pack: false,
        text: '*Charismatic*. When you Copy or Pivot in order to **secure** a card, you may influence before or after you secure.\n*Generous*. To **declare an ambition**, you must give 1 Guild card to your Rival with the least Power.'
    },
    {
        id: 'LEAD08',
        name: 'Demagogue',
        pack: false,
        text: '*Bold*. When you **declare an ambition**, you may influence any number of cards in the Court once.\n*Paranoid*. You cannot **secure** Guild cards with only 1 Loyal agent on them. *(You can secure Vox cards as normal.)* Ignore this if you Ransack the Court.'
    },
    {
        id: 'LEAD09',
        name: 'Archivist',
        pack: true,
        text: "*Learned*. After **setup**, gain 2 extra lore cards—draw 5 lore, keep 2, and scrap the other 3 *(returning them to the box).*\n*Academic*. When you're **scoring** Tycoon, gain no Power for second place, and gain Power for second place if you get first place. *(Don't get bonus city Power.)*"
    },
    {
        id: 'LEAD10',
        name: 'Overseer',
        pack: true,
        text: '*Ruthless*. Once per turn, when you **tax** any city or **build** a ship at a starport, you may hit the building to take that action again with it. If you destroy a Loyal city, you Provoke Outrage. *(If you destroy a Rival city, Provoke Outrage and Ransack the Court.)*\n*Hated*. In **setup**, scrap 2 Loyal ships and 3 Loyal agents. *(Return them to the box.)*'
    },
    {
        id: 'LEAD11',
        name: 'Corsair',
        pack: true,
        text: '*Tricky*. When attacking in **battle**, you may reroll raid dice up to the number of different resources you have.\n*Wary*. When attacking in **battle**, you cannot collect more assault dice than skirmish dice.'
    },
    {
        id: 'LEAD12',
        name: 'Noble',
        pack: true,
        text: "*Connected*. When you **declare an ambition** that's not declared, draw and secure the top card of the Court deck. *(You can't use its Prelude action now.)*\n*Influential*. When you Copy or Pivot to **influence**, you may influence twice.\n*Proud*. When **scoring**, you only gain Power if you get first place *(not tied).*"
    },
    {
        id: 'LEAD13',
        name: 'Anarchist',
        pack: true,
        text: '*Decentralized*. In **setup**, scrap your 2 leftmost cities from your player board.\n*Inspiring*. In systems with Loyal ships, you may **tax** Rival cities ignoring control, and you may tax empty building slots like Loyal cities.\n*Principled*. You cannot **tax** Loyal cities.\n*Remember, if you have no buildings on the map, Rivals can raid your ships!*'
    },
    {
        id: 'LEAD14',
        name: 'Shaper',
        pack: true,
        text: "*Mythic*. After you **tax** a city, you may place 1 resource you have over the planet's resource icon. From now on, its planet type is the placed resource, and its planet type cannot be changed again with *Mythic*.\n*Ancient*. You cannot Catapult **move** from starports, but you can Catapult **move** from gates."
    },
    {
        id: 'LEAD15',
        name: 'Agitator',
        pack: true,
        text: '*Firebrand*. When you Copy or Pivot in order to **tax**, you gain 1 Weapon along with the taxed resource.\n*Irregular*. If a Rival attacking you in **battle** is intercepted, they ***do not*** take hits from fresh defending ships. Instead, they take 1 hit per Weapon icon you have from cards and resources, then you discard 1 Weapon resource you have.'
    },
    {
        id: 'LEAD16',
        name: 'Quartermaster',
        pack: true,
        text: '*Resilient*. After any **battle** with you, repair 1 Loyal ship in the battle system per starport on the map you control. *(Even Rival ones!)*\n*Greedy*. In **setup**, place an agent on your Material Outrage slot.'
    }
]
