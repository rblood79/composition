/**
 * ADR-321 G2 — a StepList's When 2 · Do 4 · named states 2 in the registry, and the Dos through the
 * dispatcher: the written pair comes from the state rule (`catalog/runtime/stepListState.ts`), read
 * from the target's current state. Expected values are written out by hand.
 */
import { describe, expect, it } from "vitest";
import { CAPABILITY_REGISTRY } from "../capabilityRegistry";
import { declaredRefusal } from "../constraints";
import { executeInteractionRule, type DispatchDeps } from "../dispatcher";
import type { InteractionAction } from "../interactionRule.types";
import { IMPLICIT_STATE_SOURCES } from "../../state/implicitState";

const list = CAPABILITY_REGISTRY.StepList!;

describe("ADR-321 — StepList 의 등록표", () => {
  it("When 2 — 「단계 변경」 · 「완료 단계 변경」, 인자 이름 `key`", () => {
    expect(list.events).toEqual([
      "onSelectionChange",
      "onLastCompletedStepChange",
    ]);
    expect(list.eventArgs).toEqual({
      onSelectionChange: ["key"],
      onLastCompletedStepChange: ["key"],
    });
    expect(list.groups?.map((group) => [group.id, group.events])).toEqual([
      ["stepSelection", ["onSelectionChange"]],
      ["stepCompletion", ["onLastCompletedStepChange"]],
    ]);
  });

  it("Do 4 — 다음 · 이전 · 단계로 이동 (key) · 단계 완료, 막는 것은 비활성 목록 · 비활성 단계", () => {
    const steps = Object.fromEntries(
      Object.entries(list.capabilities)
        .filter(([, def]) => def.step)
        .map(([name, def]) => [
          name,
          [def.step, def.prop, def.param?.kind ?? null, def.guards],
        ]),
    );
    expect(steps).toEqual({
      nextStep: ["next", "selectedKey", null, ["isDisabled", "disabledKeys"]],
      previousStep: [
        "previous",
        "selectedKey",
        null,
        ["isDisabled", "disabledKeys"],
      ],
      goToStep: [
        "to",
        "selectedKey",
        "itemKey",
        ["isDisabled", "disabledKeys"],
      ],
      completeStep: [
        "complete",
        "lastCompletedStep",
        null,
        ["isDisabled", "disabledKeys"],
      ],
    });
    // 패널과 실행의 첫 검사는 같은 함수다 — 읽기 전용 목록은 Do 를 받는다 (누르기만 막는다).
    const guards = list.capabilities.nextStep!.guards ?? [];
    expect(declaredRefusal(guards, { isDisabled: true })).toBe("isDisabled");
    expect(declaredRefusal(guards, { isReadOnly: true })).toBeUndefined();
  });

  it("이름 붙인 상태 2 — 지금 단계 · 마친 단계 (값 형 key → 글자)", () => {
    expect(IMPLICIT_STATE_SOURCES.StepList).toEqual([
      { prop: "selectedKey", event: "onSelectionChange", type: "string" },
      {
        prop: "lastCompletedStep",
        event: "onLastCompletedStepChange",
        type: "string",
      },
    ]);
  });
});

/** A StepList target whose state lives in `state` — the dispatcher's whole view of it. */
function target(
  start: Record<string, unknown>,
  declared: Record<string, unknown> = {},
  items: { itemKeys?: string[]; disabledKeys?: string[] } = {},
) {
  const state: Record<string, unknown> = { ...start };
  const writes: Record<string, unknown>[] = [];
  const deps: DispatchDeps = {
    getElement: () => ({ type: "StepList", props: { ...declared, ...state } }),
    updateElementProps: (_id, patch) => {
      writes.push(patch);
      Object.assign(state, patch);
    },
    navigate: () => {},
    showToast: () => {},
    getRuntimeState: (_id, prop) => state[prop],
    getConstraintContext: () => ({
      itemKeys: items.itemKeys ?? ["s1", "s2", "s3", "s4"],
      disabledKeys: items.disabledKeys ?? [],
    }),
  };
  const run = (capability: string, value?: unknown) =>
    executeInteractionRule(
      {
        id: "rule",
        type: "interaction",
        elementId: "button",
        trigger: "onPress",
        actions: [
          {
            kind: "capability",
            targetId: "list",
            capability,
            ...(value !== undefined ? { params: { value } } : {}),
          } as InteractionAction,
        ],
      },
      deps,
    );
  return { state, writes, run };
}

describe("ADR-321 — Do 가 쓰는 쌍 (dispatcher)", () => {
  it("다음 단계 — 지금 단계를 완료로, 다음 단계를 현재로 (쓰기 한 번)", () => {
    const t = target({ selectedKey: "s2", lastCompletedStep: "s1" });
    expect(t.run("nextStep")).toMatchObject({ ok: true });
    expect(t.writes).toEqual([{ selectedKey: "s3", lastCompletedStep: "s2" }]);
  });

  it("이전 단계 — 현재만 옮기고, 첫 단계에서는 쓰지 않는다", () => {
    const t = target({ selectedKey: "s2", lastCompletedStep: "s1" });
    expect(t.run("previousStep")).toMatchObject({ ok: true });
    expect(t.run("previousStep")).toMatchObject({ ok: true });
    expect(t.writes).toEqual([{ selectedKey: "s1" }]);
  });

  it("단계로 이동 — 규칙의 값 (key) 으로, 그 앞 단계까지 완료", () => {
    const t = target({ selectedKey: "s1", lastCompletedStep: null });
    expect(t.run("goToStep", "s4")).toMatchObject({ ok: true });
    expect(t.writes).toEqual([{ selectedKey: "s4", lastCompletedStep: "s3" }]);
    // 값이 없으면 실패다 (조용한 no-op 이 아니다).
    expect(t.run("goToStep")).toMatchObject({ ok: false });
    expect(t.run("goToStep", "nope")).toEqual({
      ok: false,
      reason: "StepList.goToStep 을 쓰지 않는다 — 단계 없음: nope",
    });
  });

  it("단계 완료 — 마친 단계만 쓴다", () => {
    const t = target({ selectedKey: "s2", lastCompletedStep: "s1" });
    expect(t.run("completeStep")).toMatchObject({ ok: true });
    expect(t.writes).toEqual([{ lastCompletedStep: "s2" }]);
  });

  it("비활성 목록 · 비활성 단계는 쓰지 않고 이유를 낸다", () => {
    const disabled = target(
      { selectedKey: "s2", lastCompletedStep: "s1" },
      { isDisabled: true },
    );
    expect(disabled.run("nextStep")).toEqual({
      ok: false,
      reason: "StepList.nextStep 을 쓰지 않는다 — isDisabled",
    });
    // 목록의 `disabledKeys` 와 단계 자신의 비활성 (항목 문맥) 둘 다.
    const byList = target(
      { selectedKey: "s2", lastCompletedStep: "s1" },
      { disabledKeys: ["s3"] },
    );
    expect(byList.run("nextStep")).toMatchObject({ ok: false });
    const byStep = target(
      { selectedKey: "s2", lastCompletedStep: "s1" },
      {},
      { disabledKeys: ["s3"] },
    );
    expect(byStep.run("goToStep", "s3")).toMatchObject({ ok: false });
    for (const t of [disabled, byList, byStep]) expect(t.writes).toEqual([]);
  });

  it("한 규칙의 Do 둘 — 「단계 완료」 뒤 「다음 단계」 는 앞 Do 가 쓴 상태에서 이어 간다", () => {
    const t = target({ selectedKey: "s1", lastCompletedStep: null });
    const outcome = executeInteractionRule(
      {
        id: "rule",
        type: "interaction",
        elementId: "form",
        trigger: "onSubmit",
        actions: [
          { kind: "capability", targetId: "list", capability: "completeStep" },
          { kind: "capability", targetId: "list", capability: "nextStep" },
        ],
      },
      {
        getElement: () => ({ type: "StepList", props: { ...t.state } }),
        updateElementProps: (_id, patch) => {
          t.writes.push(patch);
          Object.assign(t.state, patch);
        },
        navigate: () => {},
        showToast: () => {},
        getRuntimeState: (_id, prop) => t.state[prop],
        getConstraintContext: () => ({ itemKeys: ["s1", "s2", "s3", "s4"] }),
      },
    );
    expect(outcome).toMatchObject({ ok: true });
    expect(t.state).toEqual({ selectedKey: "s2", lastCompletedStep: "s1" });
  });
});
