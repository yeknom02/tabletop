import type { Resource, ShipsMoving, StandardAction, SystemId } from '@tabletop/arcs'
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

// Ships moving, and those left behind in the systems passed through on the way.
export type ShipsChoice = { fresh: number; damaged: number; dropOffs: ShipsMoving[] }

// Where a board choice was made, so its follow-up popup can open beside it.
export type BoardTarget = { system: SystemId; slot?: number }

export type ArcsSelectionValues = {
    handCard: string
    intent: Intent
    origin: SystemId
    path: SystemId[]
    // Sprinter Drives: the move made first, then where the second move starts and goes.
    firstMove: ShipsChoice
    sprintOrigin: SystemId
    sprintPath: SystemId[]
    target: BoardTarget
    courtCard: string
    // Guide: the systems ships move between, before choosing which ships.
    guide: { system: SystemId; to: SystemId }
    // An ability choice that needs a discard to fit, showing its discards.
    makingRoom: string
}

export type ArcsSelection = StagedSelectionState<ArcsSelectionValues>

export const ArcsStageOrder = [
    'handCard',
    'intent',
    'origin',
    'path',
    'firstMove',
    'sprintOrigin',
    'sprintPath',
    'target',
    'courtCard',
    'guide',
    'makingRoom'
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

export function chooseFirstMove(selection: ArcsSelection, move: ShipsChoice): ArcsSelection {
    return setArcsSelection(selection, 'firstMove', move)
}

export function chooseSprintOrigin(selection: ArcsSelection, system: SystemId): ArcsSelection {
    return setArcsSelection(selection, 'sprintOrigin', system)
}

export function chooseSprintPath(selection: ArcsSelection, path: SystemId[]): ArcsSelection {
    return setArcsSelection(selection, 'sprintPath', path)
}

export function chooseTarget(selection: ArcsSelection, target: BoardTarget): ArcsSelection {
    return setArcsSelection(selection, 'target', target)
}

export function chooseCourtCard(selection: ArcsSelection, cardId: string): ArcsSelection {
    return setArcsSelection(selection, 'courtCard', cardId)
}

export function chooseGuide(
    selection: ArcsSelection,
    guide: ArcsSelectionValues['guide']
): ArcsSelection {
    return setArcsSelection(selection, 'guide', guide)
}

export function chooseMakingRoom(selection: ArcsSelection, choice: string): ArcsSelection {
    return setArcsSelection(selection, 'makingRoom', choice)
}

export function hasManualArcsSelection(selection: ArcsSelection): boolean {
    return hasManualStagedSelection<ArcsSelectionValues>(selection, ArcsStageOrder)
}

export function popArcsSelection(selection: ArcsSelection): ArcsSelection {
    return popHighestManualStagedSelection<ArcsSelectionValues>(selection, ArcsStageOrder).nextState
}
