import { describe, it, expect } from "vitest";
import { shadows, parseShadow } from "../shadows";

/**
 * Box-shadow 프리셋 값 계약 + inset 파싱.
 *
 * 사용자 요청(2026-07-23): inset 프리셋 blur 4→8px, color rgba(0,0,0,0.05)→0.16.
 * inset 프리셋은 Skia 에서 renderInnerBoxShadows(nodeRendererBorders)가 box RRect
 * 지오메트리로 직접 그리며(effects.ts 는 inner drop-shadow skip), 그 입력이 되는
 * parseShadow(styleConverter parseOneShadow 도 동형)의 inset:true / blur / alpha 를 잠근다.
 */
describe("shadows — inset 프리셋 값 계약", () => {
  it("inset 프리셋 = 'inset 0 2px 8px 0 rgba(0, 0, 0, 0.16)'", () => {
    expect(shadows.inset).toBe("inset 0 2px 8px 0 rgba(0, 0, 0, 0.16)");
  });

  it("parseShadow(inset) → inset:true, offsetY 2, blur 8, alpha 0.16", () => {
    const [s] = parseShadow(shadows.inset);
    expect(s.inset).toBe(true);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(2);
    expect(s.blur).toBe(8);
    expect(s.alpha).toBe(0.16);
  });

  it("outer 프리셋(xl)은 inset:false (회귀 가드)", () => {
    const parsed = parseShadow(shadows.xl);
    expect(parsed.every((s) => s.inset === false)).toBe(true);
  });
});
