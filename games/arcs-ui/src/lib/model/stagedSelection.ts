import type { Resource, StandardAction, SystemId } from '@tabletop/arcs'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// How an action is paid for: a pip, a resource (`via`, perhaps with a stand-in `token`), or a
// leader's extra action.
export type Payment = { via?: Resource; token?: Resource; bonus?: boolean }

export type Intent = { action: StandardAction; payment: Payment }

// Where a board choice was made, so its follow-up popup can open beside it.
export type BoardTarget = { system: SystemId; slot?: number }

export type ArcsSelectionValues = {
    handCard: string
    intent: Intent
    origin: SystemId
    path: SystemId[]
    target: BoardTarget
    courtCard: string
}

export type ArcsSelection = StagedSelectionState<ArcsSelectionValues>

export const ArcsStageOrder = [
    'handCard',
    'intent',
    'origin',
    'path',
    'target',
    'courtCard'
] as const satisfies readonly (keyof ArcsSelectionValues)[]
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

export function chooseIntent(selection: ArcsSelection, intent: Intent): ArcsSelection {
    return setArcsSelection(selection, 'intent', intent)
}

export function chooseOrigin(selection: ArcsSelection, system: SystemId): ArcsSelection {
    return setArcsSelection(selection, 'origin', system)
}

export function choosePath(selection: ArcsSelection, path: SystemId[]): ArcsSelection {
    return setArcsSelection(selection, 'path', path)
}

export function chooseTarget(selection: ArcsSelection, target: BoardTarget): ArcsSelection {
    return setArcsSelection(selection, 'target', target)
}

export function chooseCourtCard(selection: ArcsSelection, cardId: string): ArcsSelection {
    return setArcsSelection(selection, 'courtCard', cardId)
}

export function hasManualArcsSelection(selection: ArcsSelection): boolean {
    return hasManualStagedSelection<ArcsSelectionValues>(selection, ArcsStageOrder)
}

export function popArcsSelection(selection: ArcsSelection): ArcsSelection {
    return popHighestManualStagedSelection<ArcsSelectionValues>(selection, ArcsStageOrder).nextState
}
