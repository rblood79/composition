import { describe, expect, it } from "vitest";
import {
  catalogStepChromeColors,
  catalogStepChromeRects,
  catalogStepGlyph,
  catalogStepMinMain,
  catalogStepPadding,
} from "../../rule/stepList";
import {
  catalogStepDerived,
  catalogStepListKeys,
  catalogStepListLayout,
  catalogStepListStates,
} from "../stepList";

/**
 * ADR-321 Phase 1 — the StepList state rule and the step's visual · track places. Every expected
 * value below is written out by hand from the rule's text (breakdown §5.2 · §5.3) — none is read
 * back from the functions under test.
 */

const KEYS = ["s1", "s2", "s3", "s4", "s5"];

// (The Phase 0 fixtures — v3 `useStepListState.mjs:31-65` solved by hand per fixture; the same
//  table the P1 prototype met in Chrome against the v3 hook's own list.)
const STATE_TABLE: readonly {
  name: string;
  input: Omit<Parameters<typeof catalogStepListStates>[0], "keys">;
  current: string;
  completed: readonly string[];
  disabled: readonly string[];
  selectable: readonly string[];
}[] = [
  {
    name: "A — 3 번째가 현재 · 2 번째까지 완료",
    input: { selectedKey: "s3", lastCompletedStep: "s2" },
    current: "s3",
    completed: ["s1", "s2"],
    disabled: [],
    selectable: ["s1", "s2", "s3"],
  },
  {
    name: "B — disabledKeys 에 든 완료 단계",
    input: { selectedKey: "s4", lastCompletedStep: "s3", disabledKeys: ["s2"] },
    current: "s4",
    completed: ["s1", "s2", "s3"],
    disabled: ["s2"],
    selectable: ["s1", "s3", "s4"],
  },
  {
    name: "C — 현재 단계가 마지막 완료 단계",
    input: { selectedKey: "s3", lastCompletedStep: "s3" },
    current: "s3",
    completed: ["s1", "s2", "s3"],
    disabled: [],
    selectable: ["s1", "s2", "s3", "s4"],
  },
  {
    name: "D — 선택도 완료도 없음 (첫 단계가 현재)",
    input: {},
    current: "s1",
    completed: [],
    disabled: [],
    selectable: ["s1"],
  },
  {
    name: "선택 없음 · 2 번째까지 완료 (완료가 아닌 첫 단계가 현재)",
    input: { lastCompletedStep: "s2" },
    current: "s3",
    completed: ["s1", "s2"],
    disabled: [],
    selectable: ["s1", "s2", "s3"],
  },
  {
    name: "선택 없음 · 완료가 아닌 첫 단계가 비활성 (그다음 단계가 현재)",
    input: { lastCompletedStep: "s1", disabledKeys: ["s2"] },
    current: "s3",
    // (현재 단계 s3 이 완료 s1 보다 둘 앞 — 지나온 s2 까지 완료가 된다.)
    completed: ["s1", "s2"],
    disabled: ["s2"],
    selectable: ["s1", "s3"],
  },
  {
    name: "현재 단계가 완료보다 둘 이상 앞 — 지나온 단계가 완료가 된다 (v3 의 mount 뒤 값)",
    input: { selectedKey: "s4" },
    current: "s4",
    completed: ["s1", "s2", "s3"],
    disabled: [],
    selectable: ["s1", "s2", "s3", "s4"],
  },
  {
    name: "선택 없음 · 모두 완료 (마지막 단계가 현재)",
    input: { lastCompletedStep: "s5" },
    current: "s5",
    completed: ["s1", "s2", "s3", "s4", "s5"],
    disabled: [],
    selectable: ["s1", "s2", "s3", "s4", "s5"],
  },
  {
    name: "없는 key 의 선택 · 완료는 없는 것과 같다",
    input: { selectedKey: "gone", lastCompletedStep: "gone" },
    current: "s1",
    completed: [],
    disabled: [],
    selectable: ["s1"],
  },
  {
    name: "목록 비활성 — 모든 단계가 비활성 · 갈 수 있는 단계 0",
    input: { selectedKey: "s2", lastCompletedStep: "s1", isDisabled: true },
    current: "s2",
    completed: ["s1"],
    disabled: KEYS,
    selectable: [],
  },
  {
    name: "읽기 전용 — 비활성으로 그리지 않고 갈 수 있는 단계 0",
    input: { selectedKey: "s2", lastCompletedStep: "s1", isReadOnly: true },
    current: "s2",
    completed: ["s1"],
    disabled: [],
    selectable: [],
  },
];

describe("ADR-321 — StepList 상태 규칙 (정답표)", () => {
  it.each(STATE_TABLE)("$name", (row) => {
    const { selectedKey, steps } = catalogStepListStates({
      keys: KEYS,
      ...row.input,
    });
    expect(selectedKey).toBe(row.current);
    expect(
      steps.filter((s) => s.state === "current").map((s) => s.key),
    ).toEqual([row.current]);
    expect(steps.filter((s) => s.completed).map((s) => s.key)).toEqual(
      row.completed,
    );
    expect(steps.filter((s) => s.disabled).map((s) => s.key)).toEqual(
      row.disabled,
    );
    expect(steps.filter((s) => s.selectable).map((s) => s.key)).toEqual(
      row.selectable,
    );
    // 현재도 완료도 아닌 단계는 남음, 완료이면서 현재가 아닌 단계는 완료로 그린다.
    for (const step of steps)
      expect(step.state).toBe(
        step.key === row.current
          ? "current"
          : row.completed.includes(step.key)
            ? "completed"
            : "incomplete",
      );
  });

  it("단계가 없는 목록은 현재 단계가 없다", () => {
    expect(catalogStepListStates({ keys: [] })).toEqual({
      selectedKey: null,
      lastCompletedStep: null,
      steps: [],
    });
  });

  it("시작 값 — 제어 값이 시작 값을 이긴다 · 빈 글자는 없음", () => {
    expect(
      catalogStepListKeys({
        selectedKey: "s4",
        defaultSelectedKey: "s2",
        defaultLastCompletedStep: "s1",
      }),
    ).toEqual({ selectedKey: "s4", lastCompletedStep: "s1" });
    expect(
      catalogStepListKeys({ selectedKey: "", defaultSelectedKey: "s2" }),
    ).toEqual({ selectedKey: "s2", lastCompletedStep: null });
    expect(catalogStepListKeys({})).toEqual({
      selectedKey: null,
      lastCompletedStep: null,
    });
  });
});

describe("ADR-321 — 표식 · 선의 자리 (정답표)", () => {
  it("단계가 비우는 여백 — 가로 = 아래 (간격 + 표식) · 오른쪽 8, 세로 = 왼쪽 (표식 + 간격) · 아래 8", () => {
    expect(catalogStepPadding("horizontal", "S", 16)).toEqual({
      top: 0,
      right: 8,
      bottom: 12,
      left: 0,
    });
    expect(catalogStepPadding("horizontal", "M", 18)).toEqual({
      top: 0,
      right: 8,
      bottom: 22,
      left: 0,
    });
    expect(catalogStepPadding("horizontal", "L", 20).bottom).toBe(30);
    expect(catalogStepPadding("horizontal", "XL", 22).bottom).toBe(38);
    expect(catalogStepPadding("vertical", "M", 18)).toEqual({
      top: 0,
      right: 0,
      bottom: 8,
      left: 22,
    });
    // 표식 32 가 행간 22 보다 크다 — 글자가 5 내려와 첫 줄과 표식의 가운데가 맞는다.
    expect(catalogStepPadding("vertical", "XL", 22)).toEqual({
      top: 5,
      right: 0,
      bottom: 8,
      left: 38,
    });
    expect(catalogStepPadding("vertical", "S", 16)).toEqual({
      top: 0,
      right: 0,
      bottom: 8,
      left: 12,
    });
  });

  it("주축 최소 = 표식 + 24", () => {
    expect(
      (["S", "M", "L", "XL"] as const).map((size) => catalogStepMinMain(size)),
    ).toEqual([32, 40, 48, 56]);
  });

  it("가로 — 표식은 왼쪽 아래, 선은 표식에서 4 떨어져 단계 끝 4 앞까지 · 표식의 세로 가운데", () => {
    expect(
      catalogStepChromeRects({
        orientation: "horizontal",
        size: "M",
        last: false,
        lineHeight: 18,
        width: 120,
        height: 40,
      }),
    ).toEqual({
      visual: { x: 0, y: 24, width: 16, height: 16 },
      track: { x: 20, y: 31, width: 96, height: 2 },
    });
    expect(
      catalogStepChromeRects({
        orientation: "horizontal",
        size: "XL",
        last: false,
        lineHeight: 22,
        width: 200,
        height: 60,
      }),
    ).toEqual({
      visual: { x: 0, y: 28, width: 32, height: 32 },
      track: { x: 36, y: 43, width: 160, height: 2 },
    });
  });

  it("마지막 단계에는 선이 없다", () => {
    for (const orientation of ["horizontal", "vertical"] as const)
      expect(
        catalogStepChromeRects({
          orientation,
          size: "M",
          last: true,
          lineHeight: 18,
          width: 120,
          height: 40,
        }).track,
      ).toBeUndefined();
  });

  it("세로 — 표식은 라벨 첫 줄의 가운데, 선은 표식 아래 4 에서 다음 표식 4 위까지", () => {
    // M: 행간 18 > 표식 16 → 표식이 1 내려온다. 선의 아래 끝 = 4 − 1 = 3.
    expect(
      catalogStepChromeRects({
        orientation: "vertical",
        size: "M",
        last: false,
        lineHeight: 18,
        width: 200,
        height: 40,
      }),
    ).toEqual({
      visual: { x: 0, y: 1, width: 16, height: 16 },
      track: { x: 7, y: 21, width: 2, height: 16 },
    });
    // S: 행간 16 > 점 8 → 점이 4 내려온다. 선의 아래 끝 = 0.
    expect(
      catalogStepChromeRects({
        orientation: "vertical",
        size: "S",
        last: false,
        lineHeight: 16,
        width: 200,
        height: 32,
      }),
    ).toEqual({
      visual: { x: 0, y: 4, width: 8, height: 8 },
      track: { x: 3, y: 16, width: 2, height: 16 },
    });
    // XL: 표식 32 > 행간 22 → 표식은 위에 붙는다. 선의 아래 끝 = 4.
    expect(
      catalogStepChromeRects({
        orientation: "vertical",
        size: "XL",
        last: false,
        lineHeight: 22,
        width: 200,
        height: 56,
      }),
    ).toEqual({
      visual: { x: 0, y: 0, width: 32, height: 32 },
      track: { x: 15, y: 36, width: 2, height: 16 },
    });
  });

  it("표식 안 — 완료 = 체크 · 현재 · 남음 = 숫자 · S 는 점만", () => {
    expect(catalogStepGlyph("M", "completed")).toBe("check");
    expect(catalogStepGlyph("M", "current")).toBe("number");
    expect(catalogStepGlyph("XL", "incomplete")).toBe("number");
    for (const state of ["completed", "current", "incomplete"] as const)
      expect(catalogStepGlyph("S", state)).toBe("none");
  });
});

describe("ADR-321 — 표식 · 선 · 글자의 색 (정답표: design-data binding → 저장소 TokenRef)", () => {
  const colors = (
    state: "current" | "completed" | "incomplete",
    emphasized = false,
    disabled = false,
  ) => catalogStepChromeColors({ state, emphasized, disabled });

  it("완료 — 채운 표식 (gray) · 선도 같은 색 · 라벨은 subdued", () => {
    expect(colors("completed")).toEqual({
      visualFill: "{color.gray}",
      glyph: "{color.on-neutral}",
      track: "{color.gray}",
      label: "{color.neutral-subdued}",
      description: "{color.neutral-subdued}",
    });
  });
  it("현재 — 진한 표식 · 선은 남음 색 · 라벨은 neutral content", () => {
    expect(colors("current")).toEqual({
      visualFill: "{color.neutral-fill}",
      glyph: "{color.on-neutral}",
      track: "{color.field-placeholder}",
      label: "{color.neutral-content}",
      description: "{color.neutral-subdued}",
    });
  });
  it("남음 — 테두리만 · 채움 없음", () => {
    expect(colors("incomplete")).toEqual({
      visualBorder: "{color.field-placeholder}",
      glyph: "{color.neutral-subdued}",
      track: "{color.field-placeholder}",
      label: "{color.neutral-subdued}",
      description: "{color.neutral-subdued}",
    });
    // 강조는 남음 단계를 바꾸지 않는다.
    expect(colors("incomplete", true)).toEqual(colors("incomplete"));
  });
  it("강조 — 완료 · 현재 표식과 완료 선이 accent, 현재 라벨이 accent content", () => {
    expect(colors("completed", true)).toMatchObject({
      visualFill: "{color.accent}",
      glyph: "{color.on-accent}",
      track: "{color.accent}",
      label: "{color.neutral-subdued}",
    });
    expect(colors("current", true)).toMatchObject({
      visualFill: "{color.accent}",
      track: "{color.field-placeholder}",
      label: "{color.accent-content}",
    });
  });
  it("비활성 — 강조와 상태를 이긴다 (남음은 테두리만)", () => {
    for (const emphasized of [false, true]) {
      expect(colors("current", emphasized, true)).toEqual({
        visualFill: "{color.disabled}",
        glyph: "{color.disabled-content}",
        track: "{color.disabled}",
        label: "{color.disabled-content}",
        description: "{color.disabled-content}",
      });
      expect(colors("incomplete", emphasized, true)).toMatchObject({
        visualBorder: "{color.border-disabled}",
        label: "{color.disabled-content}",
      });
      expect(colors("incomplete", emphasized, true).visualFill).toBeUndefined();
    }
  });
});

describe("ADR-321 — 파생 값 → Canvas layout", () => {
  const step = (index: number, state: "current" | "completed" | "incomplete") =>
    ({
      key: `s${index + 1}`,
      index,
      state,
      completed: state === "completed",
      disabled: false,
      selectable: true,
    }) as const;

  it("단계의 파생 값 — 번호 · 마지막 · 방향 · 강조 · 여백", () => {
    const derived = catalogStepDerived(
      step(2, "current"),
      3,
      { orientation: "vertical", isEmphasized: true },
      "M",
    );
    expect(derived).toMatchObject({
      _stepOrientation: "vertical",
      _stepState: "current",
      _stepNumber: 3,
      _stepLast: true,
      _stepEmphasized: true,
      _stepDisabled: false,
      _stepSize: "M",
      _stepPadRight: 0,
      _stepPadBottom: 8,
      _stepPadLeft: 22,
    });
    // (크기가 없거나 모르는 값이면 M.)
    expect(
      catalogStepDerived(step(0, "completed"), 3, {}, "XXL"),
    ).toMatchObject({
      _stepSize: "M",
      _stepOrientation: "horizontal",
      _stepLast: false,
    });
  });

  it("가로 단계 = 같은 몫 (grow 1 · basis 0) 과 최소 폭, 세로 단계 = 최소 높이, 세로 목록 = 열", () => {
    expect(
      catalogStepListLayout({ _stepOrientation: "horizontal", _stepSize: "L" }),
    ).toEqual({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "0px",
      minWidth: "48px",
    });
    expect(
      catalogStepListLayout({ _stepOrientation: "vertical", _stepSize: "S" }),
    ).toEqual({ minHeight: "32px" });
    expect(catalogStepListLayout({ _stepListOrientation: "vertical" })).toEqual(
      {
        flexDirection: "column",
        alignItems: "stretch",
      },
    );
    // 가로 목록은 rule 의 줄 그대로다. 다른 record 는 값이 없다.
    expect(
      catalogStepListLayout({ _stepListOrientation: "horizontal" }),
    ).toEqual({});
    expect(catalogStepListLayout(undefined)).toEqual({});
  });
});
