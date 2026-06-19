import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-913 후속 fix (2026-06-19) — field family labelPosition="side" CSS↔Skia 대칭 회귀 가드.
 *
 * **배경**: TextField/NumberField/SearchField/TextArea/ColorField 의 catalog rule
 * `containerVariants["label-position"].side.styles` 가 `display: grid` + grid-template-columns 로
 * 정의돼 있었다. 그러나:
 *   1. Skia layout(implicitStyles.getSideLabelParentStyle)은 grid 미지원 → flex-row 시뮬레이션
 *      → CSS(grid) ↔ Skia(flex-row) 비대칭.
 *   2. factory inline `flexDirection:column`(NumberField/SearchField)이 CSS specificity(1-0-0)로
 *      generated CSS grid selector(0-2-0)를 이겨 실제로는 양쪽 다 column 으로 무력화 → Label 항상 top.
 *   3. (TextField 는 별도 — DELEGATING 미등록으로 data-label-position DOM 미emit, selectFamily.test 가드.)
 *
 * **수정**: 5 field 의 side styles 를 DateField/TimeField 와 동일한 flex-row 로 통일
 * (catalog componentRulesTable + generate-css.ts STRUCTURE_META 동시). generated CSS = Skia 대칭 복원.
 *
 * **본 test 의 불변식**: 모든 field family 컴포넌트의 side variant styles 는 flex-row 로 통일돼야 한다.
 * grid 재도입(display:"grid")은 CSS↔Skia 비대칭 회귀이므로 금지.
 */

/** label-position:side 를 가지는 field family 컴포넌트 (DateField/TimeField = 기준 정본 포함). */
const FIELD_FAMILY = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
] as const;

describe("ADR-913 후속 — field family labelPosition='side' flex-row 통일 가드", () => {
  it.each(FIELD_FAMILY)(
    "%s 의 catalog side variant 는 flex-row (grid 비대칭 회귀 차단)",
    (type) => {
      const rule = COMPONENT_RULES_TABLE[type] as
        | { containerVariants?: Record<string, unknown> }
        | undefined;
      const side = (
        rule?.containerVariants as
          | {
              "label-position"?: {
                side?: { styles?: Record<string, string> };
              };
            }
          | undefined
      )?.["label-position"]?.side?.styles;

      expect(
        side,
        `${type} containerVariants["label-position"].side.styles`,
      ).toBeTruthy();
      // flex-row 통일 — display:"grid" / grid-template-columns 재도입 금지 (CSS↔Skia 비대칭 회귀)
      expect(side?.["flex-direction"], `${type} side flex-direction`).toBe(
        "row",
      );
      expect(side?.["align-items"], `${type} side align-items`).toBe(
        "flex-start",
      );
      expect(side?.display, `${type} side display (grid 금지)`).toBeUndefined();
      expect(
        side?.["grid-template-columns"],
        `${type} side grid-template-columns (grid 금지)`,
      ).toBeUndefined();
    },
  );

  it("7 field 의 side styles 가 모두 byte-identical (DateField 정본 1:1 통일)", () => {
    const canonical = { "flex-direction": "row", "align-items": "flex-start" };
    for (const type of FIELD_FAMILY) {
      const rule = COMPONENT_RULES_TABLE[type] as
        | { containerVariants?: Record<string, unknown> }
        | undefined;
      const side = (
        rule?.containerVariants as
          | {
              "label-position"?: {
                side?: { styles?: Record<string, string> };
              };
            }
          | undefined
      )?.["label-position"]?.side?.styles;
      expect(side, `${type} side styles == DateField 정본`).toEqual(canonical);
    }
  });
});
