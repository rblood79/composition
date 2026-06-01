import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  getCatalogCutoverTypes,
  getCatalogEntry,
  getCatalogSkiaCutoverTypes,
} from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ⑥(overlays) — Dialog/Modal/Popover/Tooltip/DropZone 계약 검증.
 *
 * overlay 는 composition wrapper(OverlayArrow / focus trap / drop 영역 합성, internal source).
 *
 * **Skia 발효 진행 (ADR-142 Inc3, 2026-06-01)**: Popover 는 Skia generic 발효됨 — bg/border 는
 * buildCatalogShapes(box+text), shadow/V-arrow 는 skiaPrimitive(popover_shadow/popover_arrow)
 * 합성. 나머지 4 overlay(Dialog/Modal/Tooltip/DropZone)는 보강 대기로 skiaLegacy:true 유지
 * (Dialog/DropZone variant 보강 / Tooltip text source / Modal). Toast 는 imperative API → 제외.
 */

const OVERLAY_TYPES = [
  "Dialog",
  "Modal",
  "Popover",
  "Tooltip",
  "DropZone",
] as const;

/** Skia generic 발효된 overlay (skiaLegacy 제거됨). */
const SKIA_CUTOVER_OVERLAYS = ["Popover"] as const;
/** Skia 미발효(skiaLegacy:true) — 보강 대기. */
const SKIA_LEGACY_OVERLAYS = [
  "Dialog",
  "Modal",
  "Tooltip",
  "DropZone",
] as const;

describe("family ⑥ overlays — catalog 등록 + cutover 상태", () => {
  it("5 overlay 가 catalog primitive entry (family=overlays, cutover=catalog)", () => {
    for (const type of OVERLAY_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("overlays");
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe(
        "catalog",
      );
    }
  });

  it("Skia 미발효 4 overlay 는 skiaLegacy:true, 발효된 Popover 는 미설정", () => {
    for (const type of SKIA_LEGACY_OVERLAYS) {
      const entry = getCatalogEntry(type);
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy`,
      ).toBe(true);
    }
    for (const type of SKIA_CUTOVER_OVERLAYS) {
      const entry = getCatalogEntry(type);
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy 제거됨`,
      ).toBeUndefined();
    }
  });

  it("DOM 게이트는 5 overlay 전부, Skia 게이트는 발효된 Popover 만", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of OVERLAY_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
    }
    for (const type of SKIA_CUTOVER_OVERLAYS) {
      expect(skiaGate.has(type), `${type} in Skia gate`).toBe(true);
    }
    for (const type of SKIA_LEGACY_OVERLAYS) {
      expect(skiaGate.has(type), `${type} NOT in Skia gate`).toBe(false);
    }
  });

  it("overlay binding 은 internal source. skiaPrimitive 는 발효 overlay 만 보유", () => {
    for (const type of OVERLAY_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
    }
    for (const type of SKIA_LEGACY_OVERLAYS) {
      expect(
        getPrimitiveBinding(type)?.skiaPrimitive,
        `${type} no skiaPrimitive`,
      ).toBeUndefined();
    }
    // Popover 는 shadow/arrow 패턴 키 배열 보유.
    expect(getPrimitiveBinding("Popover")?.skiaPrimitive).toEqual([
      "popover_shadow",
      "popover_arrow",
    ]);
  });

  it("Toast 는 catalog 미등록 (imperative API, placeable 아님)", () => {
    expect(getCatalogEntry("Toast")).toBeUndefined();
  });

  it("toRacProps: Dialog size data-* + isDismissable 통과", () => {
    const result = toRacProps(
      {
        id: "dlg1",
        type: "Dialog",
        props: { size: "lg", isDismissable: true },
      },
      getPrimitiveBinding("Dialog")!,
    );
    expect(result["data-size"]).toBe("lg");
    expect(result.isDismissable).toBe(true);
  });

  it("toRacProps: Popover hideArrow 통과 + size default", () => {
    const result = toRacProps(
      { id: "pop1", type: "Popover", props: { hideArrow: true } },
      getPrimitiveBinding("Popover")!,
    );
    expect(result.hideArrow).toBe(true);
    expect(result["data-size"]).toBe("md");
  });
});
