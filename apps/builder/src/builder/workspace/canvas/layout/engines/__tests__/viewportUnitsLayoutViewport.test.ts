import { describe, expect, it } from "vitest";

import { resolveCSSSizeValue } from "../cssValueParser";

// vw/vh 기준: ctx 의 viewport, 없으면 상수 1920×1080. run 단위 폴백 (`setLayoutViewport`) 은
// 그것을 넣던 `calculateFullTreeLayout` 과 함께 삭제됐다 (2026-10-05) — production 레이아웃
// 입력은 `compositionRoot.ts` `styleOf` 가 만들고 엔진이 viewport 를 받는다.
describe("vw/vh — viewport fallback", () => {
  it("defaults to 1920×1080 without a ctx viewport", () => {
    expect(resolveCSSSizeValue("50vw", {})).toBe(960);
    expect(resolveCSSSizeValue("25vh", {})).toBe(270);
  });

  it("an explicit ctx viewport wins", () => {
    expect(resolveCSSSizeValue("50vw", { viewportWidth: 768 })).toBe(384);
    expect(
      resolveCSSSizeValue("100vmin", {
        viewportWidth: 390,
        viewportHeight: 844,
      }),
    ).toBe(390);
  });
});
