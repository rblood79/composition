import { describe, expect, it } from "vitest";

import { isCatalogCutover, isCatalogSkiaCutover } from "../cutover";
import { getCatalogEntry } from "../componentCatalog";
import { getPrimitiveBinding } from "../bindings";

/**
 * ADR-912 6 registry collapse — Color leaf 5종 box-only catalog cutover oracle (RED→GREEN).
 *
 * 배경(사용자 방침 2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 ColorWheel(react-aria
 * 레퍼런스) 처럼 ProgressCircle 구조로 진짜 구현할 예정. 지금은 **spec 제거 + catalog cutover
 * 등록(6 registry collapse 진척)** 만을 위해 "box 컨테이너 기능(영역 크기)만 가진 형태" 로 등록한다.
 *
 * 대상 leaf 5종: ColorSwatch / ColorArea / ColorWheel / ColorSlider / TailSwatch.
 *   - 시각: generic buildCatalogShapes(box 영역) 가 담당. 동적 색(props.color) / gradient /
 *     wheel / thumb 등 정교한 color UI 는 **의도적 손실**(box-only). escape 없음.
 *   - source: RAC primitive(Swatch/Area/Wheel/Slider) 이나 box-only 등록이라 binding 은 메타
 *     (props accepts)만 — 시각은 catalog generic. TailSwatch 는 ColorPicker alias placeholder.
 *
 * 기존 색 제외 lock(cutover.test.ts "color 는 cutover 제외") 은 본 방침 전환으로 ColorWheel 을
 * 제외 명단에서 제거(box-only cutover 로 전환). TailSwatch/ColorPicker 는 별도 처리 유지.
 *
 * 본 oracle 은 spec 물리 삭제와 직교 — 삭제는 통과 후 별도 gate.
 */

const COLOR_LEAF_5 = [
  "ColorSwatch",
  "ColorArea",
  "ColorWheel",
  "ColorSlider",
  "TailSwatch",
] as const;

describe("ADR-912 — Color leaf 5종 box-only catalog cutover", () => {
  for (const type of COLOR_LEAF_5) {
    it(`RED — ${type} 가 catalog entry 로 등록 (primitive)`, () => {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry 미등록`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
    });

    it(`RED — ${type} binding 보유 (getPrimitiveBinding)`, () => {
      const binding = getPrimitiveBinding(type);
      expect(binding, `${type} binding 미등록`).toBeDefined();
    });

    it(`RED — ${type} 가 isCatalogCutover / isCatalogSkiaCutover 게이트 통과 (box-only)`, () => {
      expect(isCatalogCutover(type)).toBe(true);
      expect(isCatalogSkiaCutover(type)).toBe(true);
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
