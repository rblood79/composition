/**
 * ADR-227 Phase 3 — DropZone 의 border 폭은 catalog `sizes.*.borderWidth = {border.width.thick}` 가 정본이다.
 * 종전 기본 props.style 에 `borderWidth: "2px"` 인라인이 있어 (레이아웃 엔진이 border 를 읽게 하려던 미러)
 * 테마 thick 이 두 leg 모두에 닿지 않았다 (인라인 우선). 인라인을 빼면 layout 은 implicit 주입 (활성 테마 px),
 * DOM 은 생성 CSS `border-width: var(--border-width-thick)` 로 같은 값을 읽는다.
 */
import { afterEach, describe, expect, it } from "vitest";
import { borderWidth } from "@composition/specs";
import { resolveContainerStylesFallback } from "../implicitStyles";
import { createDefaultDropZoneProps } from "../../../../../../types/builder/unified.types";

describe("DropZone border — 테마 thick read-through (ADR-227 P3)", () => {
  const seed = borderWidth.thick;
  afterEach(() => {
    borderWidth.thick = seed;
  });

  it("기본 props.style 에 borderWidth 인라인이 없다 (테마 축이 닿도록)", () => {
    const style = createDefaultDropZoneProps().style as Record<string, unknown>;
    expect(style.borderWidth).toBeUndefined();
  });

  it("layout implicit 주입 — 인라인 없으면 thick (seed 2) · 테마 thick=4 면 4", () => {
    const style = createDefaultDropZoneProps().style as Record<string, unknown>;
    expect(
      resolveContainerStylesFallback("dropzone", style, "md").borderWidth,
    ).toBe(2);
    borderWidth.thick = 4;
    expect(
      resolveContainerStylesFallback("dropzone", style, "md").borderWidth,
    ).toBe(4);
  });
});
