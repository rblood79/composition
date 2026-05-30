import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  getCatalogCutoverTypes,
  getCatalogEntry,
  getCatalogSkiaCutoverTypes,
} from "../componentCatalog";
import { isCatalogCutover, isCatalogSkiaCutover } from "../cutover";

/**
 * ADR-142 family ⑧(composition-native) — frame/MaskedFrame/Slot 계약 검증.
 *
 * native 는 RAC primitive 도 reusable 문서도 아닌 canonical 일급 노드(FrameNode, ADR-130).
 * **metadata-only 등록 (사용자 결정 2026-05-31)** — binding/reusableId/cutover 없음, cutover
 * 게이트(isCatalogCutover/isCatalogSkiaCutover) 미포함. 렌더는 기존 canonical-native 유지
 * (frame→div generic / Slot renderer). catalog 등록은 팔레트/factory metadata SSOT 통합 목적.
 */

const NATIVE_TYPES = ["frame", "MaskedFrame", "Slot"] as const;

describe("family ⑧ composition-native — metadata-only 등록", () => {
  it("frame/MaskedFrame/Slot 이 native entry (family=composition-native, binding 없음)", () => {
    for (const type of NATIVE_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("native");
      expect(entry?.family).toBe("composition-native");
      // native 는 binding/reusableId/cutover 없음
      expect((entry as { binding?: unknown }).binding).toBeUndefined();
      expect((entry as { cutover?: unknown }).cutover).toBeUndefined();
    }
  });

  it("native 는 getPrimitiveBinding 미등록 (RAC binding 없음)", () => {
    for (const type of NATIVE_TYPES) {
      expect(getPrimitiveBinding(type)).toBeUndefined();
    }
  });

  it("native 는 cutover 게이트(DOM/Skia) 둘 다 제외 — canonical-native 렌더 유지", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of NATIVE_TYPES) {
      expect(domGate.has(type), `${type} NOT in DOM gate`).toBe(false);
      expect(skiaGate.has(type), `${type} NOT in Skia gate`).toBe(false);
      expect(isCatalogCutover(type), `${type} isCatalogCutover`).toBe(false);
      expect(isCatalogSkiaCutover(type), `${type} isCatalogSkiaCutover`).toBe(
        false,
      );
    }
  });

  it("native 도 panel.placeable 메타 보유 (팔레트 등록)", () => {
    for (const type of NATIVE_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry?.panel.placeable).toBe(true);
      expect(typeof entry?.panel.label).toBe("string");
    }
  });
});
