import { describe, expect, it } from "vitest";
import {
  catalogStepListDo,
  catalogStepListPress,
  catalogStepListStates,
  type StepListStateInput,
} from "../stepListState";

/**
 * ADR-321 Phase 2 — the StepList's moves (breakdown §5.2). Every expected value is written out by
 * hand from the rule's text; none is read back from the functions under test. The linear rule is
 * v3's (`useStepListState.mjs` — the builder's `adr321StepListV3.test.tsx` runs the installed hook
 * against the same functions); free navigation is not in v3, so this table is its only reference
 * (ADR Decision 3).
 */

const KEYS = ["s1", "s2", "s3", "s4", "s5"];
const list = (input: Omit<StepListStateInput, "keys">): StepListStateInput => ({
  keys: KEYS,
  ...input,
});
const selectable = (input: Omit<StepListStateInput, "keys">) =>
  catalogStepListStates(list(input))
    .steps.filter((step) => step.selectable)
    .map((step) => step.key);

describe("ADR-321 — 갈 수 있는 단계: 선형 대 자유 이동", () => {
  it.each([
    // [이름, 입력, 선형에서 갈 수 있는 단계, 자유 이동에서 갈 수 있는 단계]
    ["첫 단계가 현재 · 완료 없음", {}, ["s1"], ["s1", "s2", "s3", "s4", "s5"]],
    [
      "3 번째가 현재 · 2 번째까지 완료",
      { selectedKey: "s3", lastCompletedStep: "s2" },
      ["s1", "s2", "s3"],
      ["s1", "s2", "s3", "s4", "s5"],
    ],
    [
      "비활성 단계는 어느 쪽에서도 못 간다",
      {
        selectedKey: "s2",
        lastCompletedStep: "s1",
        disabledKeys: ["s1", "s4"],
      },
      ["s2"],
      ["s2", "s3", "s5"],
    ],
    ["목록이 비활성", { isDisabled: true, lastCompletedStep: "s3" }, [], []],
    ["목록이 읽기 전용", { isReadOnly: true, lastCompletedStep: "s3" }, [], []],
  ] as const)("%s", (_name, input, linear, free) => {
    expect(selectable(input)).toEqual(linear);
    expect(selectable({ ...input, allowsFreeNavigation: true })).toEqual(free);
  });

  it("자유 이동은 완료 · 현재 판정을 바꾸지 않는다", () => {
    const input = { selectedKey: "s3", lastCompletedStep: "s2" };
    const kinds = (free: boolean) =>
      catalogStepListStates(
        list({ ...input, allowsFreeNavigation: free }),
      ).steps.map((step) => step.state);
    expect(kinds(false)).toEqual([
      "completed",
      "completed",
      "current",
      "incomplete",
      "incomplete",
    ]);
    expect(kinds(true)).toEqual(kinds(false));
  });

  it("정규화한 마지막 완료 단계를 같이 낸다 (지나온 단계 완료)", () => {
    expect(catalogStepListStates(list({})).lastCompletedStep).toBeNull();
    expect(
      catalogStepListStates(
        list({ selectedKey: "s2", lastCompletedStep: "s4" }),
      ).lastCompletedStep,
    ).toBe("s4");
    // 현재가 4 번째인데 완료가 1 번째까지면 3 번째까지 완료다.
    expect(
      catalogStepListStates(
        list({ selectedKey: "s4", lastCompletedStep: "s1" }),
      ).lastCompletedStep,
    ).toBe("s3");
  });
});

describe("ADR-321 — 단계 누르기 (사용자의 이동)", () => {
  it("선형: 갈 수 있는 단계만 — 다음 단계로 가면 지나온 단계가 완료된다", () => {
    const at = { selectedKey: "s3", lastCompletedStep: "s3" };
    // 완료된 단계로 돌아가기 — 완료는 그대로.
    expect(catalogStepListPress(list(at), "s1")).toEqual({
      ok: true,
      patch: { selectedKey: "s1" },
    });
    // 마지막 완료 단계의 다음 단계.
    expect(catalogStepListPress(list(at), "s4")).toEqual({
      ok: true,
      patch: { selectedKey: "s4" },
    });
    // 그 다음 단계는 못 간다.
    expect(catalogStepListPress(list(at), "s5")).toMatchObject({ ok: false });
    // 지금 단계를 다시 누르면 바뀌는 것이 없다.
    expect(catalogStepListPress(list(at), "s3")).toEqual({
      ok: true,
      patch: {},
    });
  });

  it("자유 이동: 어느 단계로든 — 건너뛴 단계는 그 앞 단계까지 완료가 된다", () => {
    const at = {
      selectedKey: "s1",
      lastCompletedStep: null,
      allowsFreeNavigation: true,
    };
    expect(catalogStepListPress(list(at), "s4")).toEqual({
      ok: true,
      patch: { selectedKey: "s4", lastCompletedStep: "s3" },
    });
    // 뒤로 가면 완료는 줄지 않는다.
    expect(
      catalogStepListPress(
        list({ ...at, selectedKey: "s4", lastCompletedStep: "s3" }),
        "s2",
      ),
    ).toEqual({ ok: true, patch: { selectedKey: "s2" } });
    // 비활성 단계는 자유 이동에서도 못 간다.
    expect(
      catalogStepListPress(list({ ...at, disabledKeys: ["s3"] }), "s3"),
    ).toMatchObject({ ok: false });
  });

  it("비활성 · 읽기 전용 목록은 누르기를 받지 않는다", () => {
    for (const flag of ["isDisabled", "isReadOnly"] as const)
      for (const free of [false, true])
        expect(
          catalogStepListPress(
            list({
              selectedKey: "s2",
              lastCompletedStep: "s2",
              [flag]: true,
              allowsFreeNavigation: free,
            }),
            "s1",
          ),
        ).toMatchObject({ ok: false });
  });
});

describe("ADR-321 — Do 넷 (규칙이 쓰는 이동)", () => {
  const at = { selectedKey: "s2", lastCompletedStep: "s1" };

  it("다음 단계 — 지금 단계가 완료되고 다음 단계가 현재", () => {
    expect(catalogStepListDo(list(at), "next")).toEqual({
      ok: true,
      patch: { selectedKey: "s3", lastCompletedStep: "s2" },
    });
    // 마지막 단계에서는 머문다 (실패가 아니다).
    expect(
      catalogStepListDo(
        list({ selectedKey: "s5", lastCompletedStep: "s4" }),
        "next",
      ),
    ).toEqual({ ok: true, patch: {} });
    // 다음 단계가 비활성이면 가지 않는다.
    expect(
      catalogStepListDo(list({ ...at, disabledKeys: ["s3"] }), "next"),
    ).toEqual({ ok: false, reason: "disabledKeys" });
  });

  it("이전 단계 — 완료는 그대로", () => {
    expect(catalogStepListDo(list(at), "previous")).toEqual({
      ok: true,
      patch: { selectedKey: "s1" },
    });
    expect(catalogStepListDo(list({ selectedKey: "s1" }), "previous")).toEqual({
      ok: true,
      patch: {},
    });
  });

  it("단계로 이동 — 순서와 무관하게 가고 그 앞 단계까지 완료 (v3 `setSelectedKey`)", () => {
    expect(catalogStepListDo(list(at), "to", "s5")).toEqual({
      ok: true,
      patch: { selectedKey: "s5", lastCompletedStep: "s4" },
    });
    expect(catalogStepListDo(list(at), "to", "s1")).toEqual({
      ok: true,
      patch: { selectedKey: "s1" },
    });
    expect(catalogStepListDo(list(at), "to", "nope")).toEqual({
      ok: false,
      reason: "단계 없음: nope",
    });
    expect(catalogStepListDo(list(at), "to")).toMatchObject({ ok: false });
    expect(
      catalogStepListDo(list({ ...at, disabledKeys: ["s4"] }), "to", "s4"),
    ).toEqual({ ok: false, reason: "disabledKeys" });
  });

  it("단계 완료 — 지금 단계까지 완료, 이미 지나온 완료는 줄이지 않는다", () => {
    expect(catalogStepListDo(list(at), "complete")).toEqual({
      ok: true,
      patch: { lastCompletedStep: "s2" },
    });
    expect(
      catalogStepListDo(
        list({ selectedKey: "s2", lastCompletedStep: "s4" }),
        "complete",
      ),
    ).toEqual({ ok: true, patch: {} });
  });

  it("비활성 목록은 Do 를 받지 않고, 읽기 전용 목록은 받는다 (누르기만 막는다)", () => {
    for (const kind of ["next", "previous", "complete"] as const)
      expect(
        catalogStepListDo(list({ ...at, isDisabled: true }), kind),
      ).toEqual({ ok: false, reason: "isDisabled" });
    expect(
      catalogStepListDo(list({ ...at, isReadOnly: true }), "next"),
    ).toEqual({
      ok: true,
      patch: { selectedKey: "s3", lastCompletedStep: "s2" },
    });
  });

  it("「단계 완료 · 다음 단계」 를 이어 쓰면 한 단계씩 끝까지 간다", () => {
    let state: {
      selectedKey: string | null;
      lastCompletedStep: string | null;
    } = { selectedKey: null, lastCompletedStep: null };
    const trail: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      for (const kind of ["complete", "next"] as const) {
        const outcome = catalogStepListDo(list(state), kind);
        expect(outcome.ok).toBe(true);
        if (outcome.ok) state = { ...state, ...outcome.patch };
      }
      trail.push(`${state.selectedKey}/${state.lastCompletedStep}`);
    }
    expect(trail).toEqual([
      "s2/s1",
      "s3/s2",
      "s4/s3",
      "s5/s4",
      "s5/s5",
      "s5/s5",
    ]);
  });
});
