import { describe, expect, it } from "vitest";

import { applyImplicitStyles } from "./implicitStyles";
import type { CanvasLayoutNode } from "../layoutNode";

/**
 * ToggleButtonGroup density → 그룹 gap 주입 (2026-08-21).
 *
 * Spectrum ActionGroup 규정: "compact density retains the same font and icon sizes, but has
 * tighter spacing. **The action buttons also become connected**." 연결(코너 radius + `-1px`
 * 겹침)은 Skia 쪽에서 `resolveSegmentedRadius` 가 `_groupPosition.density` 로 판정하고
 * (specs `buildCatalogShapes.segmentedRadius.test.ts`), **간격 성분**은 여기서 주입한다.
 *
 * catalog `containerVariants` 로는 안 되는 이유 — Skia 소비(`resolveActiveContainerVariants`)가
 * 결과 styles 를 layout 값으로 적용하지 않고 side-label 모드 판정에만 쓴다. gap 을 거기 두면
 * DOM 만 반영되고 Skia 는 무시해 즉시 비대칭이 된다.
 */

const node = (
  id: string,
  type: string,
  parentId: string | null,
  props: Record<string, unknown> = {},
): CanvasLayoutNode =>
  ({
    id,
    type,
    page_id: "page-1",
    parent_id: parentId,
    props,
  }) as unknown as CanvasLayoutNode;

function groupStyle(props: Record<string, unknown>) {
  const group = node("g-1", "ToggleButtonGroup", "body", props);
  const a = node("b-1", "ToggleButton", "g-1", { children: "A" });
  const b = node("b-2", "ToggleButton", "g-1", { children: "B" });
  const elementById = new Map<string, CanvasLayoutNode>([
    ["g-1", group],
    ["b-1", a],
    ["b-2", b],
  ]);
  const result = applyImplicitStyles(group, [a, b], () => [], elementById);
  return (result.effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

describe("ToggleButtonGroup density → gap 주입", () => {
  it("기본(미지정)은 Spectrum default regular — gap 8 로 버튼이 분리된다", () => {
    expect(groupStyle({}).gap).toBe(8);
  });

  it("compact 는 gap 0 — 연결 bar", () => {
    expect(groupStyle({ density: "compact" }).gap).toBe(0);
  });

  it("regular 명시도 같은 값", () => {
    expect(groupStyle({ density: "regular" }).gap).toBe(8);
  });

  it("orientation 처리와 함께 적용된다 — 두 주입이 서로를 덮지 않는다", () => {
    const vertical = groupStyle({
      density: "compact",
      orientation: "vertical",
    });
    expect(vertical.flexDirection).toBe("column");
    expect(vertical.gap).toBe(0);
  });

  it("알 수 없는 density 는 주입 없음 — 임의 문자열이 간격을 만들지 않는다", () => {
    expect(groupStyle({ density: "cozy" }).gap).toBeUndefined();
  });
});
