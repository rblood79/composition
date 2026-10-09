import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * field family labelPosition="side" — 최상위 `containerVariants` 거울 ↔ `structure.composition` 정본 가드.
 *
 * **2026-10-10 (사용자 「모든 field · picker 의 side label width 가 fit content 가 아니다 — slider 와 같은
 * 패턴」)**: side 는 S2 `field()` 의 grid (`auto minmax(0, 1fr)`) 다 — 라벨 열이 글자 폭, 내용 · 도움말 ·
 * 오류 문구가 2열. 그전 (ADR-913 후속 2026-06-19 ~) 은 flex-row + 176px 라벨 열이었다. 그때 grid 를 막은
 * 이유는 옛 Skia 레이아웃 (`implicitStyles.getSideLabelParentStyle`) 이 grid 를 못 그렸기 때문인데, 지금은
 * Canvas 가 같은 rule 을 엔진의 grid 로 그린다 (live: Canvas = Preview — `field-side-label-live.mjs`).
 *
 * **본 test 의 불변식**: field family 의 side root styles 는 grid 하나로 같고, 최상위 거울 (Style 패널의
 * preset 이 읽는다) 은 정본 (`structure.composition.containerVariants`) 과 같다.
 */

/** label-position:side 를 가지는 field family 컴포넌트. */
const FIELD_FAMILY = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
] as const;

const CANONICAL = {
  display: "grid",
  "grid-template-columns": "auto minmax(0, 1fr)",
  "align-items": "start",
};

type SideStyles = Record<string, string> | undefined;
const sideOf = (variants: unknown): SideStyles =>
  (
    variants as
      | { "label-position"?: { side?: { styles?: Record<string, string> } } }
      | undefined
  )?.["label-position"]?.side?.styles;

describe("field family labelPosition='side' — S2 grid", () => {
  it.each(FIELD_FAMILY)(
    "%s 의 side styles 는 grid auto · 나머지 (정본 = 최상위 거울)",
    (type) => {
      const rule = COMPONENT_RULES_TABLE[type] as
        | {
            containerVariants?: unknown;
            structure?: { composition?: { containerVariants?: unknown } };
          }
        | undefined;
      const composed = sideOf(rule?.structure?.composition?.containerVariants);
      expect(composed, `${type} structure side styles`).toEqual(CANONICAL);
      expect(sideOf(rule?.containerVariants), `${type} mirror`).toEqual(
        CANONICAL,
      );
    },
  );
});
