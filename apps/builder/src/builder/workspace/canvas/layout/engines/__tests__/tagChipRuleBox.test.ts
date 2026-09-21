/**
 * Tag chip rule 상자 = DOM `.react-aria-Tag` 실측 (2026-09-21 사용자 보고 "Label A" 후속).
 *
 * DOM chip (TagGroup.css): `border: 1px solid` · `padding: paddingY paddingX` · line-height · height 없음
 * (auto = lineHeight + paddingY×2 + border×2 = md 30) · font-weight 미선언 (상속 400). 종전 rule 은
 * `height: 28` (border 미포함) · `borderWidth` 없음 · textWeight 없음 (generic 폴백 500) 이라 캔버스 chip 이
 * DOM 보다 2px 낮고 · 2px 좁고 · 글자가 굵었다 (Chocolate DOM 90.6 ↔ layout 90 · 500).
 */
import { describe, expect, it } from "vitest";
import { resolveBorderWidthPx } from "@composition/specs";
import { resolveSkiaRule } from "../../../skia/resolveSkiaVisualRule";

describe("Tag rule sizes — border-box 높이 · borderWidth · textWeight 가 DOM chip 과 같다", () => {
  const rule = resolveSkiaRule("Tag")!;

  it("모든 size: height = lineHeight + paddingY×2 + borderWidth×2", () => {
    for (const [name, size] of Object.entries(rule.sizes)) {
      const s = size as Record<string, number | string>;
      // ADR-227 P3: rule 은 `{border.width.thin}` 토큰, 두 leg 가 활성 테마 px 로 해석 (seed 1)
      expect(s.borderWidth, `${name} borderWidth`).toBe("{border.width.thin}");
      const bw = resolveBorderWidthPx(s.borderWidth);
      expect(bw).toBe(1);
      expect(s.height, `${name} height`).toBe(
        (s.lineHeight as number) + (s.paddingY as number) * 2 + bw * 2,
      );
    }
  });

  it("variant textWeight 400 (DOM 은 font-weight 미선언 → 상속 400)", () => {
    for (const [name, variant] of Object.entries(rule.variants)) {
      expect(
        (variant as { textWeight?: number }).textWeight,
        `${name} textWeight`,
      ).toBe(400);
    }
  });
});
