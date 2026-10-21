import { Resource } from './resources.js'

// Court cards whose rules the game applies, by name.
export enum Court {
    LoyalEngineers = 'BC01',
    MiningInterest = 'BC02',
    MaterialCartel = 'BC03',
    AdminUnion = 'BC04',
    ConstructionUnion = 'BC05',
    FuelCartel = 'BC06',
    LoyalPilots = 'BC07',
    Gatekeepers = 'BC08',
    ShippingInterest = 'BC09',
    SpacingUnion = 'BC10',
    ArmsUnion = 'BC11',
    PrisonWardens = 'BC12',
    Skirmishers = 'BC13',
    CourtEnforcers = 'BC14',
    LoyalMarines = 'BC15',
    LatticeSpies = 'BC16',
    Farseers = 'BC17',
    SecretOrder = 'BC18',
    LoyalEmpaths = 'BC19',
    SilverTongues = 'BC20',
    LoyalKeepers = 'BC21',
    SwornGuardians = 'BC22',
    ElderBroker = 'BC23',
    RelicFence = 'BC24',
    GalacticBards = 'BC25',
    MassUprising = 'BC26',
    PopulistDemands = 'BC27',
    OutrageSpreads = 'BC28',
    SongOfFreedom = 'BC29',
    GuildStruggle = 'BC30',
    CallToAction = 'BC31'
}

// Each Loyal card lets its holder spend any resource as its own, ignores Outrage of it, and is kept
// when its holder Provokes Outrage.
export const LoyalCards: Readonly<Record<Resource, Court>> = {
    [Resource.Material]: Court.LoyalEngineers,
    [Resource.Fuel]: Court.LoyalPilots,
    [Resource.Weapon]: Court.LoyalMarines,
    [Resource.Relic]: Court.LoyalKeepers,
    [Resource.Psionic]: Court.LoyalEmpaths
}

// A Cartel holds its resource's whole supply.
export const Cartels: Readonly<Partial<Record<Resource, Court>>> = {
    [Resource.Material]: Court.MaterialCartel,
    [Resource.Fuel]: Court.FuelCartel
}
