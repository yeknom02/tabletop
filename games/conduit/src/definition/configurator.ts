import { BaseConfigurator, type GameConfigurator } from '@tabletop/common'
import { ConduitGameConfig, ConduitGameConfigOptions } from './gameConfig.js'

export class ConduitConfigurator extends BaseConfigurator implements GameConfigurator {
    schema = ConduitGameConfig
    options = ConduitGameConfigOptions
}
