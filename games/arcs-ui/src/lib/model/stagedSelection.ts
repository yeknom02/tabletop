import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type ArcsSelectionValues = {
    handCard: string
}

export type ArcsSelection = StagedSelectionState<ArcsSelectionValues>

export const ArcsStageOrder = ['handCard'] as const satisfies readonly (keyof ArcsSelectionValues)[]
type MissingStages = Exclude<keyof ArcsSelectionValues, (typeof ArcsStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

function setArcsSelection<TStage extends keyof ArcsSelectionValues>(
    selection: ArcsSelection,
    stage: TStage,
    value: ArcsSelectionValues[TStage]
): ArcsSelection {
    return setStagedSelectionValue<ArcsSelectionValues, TStage>(
        selection,
        ArcsStageOrder,
        stage,
        value,
        'manual'
    )
}

export function chooseHandCard(selection: ArcsSelection, cardId: string): ArcsSelection {
    return setArcsSelection(selection, 'handCard', cardId)
}

export function hasManualArcsSelection(selection: ArcsSelection): boolean {
    return hasManualStagedSelection<ArcsSelectionValues>(selection, ArcsStageOrder)
}

export function popArcsSelection(selection: ArcsSelection): ArcsSelection {
    return popHighestManualStagedSelection<ArcsSelectionValues>(selection, ArcsStageOrder).nextState
}
