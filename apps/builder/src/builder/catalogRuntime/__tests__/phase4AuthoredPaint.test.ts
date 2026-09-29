import { describe, expect, it } from "vitest";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import {
  applyCatalogAuthoredPaint,
  catalogAuthoredDomStyle,
  catalogCssColorRgba,
  hasCatalogAuthoredPaint,
} from "../authoredStyle";
import { catalogDomStyle } from "../domBinding";
import type { CatalogConsumerNode } from "../compositionRoot";

/**
 * ADR-248 Phase 4a-3: authored paint reaches both consumers from one CSS record — the DOM inline
 * style and the Canvas data converted by the old app's style/fill converters.
 */
const rect = { x: 0, y: 0, width: 100, height: 40 };
const frame = (patch: Partial<CatalogConsumerNode>): CatalogConsumerNode => ({
  id: "n",
  sourceId: "project:node:n",
  definitionId: "lib:definition:frame",
  bindingId: "frame",
  definitionMode: "native",
  parentId: "",
  children: [],
  props: {},
  visual: {},
  layout: {},
  sizing: {},
  placement: undefined,
  slot: undefined,
  name: undefined,
  regions: undefined,
  placeholder: undefined,
  instancePath: ["project:node:n"],
  ...patch,
});
const baseBox = (): SkiaNodeData => ({
  type: "box",
  elementId: "n",
  ...rect,
  visible: true,
  box: { fillColor: Float32Array.of(1, 1, 1, 1), borderRadius: 2 },
});
const close = (actual: ArrayLike<number>, expected: number[]) =>
  expect(Array.from(actual).map((v) => Math.round(v * 1000) / 1000)).toEqual(
    expected,
  );

describe("ADR-248 Phase 4a-3 authored paint", () => {
  it("paints fill layers as a CSS gradient and the same Canvas gradient shader", () => {
    const node = frame({
      fills: [
        {
          kind: "linear-gradient",
          id: "g",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          stops: [
            { color: "#ff0000ff", position: 0 },
            { color: "#0000ffff", position: 1 },
          ],
          rotation: 90,
        },
      ],
    });
    expect(String(catalogAuthoredDomStyle(node).backgroundImage)).toMatch(
      /^linear-gradient\(90deg/,
    );
    const data = applyCatalogAuthoredPaint(node, baseBox(), rect);
    const fill = data.box!.fill as { type: string; colors: Float32Array[] };
    expect(fill.type).toBe("linear-gradient");
    close(fill.colors[0], [1, 0, 0, 1]);
    close(fill.colors[1], [0, 0, 1, 1]);
  });

  it("maps box-shadow, filter-free effects and per-corner radius on both sides", () => {
    const node = frame({
      visual: {
        radius: 2,
        radiusTopLeft: 8,
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
        zIndex: 3,
      },
    });
    const dom = catalogDomStyle(node);
    expect(dom).toMatchObject({
      borderRadius: 2,
      borderTopLeftRadius: "8px",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
      zIndex: 3,
    });
    const data = applyCatalogAuthoredPaint(node, baseBox(), rect);
    expect(data.box!.borderRadius).toEqual([8, 2, 2, 2]);
    const shadow = data.effects!.find(
      (effect) => effect.type === "drop-shadow",
    );
    expect(shadow).toMatchObject({ dx: 0, dy: 2, inner: false });
    close((shadow as { color: Float32Array }).color, [0, 0, 0, 0.25]);
    expect(data.zIndex).toBe(3);
  });

  it("draws per-side border widths as the DOM longhands", () => {
    const node = frame({
      visual: { borderColor: "#112233", borderTopWidth: 2 },
    });
    const dom = catalogDomStyle(node);
    expect(dom).toMatchObject({
      borderStyle: "solid",
      borderColor: "#112233",
      borderWidth: 0,
      borderTopWidth: "2px",
    });
    const data = applyCatalogAuthoredPaint(node, baseBox(), rect);
    expect(data.box!.strokeWidths).toEqual([2, 0, 0, 0]);
    close(
      data.box!.strokeColor!,
      [0x11 / 255, 0x22 / 255, 0x33 / 255, 1].map(
        (v) => Math.round(v * 1000) / 1000,
      ),
    );
  });

  it("reads any authored CSS color, not only #rrggbb", () => {
    close(catalogCssColorRgba("rgba(255, 0, 0, 0.5)"), [1, 0, 0, 0.5]);
    // The old parser quantizes hex8 alpha to 0.5 (DOM: 128/255 ≈ 0.502) — within one 8-bit step.
    close(catalogCssColorRgba("#00ff0080"), [0, 1, 0, 0.5]);
    const node = frame({ visual: { fill: "rgba(255, 0, 0, 0.5)" } });
    expect(catalogDomStyle(node).backgroundColor).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("leaves a node without authored paint untouched", () => {
    const node = frame({ visual: { fill: "#ffffff", radius: 2 } });
    expect(hasCatalogAuthoredPaint(node)).toBe(false);
    const data = baseBox();
    expect(applyCatalogAuthoredPaint(node, data, rect)).toBe(data);
  });

  it("keeps a container's typography out of its own DOM style (inherited source only)", () => {
    const style = catalogDomStyle(
      frame({ visual: { fontFamily: "Inter", letterSpacing: 1 } }),
    );
    expect(style.fontFamily).toBeUndefined();
    expect(style.letterSpacing).toBeUndefined();
  });

});
