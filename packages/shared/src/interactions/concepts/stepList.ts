import type { InteractionConcept } from "./types";

/**
 * ADR-321 Phase 2 — a StepList's two states. Neither RAC nor S2 has a StepList (ADR-321 F1); the
 * names are v3's (`@react-spectrum/steplist` — `SpectrumStepListProps`: 사용자 결정 1), mirrored here as
 * S2 SideNavPanel's are (`collapse.ts`). The state rule is `catalog/runtime/stepListState.ts`.
 */
export interface StepListStateProps {
  selectedKey?: string | null;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  lastCompletedStep?: string | null;
  defaultLastCompletedStep?: string;
  onLastCompletedStepChange?: (key: string | null) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  disabledKeys?: Iterable<string>;
}

/**
 * The current step (`selectedKey`). When 「단계 변경」 = the user's press of a step (a Do's write does
 * not call it, as RAC calls a change callback for the user's change only). The Dos move as the app
 * does in v3 (`state.setSelectedKey`): a disabled list · step refuses them, a read-only list does not
 * — `isReadOnly` stops the press only.
 */
export const stepSelection = {
  id: "stepSelection",
  racDoc: "ADR-321 — StepList current step (v3 @react-spectrum/steplist names)",
  racType: "StepListStateProps",
  events: ["onSelectionChange"],
  args: { onSelectionChange: ["key"] },
  state: {
    prop: "selectedKey",
    defaultProp: "defaultSelectedKey",
    callback: "onSelectionChange",
    valueType: "key",
  },
  conditions: ["isDisabled", "disabledKeys"],
  capabilities: {
    nextStep: { labelKey: "capabilities.nextStep", value: null, step: "next" },
    previousStep: {
      labelKey: "capabilities.previousStep",
      value: null,
      step: "previous",
    },
    goToStep: {
      labelKey: "capabilities.goToStep",
      value: "!param",
      param: { kind: "itemKey", labelKey: "capabilities.paramStepKey" },
      step: "to",
    },
  },
} as const satisfies InteractionConcept;

/**
 * How far the steps are done (`lastCompletedStep`). When 「완료 단계 변경」 = a press that passes steps
 * (free navigation). Do 「단계 완료」 completes the current step (v3 `state.setLastCompletedStep`).
 */
export const stepCompletion = {
  id: "stepCompletion",
  racDoc:
    "ADR-321 — StepList last completed step (v3 @react-spectrum/steplist names)",
  racType: "StepListStateProps",
  events: ["onLastCompletedStepChange"],
  args: { onLastCompletedStepChange: ["key"] },
  state: {
    prop: "lastCompletedStep",
    defaultProp: "defaultLastCompletedStep",
    callback: "onLastCompletedStepChange",
    valueType: "key",
  },
  conditions: ["isDisabled", "disabledKeys"],
  capabilities: {
    completeStep: {
      labelKey: "capabilities.completeStep",
      value: null,
      step: "complete",
    },
  },
} as const satisfies InteractionConcept;
