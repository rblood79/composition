import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluateConditionTree } from "../rule/conditionTree";
import { SEGMENTED_INDICATOR_BORDER } from "../rule/segmentedControl";

describe("S2 1.8.2 SegmentedControl의 기본 시각 계약", () => {
  it("orientation 조립도 루트의 neutral-surface 배경을 생성한다", () => {
    const rule = COMPONENT_RULES_TABLE.SegmentedControl;
    expect(rule.structure?.composition?.rootPaint).toBe("variant");
    const css = readFileSync(
      new URL(
        "../../components/styles/generated/SegmentedControl.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(css).toContain("background: var(--neutral-surface)");
  });

  it("항목은 고정 control 높이와 locale별 행간, regular 글자를 쓴다", () => {
    const rule = COMPONENT_RULES_TABLE.SegmentedControlItem;
    expect(rule.sizes.M).toMatchObject({
      height: 32,
      paddingY: 0,
      fontWeight: 400,
    });
    expect(rule.localeTypography).toEqual(
      COMPONENT_RULES_TABLE.Label.localeTypography,
    );
    const css = readFileSync(
      new URL(
        "../../components/styles/generated/SegmentedControlItem.css",
        import.meta.url,
      ),
      "utf8",
    );
    expect(css).toContain(
      "height: calc(var(--catalog-token-size-unit) * 32 / 1)",
    );
    expect(css).toContain("font-weight: 400");
  });

  it("선택·disabled 색상과 focus-visible 표시는 각각의 S2 역할을 쓴다", () => {
    const rule = COMPONENT_RULES_TABLE.SegmentedControlItem;
    expect(
      evaluateConditionTree(rule.variants.default.paint.color, {
        isSelected: true,
      }),
    ).toBe("{color.neutral-content}");
    expect(
      evaluateConditionTree(rule.variants.default.paint.color, {
        isSelected: true,
        isDisabled: true,
      }),
    ).toBe("{color.disabled-content}");
    expect(
      rule.partStateStyles?.["&% .react-aria-SelectionIndicator"]?.[
        "border-color"
      ],
    ).toEqual(SEGMENTED_INDICATOR_BORDER);
    expect(rule.structure?.stateStyles?.outline).toMatchObject({
      default: "none",
      isFocusVisible: {
        default: "var(--focus-ring-width) solid var(--focus-ring)",
      },
    });
  });
});
