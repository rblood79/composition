import { describe, expect, it } from "vitest";

import { isCatalogCutover, resolveComponentRule } from "@composition/shared";
import { resolveSkiaVisualRule } from "./resolveSkiaVisualRule";

/**
 * ADR-912 단계5 (2026-06-18): "table(정본) ← spec(추종) drift 검출" describe 제거.
 *   cutover type 의 spec 은 전수 물리 삭제(spec map 114→3)되어 getSpecForTag(cutoverType)=null →
 *   추종 대상 0 = 검증 무의미(헤더가 예고한 단계5 제거 시점 도달). resolveComponentVisual 함수도
 *   barrel 제외(test-only) → 본 describe 가 유일 builder 측 import 였다.
 */

/**
 * ADR-912 1C — Button size source seam 제거 증명.
 *
 * Button(catalog Skia cutover)의 size 시각값이 **theme rule table(정본)**에서 나오고,
 * ButtonSpec.sizes 를 거치지 않아도 완전한지(paddingX 포함) 검증한다. dispatch
 * 가 catalog rule 의 sizes 를 읽으므로, 본 검증이 통과하면 Button 이 ButtonSpec.sizes 없이
 * 동작함(seam 실제 제거)이 구조적으로 증명된다. (옛 builder 래퍼 `resolveSkiaRule` ·
 * `resolveSkiaCatalogRenderInput` · `ruleSizeToSizeSpec` 은 2026-10-05 옛 레이아웃 경로와 함께 삭제.)
 */
describe("resolveComponentRule — Button size source = theme rule table (ADR-912 1C seam 제거)", () => {
  it("Button 은 catalog cutover (table size 경로 진입 조건)", () => {
    expect(isCatalogCutover("Button")).toBe(true);
  });

  it("table Button size 가 paddingX 를 포함 (1C 이전 완료 — leaf 텍스트 inset base)", () => {
    const rule = resolveComponentRule("Button");
    expect(rule).toBeDefined();
    // 5 size 전부 paddingX 존재 (spec.sizes 4/8/12/16/24 이전).
    const expected: Record<string, number> = {
      XS: 4,
      S: 8,
      M: 12,
      L: 16,
      XL: 24,
    };
    for (const [size, px] of Object.entries(expected)) {
      expect(rule?.sizes[size]?.paddingX).toBe(px);
    }
  });
});

describe("resolveSkiaVisualRule — TokenRef 문자열 보존 (dark mode 반전 runtime 위임)", () => {
  it("adaptive 토큰(`{color.base}` 등)이 변환 없이 string 그대로 전달된다", () => {
    // Badge accent variant 의 fill base 는 TokenRef — resolve(실수값 변환)는 runtime 책임.
    const visual = resolveSkiaVisualRule("Button", "primary");
    const base = visual?.fill?.default.base;
    expect(typeof base).toBe("string");
    // `{color.X}` 형태 보존 (resolveToken 이 light/dark 분기) — 미리 hex 로 변환되면 안 됨.
    if (base) expect(base.startsWith("{")).toBe(true);
  });
});
