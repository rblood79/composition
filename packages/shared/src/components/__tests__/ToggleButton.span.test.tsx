import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ToggleButton } from "../ToggleButton";
import { ToggleButtonGroup } from "../ToggleButtonGroup";

/**
 * ToggleButton 내부 <span> wrapper 의 조건부 렌더 회귀 테스트 (2026-06-27).
 *
 * **근본 원인**: ToggleButton 은 showIndicator/group 멤버십과 무관하게 항상
 *   `<span>{children}</span>` 을 렌더했다. 그러나 span 을 소비하는 CSS selector
 *   (`.react-aria-ToggleButtonGroup .react-aria-ToggleButton[data-pressed] > span { scale: 0.9 }`)
 *   는 **group 안** ToggleButton 에만 존재한다. composition generated standalone
 *   ToggleButton.css 에는 `> span` 규칙이 전혀 없어(reference starter 의 flex/svg 규칙 미emit)
 *   standalone ToggleButton 의 span 은 소비처 없는 dead wrapper 였다.
 *
 * **계약**:
 *   - standalone ToggleButton → span 없음 (children 직접 자식)
 *   - group 안 ToggleButton → span 있음 (pressed micro-interaction selector 소비)
 *
 * react-dom/server renderToStaticMarkup 으로 정적 DOM 출력을 직접 검사한다.
 */

/** .react-aria-ToggleButton 직계 자식으로 <span> 이 있는지 (단순 substring 검사). */
function hasSpanChild(html: string): boolean {
  return /class="[^"]*react-aria-ToggleButton[^"]*"[^>]*>\s*<span/.test(html);
}

describe("ToggleButton — 조건부 span wrapper", () => {
  it("standalone ToggleButton 은 span 없이 children 직접 렌더", () => {
    const html = renderToStaticMarkup(<ToggleButton>Label</ToggleButton>);
    expect(html).toContain("react-aria-ToggleButton");
    expect(html).toContain("Label");
    expect(hasSpanChild(html)).toBe(false);
  });

  it("group 안 ToggleButton 은 span 으로 children 래핑 (micro-interaction 보존)", () => {
    const html = renderToStaticMarkup(
      <ToggleButtonGroup>
        <ToggleButton id="a">Label</ToggleButton>
      </ToggleButtonGroup>,
    );
    expect(html).toContain("react-aria-ToggleButton");
    expect(html).toContain("Label");
    expect(hasSpanChild(html)).toBe(true);
  });
});
