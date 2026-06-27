import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ToggleButton group `> span` display:inherit 회귀 방지 (2026-06-27).
 *
 * **근본 원인**: group 안 ToggleButton 의 자식은 `ToggleButton.tsx` 가
 *   `<span>{children}</span>` 으로 감싼다(pressed micro-interaction `> span { scale:0.9 }` 소비).
 *   그러나 그 span 에 display 가 지정되지 않으면 기본 `display:block` 이라, 아이콘+텍스트
 *   ToggleButton 의 자식(Icon div + Text span)이 **세로로 쌓여**(block flow) 렌더된다. Skia 는
 *   span 을 모르고 ToggleButton(flex)가 Icon/Text 를 **가로 배치**하므로 CSS↔Skia 비대칭이었다.
 *
 * **수정**: COMPONENT_RULES_TABLE.ToggleButtonGroup.containerVariants...staticSelectors 의
 *   `.react-aria-ToggleButton > span` 에 `display:inherit`(부모 ToggleButton 의 flex/inline-flex
 *   상속) + flex 정렬(align-items/justify-content/gap) 을 추가 → span 이 flex 가 되어 Icon/Text
 *   가로 배치 → Skia 와 정합.
 *
 * **계약**: ToggleButtonGroup rule 의 `> span` staticSelector 는 display:inherit 와
 *   가로 flex 정렬 키를 보유해야 한다. (스칼라 selector 키는 generate-css 가 그대로 emit →
 *   ToggleButtonGroup.css 의 group-scoped `> span` 규칙으로 반영.)
 */

/**
 * ToggleButtonGroup rule 의 staticSelectors 를 반환한다.
 *   경로: COMPONENT_RULES_TABLE.ToggleButtonGroup.structure.composition.staticSelectors
 *   (group-scoped pressed micro-interaction + `> span` 정합 규칙이 위치하는 곳).
 */
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

  it("pressed micro-interaction(`scale:0.9`)은 보존 (display 추가가 기존 효과 제거하지 않음)", () => {
    const selectors = collectToggleButtonStaticSelectors();
    expect(selectors[".react-aria-ToggleButton > span"]?.transition).toBe(
      "scale 200ms",
    );
    expect(
      selectors[".react-aria-ToggleButton[data-pressed] > span"]?.scale,
    ).toBe("0.9");
    expect(selectors[".react-aria-ToggleButton[data-pressed]"]?.transform).toBe(
      "none",
    );
  });
});
