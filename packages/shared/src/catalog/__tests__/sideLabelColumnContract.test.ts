import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * design-data 감사 §1-2 축① (2026-08-21) — side 라벨 컬럼 3지점 동기 계약.
 *
 * `labelPosition="side"` 인 field 는 라벨이 **고정폭 컬럼**이 되어야 하고, 그 목록이
 * 세 곳에서 같아야 시각 대칭이 성립한다:
 *   1. catalog(본 계약) — DOM generated CSS `> .react-aria-Label { width: var(--form-label-width) }`
 *   2. Skia layout — `implicitStyles` 의 `injectSideLabelLabelAndWrapperStyles` /
 *      `...AndContentStyles` 호출 대상 (FORM_SIDE_LABEL_WIDTH=176px 주입)
 *   3. Skia render — `buildSpecNodeData` 의 `FORM_INHERITANCE_TAGS` (labelAlign 해석 조상)
 *
 * **Why**: 2026-08-21 이전에는 2번만 있었다 — Skia 라벨은 176px 컬럼, DOM 라벨은 자연폭이라
 * 같은 문서가 캔버스와 preview 에서 다르게 보였고, `--form-label-align` 은 읽는 rule 이
 * 없어 labelAlign 이 DOM 에서 완전히 죽어 있었다.
 *
 * ColorField · CheckboxGroup · RadioGroup 도 같은 컬럼이다 (2026-10-07 — ADR-253 후속, 사용자 지시
 * 「레퍼런스 기준」: RSP 의 side 라벨은 field 종류와 무관하게 라벨 열 옆에 내용, 그 아래 줄 내용과
 * 같은 x 에 도움말 · 오류 문구). 종전 제외는 옛 Skia 의 「width 강제 없음」 과 ColorField 의 Skia side
 * 처리 부재가 근거였고, 지금은 Canvas 가 같은 rule 을 읽는다. 두 그룹의 `labelAlign` 은 S2 1.8.0 그대로
 * start · end 만이라 (S2 `Alignment`, 2026-10-09) `label-align` variant 도 end 블록 하나다.
 *
 * 2026-10-10 (사용자 「모든 field · picker 의 side label width 가 fit content 가 아니다 — slider 와 같은
 * 패턴」): 라벨 열은 고정 176px 가 아니라 S2 `field()` 의 grid `auto 1fr` — 라벨은 1열 (글자 폭), 내용 ·
 * 도움말 · 오류 문구는 2열 (도움말이 내용 아래 같은 x). 폭 변수 `--form-label-width` 는 side Form 이
 * 바로 아래 field 에만 준다 (fallback 없음 — 없으면 width auto).
 */

const SIDE_LABEL_COLUMN_FAMILIES = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "ColorField",
  "CheckboxGroup",
  "RadioGroup",
] as const;

/** The groups take S2 `labelAlign` start · end only. */
const GROUP_FAMILIES = ["CheckboxGroup", "RadioGroup"] as const;

/** Side-column fields that take `labelAlign` with center (the groups: start · end). */
const LABEL_ALIGN_FAMILIES = SIDE_LABEL_COLUMN_FAMILIES.filter(
  (component) => component !== "CheckboxGroup" && component !== "RadioGroup",
);

type NestedRule = { selector: string; styles: Record<string, string> };

function sideLabelNested(component: string): NestedRule[] {
  const rule = COMPONENT_RULES_TABLE[component];
  const variants = rule?.structure?.composition?.containerVariants as
    | Record<
        string,
        Record<
          string,
          { styles?: Record<string, string>; nested?: NestedRule[] }
        >
      >
    | undefined;
  return variants?.["label-position"]?.side?.nested ?? [];
}

function labelAlignVariant(component: string) {
  const rule = COMPONENT_RULES_TABLE[component];
  const variants = rule?.structure?.composition?.containerVariants as
    | Record<string, Record<string, { styles?: Record<string, string> }>>
    | undefined;
  return variants?.["label-align"];
}

describe("side 라벨 컬럼 catalog 계약 (§1-2 축①)", () => {
  it.each(SIDE_LABEL_COLUMN_FAMILIES)(
    "%s: side 모드 라벨이 1열 (Form 이 준 --form-label-width, 없으면 글자 폭) + --form-label-align 정렬을 받는다",
    (component) => {
      const labelRule = sideLabelNested(component).find((n) =>
        n.selector.includes(".react-aria-Label"),
      );
      expect(labelRule, `${component} side label nested rule`).toBeDefined();
      expect(labelRule!.styles.width).toBe("var(--form-label-width)");
      expect(labelRule!.styles["grid-column"]).toBe("1");
      expect(labelRule!.styles["text-align"]).toBe(
        "var(--form-label-align, start)",
      );
      // The Label is `inline-flex` (Label.css · rule): its text is an anonymous flex item, which
      // `text-align` does not move — the column places it with `justify-content` (2026-10-09 live:
      // Preview text stayed at the start while the Canvas painted it at the end).
      expect(labelRule!.styles["justify-content"]).toBe(
        "var(--form-label-align, start)",
      );
    },
  );

  it.each(LABEL_ALIGN_FAMILIES)(
    "%s: labelAlign 이 --form-label-align 을 정의한다 (center/end)",
    (component) => {
      const variant = labelAlignVariant(component);
      expect(variant?.center?.styles?.["--form-label-align"]).toBe("center");
      expect(variant?.end?.styles?.["--form-label-align"]).toBe("end");
    },
  );

  it.each(GROUP_FAMILIES)(
    "%s: labelAlign end 가 --form-label-align 을 정의한다 (S2 start · end)",
    (component) => {
      const variant = labelAlignVariant(component);
      expect(Object.keys(variant ?? {})).toEqual(["end"]);
      expect(variant?.end?.styles?.["--form-label-align"]).toBe("end");
    },
  );

  // (TextArea's element is RAC TextField: TextField's sheet places its hints — the rule both
  // consumers read for it, `domStyleRuleType`.)
  it.each(
    SIDE_LABEL_COLUMN_FAMILIES.filter((component) => component !== "TextArea"),
  )(
    "%s: side 는 grid auto · 나머지 두 열 — 도움말 · 오류 문구는 내용과 같은 2열 (내용 아래 줄)",
    (component) => {
      const rule = COMPONENT_RULES_TABLE[component];
      const side = (
        rule?.structure?.composition?.containerVariants as
          | Record<string, Record<string, { styles?: Record<string, string> }>>
          | undefined
      )?.["label-position"]?.side?.styles;
      expect(side?.display).toBe("grid");
      expect(side?.["grid-template-columns"]).toBe("auto minmax(0, 1fr)");
      for (const selector of [
        "> .react-aria-FieldError",
        '> [slot="description"]',
      ]) {
        const hint = sideLabelNested(component).find(
          (n) => n.selector === selector,
        );
        expect(hint, `${component} ${selector}`).toBeDefined();
        expect(hint!.styles["grid-column"]).toBe("2");
      }
    },
  );
});
