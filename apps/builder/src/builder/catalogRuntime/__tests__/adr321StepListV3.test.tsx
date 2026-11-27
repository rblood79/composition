import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  catalogStepListDo,
  catalogStepListStates,
  type StepListStateInput,
} from "../../../../../../packages/shared/src/catalog/runtime/stepListState";
import {
  V3StepList,
  type V3StepListInput,
  type V3StepListState,
} from "./support/adr321V3StepList";

/**
 * ADR-321 G2 — the state rule (linear) against v3's own state hook (the installed
 * `react-stately/dist/private/steplist/useStepListState.mjs`): the same current step, completed
 * steps and steps that can be gone to for every start value, and the same pair after a move. The
 * hook is the reference — the product reads none of it. Free navigation is not in v3
 * (`adr321StepListMoves.test.ts` holds its table).
 */

const KEYS = ["s1", "s2", "s3", "s4", "s5"];
const OPTIONAL = [undefined, ...KEYS];
const DISABLED: readonly (readonly string[])[] = [[], ["s2"], ["s1", "s4"]];
const FLAGS: readonly Pick<V3StepListInput, "isDisabled" | "isReadOnly">[] = [
  {},
  { isDisabled: true },
  { isReadOnly: true },
];

/** The hook's state after its effects (the default selection · the passed steps' completion). */
function v3(input: V3StepListInput) {
  let state!: V3StepListState;
  const view = render(
    <V3StepList input={input} onState={(next) => (state = next)} />,
  );
  const read = () => ({
    selectedKey: state.selectedKey,
    completed: input.keys.filter((key) => state.isCompleted(key)),
    selectable: input.keys.filter((key) => state.isSelectable(key)),
  });
  return { read, state: () => state, unmount: () => view.unmount() };
}

const ours = (input: StepListStateInput) => {
  const states = catalogStepListStates(input);
  return {
    selectedKey: states.selectedKey,
    completed: states.steps
      .filter((step) => step.completed)
      .map((step) => step.key),
    selectable: states.steps
      .filter((step) => step.selectable)
      .map((step) => step.key),
  };
};

describe("ADR-321 G2 — 상태 규칙 (선형) = v3 state hook", () => {
  it("모든 시작 값에서 지금 단계 · 완료 · 갈 수 있는 단계가 같다 (6 × 6 × 3 × 3)", () => {
    const differences: string[] = [];
    let compared = 0;
    for (const selectedKey of OPTIONAL)
      for (const lastCompletedStep of OPTIONAL)
        for (const disabledKeys of DISABLED)
          for (const flags of FLAGS) {
            const input = {
              keys: KEYS,
              selectedKey,
              lastCompletedStep,
              disabledKeys,
              ...flags,
            };
            const reference = v3(input);
            const want = reference.read();
            reference.unmount();
            compared += 1;
            if (JSON.stringify(ours(input)) !== JSON.stringify(want))
              differences.push(
                `${JSON.stringify(input)} — v3 ${JSON.stringify(want)} · ours ${JSON.stringify(ours(input))}`,
              );
          }
    expect(compared).toBe(324);
    expect(differences).toEqual([]);
  });

  it("단계로 이동 (`setSelectedKey`) 뒤의 쌍이 같다 — 비활성이 아닌 모든 단계로", () => {
    const differences: string[] = [];
    let compared = 0;
    for (const selectedKey of OPTIONAL)
      for (const lastCompletedStep of OPTIONAL)
        for (const disabledKeys of DISABLED)
          for (const key of KEYS) {
            // (v3's setter takes a disabled key too — the product refuses it, as its guard says.)
            if (disabledKeys.includes(key)) continue;
            const input = {
              keys: KEYS,
              selectedKey,
              lastCompletedStep,
              disabledKeys,
            };
            const reference = v3(input);
            act(() => reference.state().setSelectedKey(key));
            const want = reference.read();
            reference.unmount();
            const before = catalogStepListStates(input);
            const outcome = catalogStepListDo(input, "to", key);
            if (!outcome.ok) {
              differences.push(`${JSON.stringify(input)} → ${key}: refused`);
              continue;
            }
            const got = ours({
              ...input,
              selectedKey: before.selectedKey,
              lastCompletedStep: before.lastCompletedStep,
              ...outcome.patch,
            });
            compared += 1;
            if (JSON.stringify(got) !== JSON.stringify(want))
              differences.push(
                `${JSON.stringify(input)} → ${key} — v3 ${JSON.stringify(want)} · ours ${JSON.stringify(got)}`,
              );
          }
    expect(compared).toBeGreaterThan(400);
    expect(differences).toEqual([]);
  });

  it("단계 완료 (`setLastCompletedStep(지금 단계)`) 뒤의 쌍이 같다 — 지금 단계가 아직 완료가 아닐 때", () => {
    const differences: string[] = [];
    let compared = 0;
    for (const selectedKey of OPTIONAL)
      for (const lastCompletedStep of OPTIONAL) {
        const input = { keys: KEYS, selectedKey, lastCompletedStep };
        const before = catalogStepListStates(input);
        const current = KEYS.indexOf(before.selectedKey!);
        const last = before.lastCompletedStep
          ? KEYS.indexOf(before.lastCompletedStep)
          : -1;
        // (v3's setter lowers the completed step too; the product's Do never does.)
        if (current <= last) continue;
        const reference = v3(input);
        act(() =>
          reference
            .state()
            .setLastCompletedStep(reference.state().selectedKey!),
        );
        const want = reference.read();
        reference.unmount();
        const outcome = catalogStepListDo(input, "complete");
        const got = outcome.ok
          ? ours({
              ...input,
              selectedKey: before.selectedKey,
              lastCompletedStep: before.lastCompletedStep,
              ...outcome.patch,
            })
          : "refused";
        compared += 1;
        if (JSON.stringify(got) !== JSON.stringify(want))
          differences.push(
            `${JSON.stringify(input)} — v3 ${JSON.stringify(want)} · ours ${JSON.stringify(got)}`,
          );
      }
    expect(compared).toBeGreaterThan(10);
    expect(differences).toEqual([]);
  });
});
