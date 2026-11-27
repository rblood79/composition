/**
 * ADR-321 G2 — the comparison only: the installed react-stately · react-aria private steplist hooks
 * (v3 `@react-spectrum/steplist` is built on them), drawn as v3 draws its list (`ol > li > a`).
 * Product code never imports these (HC2 — `adr321D1Assembly.static.test.ts`); the tests read what
 * the hooks give and set it beside the product's state rule and DOM.
 */
import { useRef } from "react";
import { Item } from "react-stately";
// @ts-expect-error — a private path without types: read as the reference, by file path.
import { useStepListItem } from "../../../../../node_modules/react-aria/dist/private/steplist/useStepListItem.mjs";
// @ts-expect-error — a private path without types: read as the reference, by file path.
import { useStepListState } from "../../../../../node_modules/react-stately/dist/private/steplist/useStepListState.mjs";

export interface V3StepListInput {
  keys: readonly string[];
  selectedKey?: string | null;
  lastCompletedStep?: string | null;
  disabledKeys?: readonly string[];
  isDisabled?: boolean;
  isReadOnly?: boolean;
}

/** The hook's state object as the test reads it. */
export interface V3StepListState {
  selectedKey: string | null;
  isCompleted: (key: string) => boolean;
  isSelectable: (key: string) => boolean;
  setSelectedKey: (key: string) => void;
  setLastCompletedStep: (key: string) => void;
}

function V3Step(props: { itemKey: string; state: unknown }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { stepProps } = useStepListItem(
    { key: props.itemKey },
    props.state,
    ref,
  );
  return (
    <li>
      <a {...stepProps} ref={ref} data-step={props.itemKey}>
        {props.itemKey}
      </a>
    </li>
  );
}

/** v3's list over the hook's state (uncontrolled — the keys are its start values). */
export function V3StepList(props: {
  input: V3StepListInput;
  onState: (state: V3StepListState) => void;
}) {
  const { input } = props;
  const state = useStepListState({
    children: input.keys.map((key) => <Item key={key}>{key}</Item>),
    defaultSelectedKey: input.selectedKey ?? undefined,
    defaultLastCompletedStep: input.lastCompletedStep ?? undefined,
    disabledKeys: input.disabledKeys,
    isDisabled: input.isDisabled,
    isReadOnly: input.isReadOnly,
  });
  props.onState(state as V3StepListState);
  return (
    <ol data-v3-list="">
      {input.keys.map((key) => (
        <V3Step key={key} itemKey={key} state={state} />
      ))}
    </ol>
  );
}
