import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * DatePicker/DateRangePicker 컨테이너 height 결합 제거 회귀 방지 (2026-06-23, 사용자 적발).
 *
 * **배경**: catalog `DatePicker`/`DateRangePicker` 는 컨테이너(Label 행 + gap + 입력 box
 * [SelectTrigger > DateInput] + Calendar) 라 height 는 자식 합산 auto(md=54) 여야 한다. CSS preview
 * 도 `.react-aria-DatePicker` 에 height 를 지정하지 않아 54 auto 다. 그러나 catalog `sizes.height=30`
 * 이 박혀 있어 — 컨테이너 entry 의 값을 입력 box height 인 척 끌어쓰는 잘못된 결합이었다(layout
 * `implicitStyles.ts` datepicker 분기가 `specSizeField("datepicker",…,"height")` 로 읽어 DateInput
 * 입력 box 에 주입). Select/ComboBox/NumberField/SearchField 가 `TRACK_HEIGHT_TYPES` 로 패널 height
 * 축을 제외(sizes.height 는 입력 trigger 행 높이이지 컨테이너 전체가 아님)한 것과 동일 케이스인데
 * DatePicker 만 누락돼 있었다.
 *
 * **불변식**:
 *  1. DatePicker/DateRangePicker.sizes 의 어느 size 도 `height` 키를 갖지 않는다(컨테이너 = auto).
 *  2. 입력 box height SSOT 인 SelectTrigger.sizes.height 는 전 size 유한수로 보존(md=30) —
 *     layout datepicker 분기가 `specSizeField("selecttrigger",…,"height")` 로 읽는 대상.
 */
describe("DatePicker/DateRangePicker 컨테이너 height 결합 제거", () => {
  const containerTypes = ["DatePicker", "DateRangePicker"] as const;

  it("컨테이너 type 의 sizes 는 어느 size 도 height 키를 갖지 않는다 (컨테이너=auto)", () => {
    const violations: string[] = [];
    for (const type of containerTypes) {
      const sizes = COMPONENT_RULES_TABLE[type]?.sizes ?? {};
      for (const [size, spec] of Object.entries(sizes)) {
        if ("height" in (spec as Record<string, unknown>)) {
          violations.push(
            `${type}.sizes.${size}.height = ${JSON.stringify((spec as { height?: unknown }).height)}`,
          );
        }
      }
    }
    expect(
      violations,
      `컨테이너 height 결합 재발 — 입력 box height 는 SelectTrigger.sizes.height SSOT:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("입력 box height SSOT — SelectTrigger.sizes.height 는 전 size 유한수 보존(md=30)", () => {
    const sizes = COMPONENT_RULES_TABLE.SelectTrigger?.sizes ?? {};
    const entries = Object.entries(sizes);
    expect(entries.length, "SelectTrigger sizes 없음").toBeGreaterThan(0);
    for (const [size, spec] of entries) {
      const h = (spec as { height?: unknown }).height;
      expect(
        typeof h === "number" && Number.isFinite(h),
        `SelectTrigger.sizes.${size}.height = ${JSON.stringify(h)} (유한수 아님)`,
      ).toBe(true);
    }
    expect(
      (sizes.md as { height?: unknown } | undefined)?.height,
      "SelectTrigger.sizes.md.height (picker 입력 box 기준값)",
    ).toBe(30);
  });
});
