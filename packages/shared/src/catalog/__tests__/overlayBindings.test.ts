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
 * portal/overlay 비-box 시각(arrow svg / dashed drop)은 Skia generic 미확정 → DOM-only cutover
 * (skiaLegacy:true). Toast 는 imperative API(placeable 노드 아님) → catalog 제외.
 */

const OVERLAY_TYPES = [
  "Dialog",
  "Modal",
  "Popover",
  "Tooltip",
  "DropZone",
] as const;

describe("family ⑥ overlays — catalog 등록 + DOM-only cutover", () => {
  it("5 overlay 가 catalog primitive entry (family=overlays, cutover=catalog, skiaLegacy)", () => {
    for (const type of OVERLAY_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("overlays");
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe("catalog");
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy`,
      ).toBe(true);
    }
  });

  it("DOM 게이트는 5 overlay 포함, Skia 게이트는 제외", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of OVERLAY_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
      expect(skiaGate.has(type), `${type} NOT in Skia gate`).toBe(false);
    }
  });

  it("overlay binding 은 internal source (composition wrapper) + skiaPrimitive 없음", () => {
    for (const type of OVERLAY_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
      expect(
        binding?.skiaPrimitive,
        `${type} no skiaPrimitive`,
      ).toBeUndefined();
    }
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
