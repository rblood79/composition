import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ToggleButton } from "../ToggleButton";
import { ToggleButtonGroup } from "../ToggleButtonGroup";

/** 그룹의 콘텐츠 wrapper와 standalone의 직접 자식 구조를 검증한다. */

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

  it("group 안 ToggleButton 은 indicator와 공유하는 콘텐츠 span으로 래핑", () => {
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
