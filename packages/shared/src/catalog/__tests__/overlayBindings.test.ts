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
 * **ADR-912 단계 5 (1b) + step 1 (2026-06-04) — 5 overlay 전부 Skia generic 발효 (skiaLegacy 0건)**:
 * Popover bg/border buildCatalogShapes + shadow/V-arrow skiaPrimitive(popover_shadow/popover_arrow),
 * Dialog bg + backdrop/shadow(overlay_backdrop/dialog_shadow), Modal transparent shell(primitive 없음),
 * DropZone variant+dashed border 보편 D3 속성, Tooltip bg+text generic + arrow(tooltip_arrow, append).
 * Toast 는 imperative API → 제외.
 */

const OVERLAY_TYPES = [
  "Dialog",
  "Modal",
  "Popover",
  "Tooltip",
  "DropZone",
] as const;

/** Skia generic 발효된 overlay (skiaLegacy 0건 — 5 전부). */
const SKIA_CUTOVER_OVERLAYS = [
  "Popover",
  "Dialog",
  "Modal",
  "DropZone",
  "Tooltip",
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

  it("5 overlay entry 에 skiaLegacy 속성 0건 (단계 5 step 1 — 필드 제거)", () => {
    for (const type of OVERLAY_TYPES) {
      const entry = getCatalogEntry(type);
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy undefined`,
      ).toBeUndefined();
    }
  });

  it("DOM·Skia 게이트 모두 5 overlay 전부 포함 (skiaLegacy 0건)", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of OVERLAY_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
      expect(skiaGate.has(type), `${type} in Skia gate`).toBe(true);
    }
  });

  it("overlay binding 은 internal source. shadow/arrow 패턴 보유 overlay 만 skiaPrimitive", () => {
    for (const type of OVERLAY_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
    }
    // Modal(발효이나 shadow/arrow 없음 — transparent shell) + DropZone(variant 보편 속성) 은 미보유.
    for (const type of ["Modal", "DropZone"]) {
      expect(
        getPrimitiveBinding(type)?.skiaPrimitive,
        `${type} no skiaPrimitive`,
      ).toBeUndefined();
    }
    // shadow/arrow/V-arrow 패턴 보유 발효 overlay.
    expect(getPrimitiveBinding("Popover")?.skiaPrimitive).toEqual([
      "popover_shadow",
      "popover_arrow",
    ]);
    expect(getPrimitiveBinding("Dialog")?.skiaPrimitive).toEqual([
      "overlay_backdrop",
      "dialog_shadow",
    ]);
    // Tooltip — V-arrow(showArrow=true 한정) append escape (단계 5 (1b)).
    expect(getPrimitiveBinding("Tooltip")?.skiaPrimitive).toBe("tooltip_arrow");
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
