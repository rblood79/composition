import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * 회귀 방지 — Separator horizontal `width:100%` 주입 (ADR-151 B22, 2026-07-16).
 *
 * **버그**: 수동 Separator.css 가 horizontal(`:not(.vertical)`)에 `width:100%` 를 주지만
 * Skia layout 은 이 채널을 소비하지 않았다. block 부모에서는 fullTreeLayout §5.5 IFC
 * 시뮬레이션 주입이 우연히 같은 값을 만들어 가려졌고, 진짜 flex 부모(예: body
 * display:flex + column + alignItems:flex-start)에서는 게이트가 정확히 제외하면서
 * Skia 폭이 0 으로 붕괴 (CSS 350 vs Skia 0).
 *
 * **해법**: orientation 조건부(vertical 은 width:1px 별도 축)라 catalog top-level
 * containerStyles(무조건부) 채널로 표현 불가 — applyImplicitStyles separator 분기에서
 * horizontal 에 한해 width:100% 주입. 사용자/factory 명시 width 는 항상 우선.
 */

function applySeparator(props: Record<string, unknown>) {
  const el = {
    id: "sep-1",
    type: "Separator",
    props,
    childrenIds: [],
  } as unknown as Element;
  const byId = new Map<string, Element>([[el.id, el]]);
  return applyImplicitStyles(el, [], () => [], byId);
}

function styleOf(result: ReturnType<typeof applyImplicitStyles>) {
  return (result.effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

describe("Separator horizontal width:100% (ADR-151 B22)", () => {
  it("orientation 미지정(=horizontal) + width 미지정 → width:100% 주입", () => {
    expect(styleOf(applySeparator({ style: {} })).width).toBe("100%");
  });

  it("orientation=horizontal 명시 → width:100% 주입", () => {
    expect(
      styleOf(applySeparator({ orientation: "horizontal", style: {} })).width,
    ).toBe("100%");
  });

  it("orientation=vertical → 미주입 (width:1px 축은 별도 계약)", () => {
    expect(
      styleOf(applySeparator({ orientation: "vertical", style: {} })).width,
    ).toBeUndefined();
  });

  it("사용자 명시 width 우선 (Toolbar vertical separator explicit width 패턴)", () => {
    expect(
      styleOf(applySeparator({ style: { width: "1px", height: "20px" } }))
        .width,
    ).toBe("1px");
  });
});
