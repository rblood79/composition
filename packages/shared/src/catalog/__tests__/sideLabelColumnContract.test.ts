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
 * CheckboxGroup/RadioGroup 은 **제외**가 정본이다 — 그 패밀리는 side 에서도 라벨 자연폭을
 * 쓰기로 이미 정리됐다(implicitStyles "width 강제 없음"). 목록에 넣으면 그 결정이 뒤집힌다.
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
] as const;

const NATURAL_WIDTH_LABEL_FAMILIES = ["CheckboxGroup", "RadioGroup"] as const;

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
    "%s: side 모드 라벨이 --form-label-width 컬럼 + --form-label-align 정렬을 받는다",
    (component) => {
      const labelRule = sideLabelNested(component).find((n) =>
        n.selector.includes(".react-aria-Label"),
      );
      expect(labelRule, `${component} side label nested rule`).toBeDefined();
      expect(labelRule!.styles.width).toBe("var(--form-label-width, 11rem)");
      expect(labelRule!.styles["flex-shrink"]).toBe("0");
      expect(labelRule!.styles["text-align"]).toBe(
        "var(--form-label-align, start)",
      );
    },
  );

  it.each(SIDE_LABEL_COLUMN_FAMILIES)(
    "%s: labelAlign 이 --form-label-align 을 정의한다 (center/end)",
    (component) => {
      const variant = labelAlignVariant(component);
      expect(variant?.center?.styles?.["--form-label-align"]).toBe("center");
      expect(variant?.end?.styles?.["--form-label-align"]).toBe("end");
    },
  );

  it.each(NATURAL_WIDTH_LABEL_FAMILIES)(
    "%s: 라벨 자연폭 정본 유지 — 고정폭 컬럼 rule 없음",
    (component) => {
      const labelRule = sideLabelNested(component).find((n) =>
        n.selector.includes(".react-aria-Label"),
      );
      expect(labelRule).toBeUndefined();
    },
  );
});
