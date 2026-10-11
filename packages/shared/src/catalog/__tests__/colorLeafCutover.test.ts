import { describe, expect, it } from "vitest";

import { isCatalogCutover } from "../cutover";
import { getCatalogEntry } from "../componentCatalog";
import { getPrimitiveBinding } from "../bindings";

/**
 * ADR-912 6 registry collapse — Color 계열 4종의 catalog 등록 oracle.
 *
 * 대상: ColorSwatch / ColorArea / ColorWheel / ColorSlider (TailSwatch 는 2026-10-09 삭제 — 어떤
 * 원본도 쓰지 않던 type, 사용자 승인).
 *   - ColorSwatch: 자기 색 상자 (generic buildCatalogShapes).
 *   - ColorArea · ColorSlider · ColorWheel (ADR-258, 2026-10-12): RAC 레퍼런스 노드 트리 (원본
 *     template — ColorThumb · ColorWheelTrack · SliderTrack 부품). 그라데이션 · thumb 는 문서 값의
 *     함수 (`runtime/colorControlGradient.ts`) 를 Canvas primitive 와 RAC 가 같이 따른다 — 옛
 *     「box 영역만 · 의도적 손실」 등록 (2026-06-11) 을 대체했다.
 * ColorPicker/ColorSwatchPicker 는 별도 color container proof 로 처리.
 */

const COLOR_LEAVES = [
  "ColorSwatch",
  "ColorArea",
  "ColorWheel",
  "ColorSlider",
] as const;

describe("ADR-912 — Color 계열 4종 catalog 등록", () => {
  for (const type of COLOR_LEAVES) {
    it(`RED — ${type} 가 catalog entry 로 등록 (primitive)`, () => {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry 미등록`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
    });

    it(`RED — ${type} binding 보유 (getPrimitiveBinding)`, () => {
      const binding = getPrimitiveBinding(type);
      expect(binding, `${type} binding 미등록`).toBeDefined();
    });

    it(`RED — ${type} 가 isCatalogCutover 게이트 통과`, () => {
      expect(isCatalogCutover(type)).toBe(true);
    });

    it(`RED — ${type} panel metadata 보유 (placeable 등록)`, () => {
      const entry = getCatalogEntry(type);
      expect(
        entry?.kind === "primitive" ? entry.panel : undefined,
        `${type} panel metadata 누락`,
      ).toBeDefined();
    });
  }
});
