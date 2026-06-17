import { describe, expect, it } from "vitest";

import { isCatalogCutover } from "../cutover";
import { getCatalogEntry } from "../componentCatalog";
import { getPrimitiveBinding } from "../bindings";

/**
 * ADR-912 6 registry collapse — T1 Field catalog cutover oracle (RED→GREEN).
 *
 * 배경: catalog 미등록 spec 23종 cutover 의 첫 slice. T1 3종(Field/TailSwatch/ColorSwatch)
 * 중 사용자 정정(2026-06-11)으로 **Field 1종만** 이 slice 대상:
 *   - TailSwatch / ColorSwatch: 이 slice(T1) 시점엔 color 제외였으나, 사용자 방침 전환(2026-06-11)
 *     으로 color leaf 5종이 box-only catalog cutover 로 전환됨(colorLeafCutover.test.ts). 동적 색은
 *     의도적 손실(generic box), arc/wheel 정교 시각은 빌더 완성 후 별도 복원.
 *   - Field: render.shapes `() => []`(Skia 0) → escape 불필요, generic 0 shape. 즉시 가능.
 *
 * Field 형태: palette 미노출(placeable 아님, 데이터 매핑 internal) + DOM 은
 * rendererMap.Field=renderDataField 위임 유지 + Skia 0 shape. catalog 등록 목적은
 * isCatalogSkiaCutover 게이트(buildSpecNodeData) 통과 — spec 삭제 후에도 Skia 가 빈 노드
 * (shapes []) 를 정상 처리하도록.
 *
 * 본 oracle 은 spec 물리 삭제와 직교 — 삭제는 통과 후 별도 gate(불변식 A / universe).
 */
describe("ADR-912 T1 — Field catalog cutover", () => {
  it("RED #1 — Field 가 catalog entry 로 등록 (primitive)", () => {
    const entry = getCatalogEntry("Field");
    expect(entry, "Field catalog entry 미등록").toBeDefined();
    expect(entry?.kind).toBe("primitive");
  });

  it("RED #1 — Field binding 보유 (getPrimitiveBinding)", () => {
    const binding = getPrimitiveBinding("Field");
    expect(binding, "Field binding 미등록").toBeDefined();
    // Field 는 internal source (데이터 매핑 div, RAC controller 없음).
    expect(binding?.source.kind).toBe("internal");
  });

  it("RED #1 — Field 가 isCatalogCutover 게이트 통과", () => {
    expect(isCatalogCutover("Field")).toBe(true);
  });

  it("RED #1 — Field panel placeable=true 이나 palette 미노출은 ComponentList overlay 가 결정 (catalog entry 는 등록)", () => {
    // catalog entry 의 panel 은 metadata. 실제 palette 노출은 ComponentList getPaletteItems
    // (catalog panel + overlay)가 결정 — Field 는 데이터 매핑 internal 이라 PALETTE 에서 별도
    // 처리. 여기서는 catalog entry 의 panel metadata 존재만 고정.
    const entry = getCatalogEntry("Field");
    expect(entry?.kind === "primitive" ? entry.panel : undefined).toBeDefined();
  });
});
