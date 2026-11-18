// @vitest-environment jsdom
/**
 * S2 조작기 묶음 — Color (2026-11-18): S2 1.8.2 `ColorHandle` · `ColorArea` · `ColorSlider` ·
 * `ColorWheel` · `ColorSwatchPicker` 의 장식 겹을 두 consumer 가 같은 값 (`colorHandle.ts`) 으로 그린다.
 * - thumb = 16 · 테두리 2 흰색 · 바깥선 1 `black/42` (rule), 안쪽 고리 1 `black/42`, 투명 색 아래 체커보드;
 * - ColorArea · ColorSlider track · ColorWheel 고리 = 바깥선 1 `gray-1000/10` (offset −1), ColorWheel 안쪽 고리;
 * - ColorSwatchPicker 의 선택 = 항목 안 `div` (테두리 2 gray-900 · 바깥선 2 gray-25 offset −4) — Canvas 도 그린다.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CATALOG_COLOR_CONTROL_OUTLINE,
  getSkiaPrimitive,
  type Shape,
} from "@composition/rendering";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogColorThumbRing } from "../../../../../../packages/shared/src/catalog/runtime/colorControlParts";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const ROOT = "project:node:s2-color-root" as NodeId;

async function open(type: string, props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-color" as const,
        name: "S2 color",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-color-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const of = (partType: string) =>
    [...workspace.root.canvasInputs.values()].filter(
      (record) => workspace.root.typeOf(record) === partType,
    );
  const html = () => {
    const root = workspace.root;
    const dom = [...root.domInputs.values()].find(
      (record) => record.sourceId === ROOT,
    )!;
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, dom.id));
    return host;
  };
  const edit = (patch: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ROOT }],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ),
      }),
    );
  return { workspace, of, html, edit };
}

const draw = (key: string, props: Record<string, unknown>) =>
  (getSkiaPrimitive(key)?.({
    props,
    style: { borderRadius: 4 },
    theme: "light",
  } as never) ?? []) as Shape[];

describe("S2 Color controls — handle, faces, swatch selection", () => {
  it("the ColorThumb rule is S2's handle box: 2px white border, 1px black/42 outline, no shadow", () => {
    expect(catalogColorThumbRing()).toEqual({
      size: 16,
      borderWidth: 2,
      borderColor: "{color.white}",
      outline: { width: 1, color: "#000000", alpha: 0.42 },
    });
  });

  it("the Canvas handle: color, border ring, inner ring inside it, outline outside — the checkerboard only under a translucent color", async () => {
    const { of } = await open("ColorArea", { defaultValue: "#8040c0" });
    const thumb = of("ColorThumb")[0]!;
    const paint = String(thumb.derivedProps?._colorThumb);
    const shapes = draw("color_thumb", {
      _colorThumb: paint,
      _containerWidth: 16,
      _containerHeight: 16,
    });
    const rings = shapes
      .filter((shape) => shape.type === "circle")
      .map((shape) => {
        const circle = shape as Extract<Shape, { type: "circle" }>;
        return [circle.radius, circle.strokeWidth, circle.fillAlpha ?? 1];
      });
    // color + white border (6 ~ 8), inner ring (5 ~ 6), outline (8 ~ 9).
    expect(rings).toEqual([
      [8, 2, 1],
      [6, 1, 0.42],
      [9, 1, 0.42],
    ]);
    expect(shapes.some((shape) => shape.type === "path")).toBe(false);
    const translucent = draw("color_thumb", {
      _colorThumb: JSON.stringify({ ...JSON.parse(paint), color: "#8040c080" }),
      _containerWidth: 16,
      _containerHeight: 16,
    });
    const checker = translucent.find((shape) => shape.type === "path") as
      Extract<Shape, { type: "path" }> | undefined;
    expect(checker?.clip).toEqual({
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      radius: 8,
    });
  });

  it("the Preview handle: the inner ring div and the color over the checkerboard", async () => {
    const { html } = await open("ColorArea", { defaultValue: "#8040c0" });
    const thumb = html().querySelector<HTMLElement>(".react-aria-ColorThumb")!;
    expect(thumb.querySelector(".color-handle-ring")).not.toBeNull();
    expect(thumb.style.background).toContain("repeating-conic-gradient");
  });

  it("the faces' S2 outline: ColorArea, the ColorSlider track (over the checkerboard), the ColorWheel's two rings", async () => {
    const { width, alpha } = CATALOG_COLOR_CONTROL_OUTLINE;
    const area = await open("ColorArea", { defaultValue: "#8040c0" });
    const areaShapes = draw("color_area_fill", {
      _colorGradient: String(
        area.of("ColorArea")[0]!.derivedProps?._colorGradient,
      ),
      _containerWidth: 192,
      _containerHeight: 192,
    });
    const outline = areaShapes.at(-1) as Extract<Shape, { type: "path" }>;
    expect([outline.type, outline.strokeWidth, outline.strokeAlpha]).toEqual([
      "path",
      width,
      alpha,
    ]);
    expect(
      area.html().querySelector<HTMLElement>(".react-aria-ColorArea")!.style
        .outline,
    ).toContain("color-mix");

    const slider = await open("ColorSlider", { channel: "hue" });
    const track = slider
      .of("SliderTrack")
      .find((record) => record.derivedProps?._colorGradient)!;
    const trackShapes = draw("color_slider_track", {
      _colorGradient: String(track.derivedProps?._colorGradient),
      _containerWidth: 192,
      _containerHeight: 24,
    });
    expect(trackShapes.filter((shape) => shape.type === "path")).toHaveLength(
      2,
    ); // the checkerboard's dark squares + the outline
    const domTrack = slider
      .html()
      .querySelector<HTMLElement>(".react-aria-SliderTrack")!;
    expect(domTrack.style.background).toContain("repeating-conic-gradient");
    expect(domTrack.style.outline).toContain("color-mix");
    // S2 `borderRadius: default` (8) on the track, not the SliderTrack rule's pill — both consumers.
    expect(track.visual.radius).toBe(8);
    expect(domTrack.style.borderRadius).toBe("8px");

    const wheel = await open("ColorWheel");
    const ring = wheel.of("ColorWheelTrack")[0]!;
    const gradient = JSON.parse(String(ring.derivedProps?._colorGradient));
    const wheelRings = draw("color_wheel_track", {
      _colorGradient: JSON.stringify(gradient),
      _containerWidth: gradient.outerRadius * 2,
      _containerHeight: gradient.outerRadius * 2,
    })
      .filter((shape) => shape.type === "circle")
      .map((shape) => (shape as Extract<Shape, { type: "circle" }>).radius);
    expect(wheelRings).toEqual([
      gradient.outerRadius,
      gradient.innerRadius + width,
    ]);
    expect(
      wheel
        .html()
        .querySelector(".react-aria-ColorWheel .color-wheel-inner-ring"),
    ).not.toBeNull();
  });

  it("a ColorSwatchPicker's selected swatch: S2's selection div in the Preview, the same ring on the Canvas, following the value", async () => {
    const { of, html, edit, workspace } = await open("ColorSwatchPicker", {
      defaultValue: "#FF0000",
    });
    const selected = () =>
      of("ColorSwatch").map(
        (swatch) => swatch.derivedProps?._swatchSelected === 1,
      );
    expect(selected()).toEqual([true, false, false, false, false, false]);
    const items = html().querySelectorAll(".react-aria-ColorSwatchPickerItem");
    expect(
      [...items].map((item) => !!item.querySelector(".color-swatch-selection")),
    ).toEqual([true, false, false, false, false, false]);
    const root = workspace.root;
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const swatch = of("ColorSwatch")[0]!;
    const strokes = (id: string) =>
      (
        (
          getSkiaNode(id) as unknown as {
            children?: Array<{ type: string; path?: { strokeWidth: number } }>;
          }
        ).children ?? []
      )
        .filter((child) => child.type === "path")
        .map((child) => child.path?.strokeWidth);
    // S2's 1px swatch border on every swatch, the selection's border + outline on the selected one.
    expect(strokes(swatch.id)).toEqual([1, 2, 2]);
    expect(strokes(of("ColorSwatch")[1]!.id)).toEqual([1]);
    expect(
      [...html().querySelectorAll<HTMLElement>(".react-aria-ColorSwatch")].map(
        (el) => el.getAttribute("style") ?? "",
      )[0],
    ).toContain("color-mix");
    canvas.dispose();
    // The picker's value moves the selection (the derived value's dependents).
    const second = of("ColorSwatchPickerItem")[1]!.props.color as string;
    edit({ defaultValue: second });
    expect(selected()).toEqual([false, true, false, false, false, false]);
  });
  it("a ColorSwatch's S2 background: a translucent color over the swatch checkerboard, alpha 0 = the red slash — both consumers", async () => {
    const shapesOf = (color: string) =>
      draw("color_swatch", {
        _swatchColor: color,
        _containerWidth: 32,
        _containerHeight: 32,
      });
    // opaque: the border only
    expect(shapesOf("#ff0000ff").map((shape) => shape.type)).toEqual(["path"]);
    // translucent: checkerboard (light box + dark squares) → the color → the border
    const translucent = shapesOf("#ff000080");
    expect(translucent.map((shape) => shape.type)).toEqual([
      "roundRect",
      "path",
      "roundRect",
      "path",
    ]);
    expect((translucent[2] as Extract<Shape, { type: "roundRect" }>).fill).toBe(
      "#ff000080",
    );
    // (S2 `0% 50%` in the 30px padding box: tiles at x 1 · y 8 — the first drawn one at −15, −8; its dark square from x −7.)
    expect(
      (translucent[1] as Extract<Shape, { type: "path" }>).d.startsWith(
        "M-7 -8h8v8h-8z",
      ),
    ).toBe(true);
    // alpha 0: the slash band only, then the border
    const empty = shapesOf("#ff000000");
    expect(empty.map((shape) => shape.type)).toEqual(["gradient", "path"]);
    const slash = empty[0] as Extract<Shape, { type: "gradient" }>;
    expect(slash.gradient.to).toBe("bottom right");
    expect(slash.gradient.stops.map((stop) => stop.color)).toContain(
      "{color.selection-negative}",
    );

    const dom = async (color: string) =>
      (await open("ColorSwatch", { color }))
        .html()
        .querySelector(".react-aria-ColorSwatch")!
        .getAttribute("style") ?? "";
    expect(await dom("#ff000080")).toContain(
      "repeating-conic-gradient(#e6e6e6",
    );
    expect(await dom("#ff000000")).toContain("to bottom right");
    expect(await dom("#ff0000")).not.toContain("repeating-conic-gradient");
  });
});
