import { afterEach, describe, expect, it } from "vitest";

import {
  getLayoutViewport,
  resolveCSSSizeValue,
  setLayoutViewport,
} from "../cssValueParser";
import { parseCSSPropWithContext } from "../sizeProperties";

// vw/vh 기준 = breakpoint page 크기. `calculateFullTreeLayout` 이 run 시작 시 `setLayoutViewport`
// 로 넣는 값이 viewport 인자를 안 넘기는 parse 호출처 (applyCommonEngineStyle →
// parseCSSPropWithContext 등 14곳) 의 폴백이다 — 종전 상수 1920×1080 (2026-09-19).
describe("vw/vh — run-level layout viewport fallback", () => {
  afterEach(() => setLayoutViewport(null));

  it("defaults to 1920×1080 when no layout viewport is set", () => {
    expect(getLayoutViewport()).toEqual({ width: 1920, height: 1080 });
    expect(parseCSSPropWithContext("50vw")).toBe(960);
    expect(parseCSSPropWithContext("25vh")).toBe(270);
  });

  it("resolves vw/vh/vmin/vmax against the breakpoint page size once set", () => {
    setLayoutViewport({ width: 390, height: 844 });
    expect(parseCSSPropWithContext("50vw")).toBe(195);
    expect(parseCSSPropWithContext("25vh")).toBe(211);
    expect(resolveCSSSizeValue("100vmin", {})).toBe(390);
    expect(resolveCSSSizeValue("100vmax", {})).toBe(844);
  });

  it("explicit ctx viewport still wins over the run-level fallback", () => {
    setLayoutViewport({ width: 390, height: 844 });
    expect(resolveCSSSizeValue("50vw", { viewportWidth: 768 })).toBe(384);
  });

  it("clears back to the default with null", () => {
    setLayoutViewport({ width: 390, height: 844 });
    setLayoutViewport(null);
    expect(parseCSSPropWithContext("50vw")).toBe(960);
  });
});
