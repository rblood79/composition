import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  calculateContentHeight,
  calculateContentWidth,
  enrichWithIntrinsicSize,
} from "../utils";

/**
 * ADR-923 Phase 3 r20 sweep — button 가족 (Button/Menu trigger) 의 빈 글자.
 *
 * r19 가 Preview 의 "Button"/"Menu" 기본 글자를 지우자 세 표면이 처음으로 같은 "" 에 도달했고,
 * live (Chrome MCP, 2026-09-02) 에서 Menu trigger 가 DOM 68×10 vs Skia 106×30 으로 갈렸다.
 * 원천 3 (layout `utils.ts`): ① `deriveSizeConfig` 가 catalog `sizes.minWidth` 를 버려 글자 있는
 * 버튼도 DOM `min-width` 68 을 못 따랐다 (54) ② 빈 글자는 size 분기 밖 `DEFAULT_WIDTH` 80 ③ 빈
 * 글자도 lineHeight 20 줄 상자. Chrome: `display:flex` button 에 내용이 없으면 padding + border 뿐
 * (min-height 없음), 폭은 `min-width` (border-box). 실 CSS 오라클은 `tests/parity/
 * catalogComponentBox.browser.test.ts` Button 케이스.
 */
const node = (type: string, props: Record<string, unknown>): CanvasLayoutNode =>
  ({ id: `${type}-r20`, type, props }) as CanvasLayoutNode;

const enrichSize = (el: CanvasLayoutNode) => {
  const out = enrichWithIntrinsicSize(el, 400, 0, undefined, [], () => []);
  const style = out.props?.style as Record<string, unknown> | undefined;
  return {
    w: style?.width as number | undefined,
    h: style?.height as number | undefined,
  };
};

// catalog Button md: minWidth 68 · paddingX 12 · paddingY 4 · borderWidth 1 · lineHeight 20.
const MIN_W = 68;
const EMPTY_H = 4 + 4 + 1 + 1;

describe("ADR-923 r20 sweep — button 가족 빈 글자 = min-width × (padding + border)", () => {
  it("Button / Menu: 계약 결과 '' (children '' · label '' · 부재) → 68 × 10 (종전 106 × 30)", () => {
    for (const el of [
      node("Button", { children: "" }),
      node("Button", {}),
      node("Menu", { label: "", children: "" }),
      node("Menu", {}),
    ]) {
      expect(calculateContentHeight(el, 400), el.type).toBe(0);
      expect(enrichSize(el), `${el.type} ${JSON.stringify(el.props)}`).toEqual({
        w: MIN_W,
        h: EMPTY_H,
      });
    }
  });

  it("글자 있음: 짧은 글자는 catalog minWidth 68 (종전 54 — minWidth 가 버려졌다), 긴 글자는 글자 폭", () => {
    expect(enrichSize(node("Button", { children: "OK" })).w).toBe(MIN_W);
    expect(enrichSize(node("Menu", { label: "Menu" })).w).toBe(MIN_W);
    const long = enrichSize(
      node("Button", { children: "Save all changes now" }),
    );
    expect(long.w).toBeGreaterThan(MIN_W);
    expect(long.h).toBe(30);
  });

  it("아이콘·pending 은 내용 — 줄 상자 유지 (icon-only 폭은 §2.5 별도 축, 관찰 r20)", () => {
    const iconOnly = node("Button", { children: "", iconName: "Plus" });
    expect(calculateContentHeight(iconOnly, 400)).toBeGreaterThan(0);
    expect(calculateContentWidth(iconOnly)).toBeGreaterThan(0);
    expect(
      calculateContentHeight(
        node("Button", { children: "", isPending: true }),
        400,
      ),
    ).toBeGreaterThan(0);
  });

  it("input 은 내용 없이도 줄 상자 (제외)", () => {
    expect(calculateContentHeight(node("Input", {}), 400)).toBeGreaterThan(0);
  });
});
