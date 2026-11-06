import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  CATALOG_PRESS_TRANSITION,
  catalogPressTransform,
} from "../rule/pressScale";

/** 그룹 콘텐츠의 가로 정렬과 custom indicator에 한정된 내부 press를 검증한다. */
function collectToggleButtonStaticSelectors(): Record<
  string,
  Record<string, string>
> {
  const rule = COMPONENT_RULES_TABLE.ToggleButtonGroup as
    | {
        structure?: {
          composition?: {
            staticSelectors?: Record<string, Record<string, string>>;
          };
        };
      }
    | undefined;
  return rule?.structure?.composition?.staticSelectors ?? {};
}

describe("ToggleButton group `> span` display:inherit 정합 계약", () => {
  it("`.react-aria-ToggleButton > span` staticSelector 가 display:inherit 를 선언", () => {
    const selectors = collectToggleButtonStaticSelectors();
    const spanRule = selectors[".react-aria-ToggleButton > span"];
    expect(spanRule, "ToggleButton `> span` staticSelector 없음").toBeDefined();
    expect(
      spanRule.display,
      "display:inherit 누락 → span 이 block 으로 폴백 → 아이콘+텍스트 세로 쌓임(Skia 비대칭)",
    ).toBe("inherit");
  });

  it("`> span` 은 가로 flex 정렬(align-items/justify-content/gap)을 명시 (flex 비상속 보강)", () => {
    const selectors = collectToggleButtonStaticSelectors();
    const spanRule = selectors[".react-aria-ToggleButton > span"];
    expect(spanRule?.["align-items"]).toBe("center");
    expect(spanRule?.["justify-content"]).toBe("center");
    expect(spanRule?.gap).toBeDefined();
  });

  it("custom indicator만 내부 콘텐츠를 누르고 기본 그룹은 버튼 전체를 누른다", () => {
    const selectors = collectToggleButtonStaticSelectors();
    expect(selectors[".react-aria-ToggleButton > span"]?.transition).toBe(
      CATALOG_PRESS_TRANSITION,
    );
    const pressed =
      '&[data-indicator="true"] .react-aria-ToggleButton[data-pressed]';
    expect(selectors[`${pressed} > span`]?.transform).toBe(
      catalogPressTransform(),
    );
    expect(selectors[`${pressed} > span`]?.scale).toBeUndefined();
    expect(selectors[pressed]?.transform).toBe("none");
    expect(selectors[".react-aria-ToggleButton[data-pressed]"]).toBeUndefined();
  });
});
