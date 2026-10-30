// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ColorArea,
  ColorSlider,
  ColorThumb,
  ColorWheel,
  ColorWheelTrack,
  Label,
  SliderOutput,
  SliderTrack,
} from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-258 Phase 2 (E1) — a ColorArea · ColorSlider · ColorWheel draws its node tree, the reference
 * structure (react-aria.adobe.com ColorArea · ColorSlider · ColorWheel): `ColorArea > ColorThumb`,
 * `ColorSlider > Label + SliderOutput + SliderTrack > ColorThumb`, `ColorWheel > ColorWheelTrack +
 * ColorThumb`. RAC writes the gradients, the thumb's place and color, the channel name and value.
 */
const BODY = "project:node:home-body" as NodeId;
const CONTROL = "project:node:control" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(origin: string, props: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr258-tree" as EntryId<"project">,
        name: "Color",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr258-tree-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: CONTROL,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [CONTROL],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const control = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === CONTROL)!;
  const part = (type: string) =>
    [...root.domInputs.values()].find((record) => root.typeOf(record) === type);
  const html = () => renderToStaticMarkup(renderCatalogDom(root, control().id));
  const edit = (patch: Record<string, string | number | boolean>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: CONTROL }],
        props: Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { workspace, root, control, part, html, edit };
}

/** Tag · class · role · aria · inline background/left/top · text — the reference's surface. */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) =>
        /^(role|slot|class|type|aria-(?!labelledby|describedby|controls).*)$/.test(
          attribute.name,
        ),
      )
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort();
    const style = (element as HTMLElement).style;
    const painted = ["background", "left", "top", "background-color"]
      .map((key) => style.getPropertyValue(key))
      .filter(Boolean)
      .join(";");
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")} {${painted}}>${content.join("")}</>`;
  };
  return [...host.children].map(walk).join("\n");
}

describe("ADR-258 Phase 2 — the Color controls draw their node trees", () => {
  it("ColorArea > ColorThumb — the reference structure, RAC's gradient and thumb", async () => {
    const { html } = await open("colorarea", { defaultValue: "#8040c0" });
    const reference = renderToStaticMarkup(
      createElement(
        ColorArea,
        { defaultValue: "#8040c0" },
        createElement(ColorThumb),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("ColorSlider > Label + SliderOutput + SliderTrack > ColorThumb — channel name and value are RAC's", async () => {
    const { html } = await open("colorslider", {
      defaultValue: "hsl(120, 100%, 50%)",
      channel: "hue",
    });
    const reference = renderToStaticMarkup(
      createElement(
        ColorSlider,
        { defaultValue: "hsl(120, 100%, 50%)", channel: "hue" },
        createElement(Label),
        createElement(SliderOutput),
        createElement(SliderTrack, null, createElement(ColorThumb)),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
    expect(html()).toContain(">Hue<");
    expect(html()).toContain(">120°<");
  });

  it("an authored label wins over the channel's name", async () => {
    const { html } = await open("colorslider", { label: "Tint" });
    expect(html()).toContain(">Tint<");
    expect(html()).not.toContain(">Hue<");
  });

  it("ColorWheel > ColorWheelTrack + ColorThumb — RAC's conic ring and thumb", async () => {
    const { html } = await open("colorwheel", {
      defaultValue: "hsl(90, 100%, 50%)",
    });
    const reference = renderToStaticMarkup(
      createElement(
        ColorWheel,
        {
          defaultValue: "hsl(90, 100%, 50%)",
          outerRadius: 90,
          innerRadius: 64,
        },
        createElement(ColorWheelTrack),
        createElement(ColorThumb),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("a default value edit starts RAC's state again (the thumb follows)", async () => {
    const { html, edit } = await open("colorslider", {
      defaultValue: "hsl(0, 100%, 50%)",
    });
    expect(html()).toContain(">0°<");
    edit({ defaultValue: "hsl(240, 100%, 50%)" });
    expect(html()).toContain(">240°<");
  });
});

describe("ADR-258 Phase 2 — the Canvas lays the parts out where RAC puts them", () => {
  /** The part's box relative to its parent record (the Canvas geometry). */
  const box = (
    root: Awaited<ReturnType<typeof open>>["root"],
    type: string,
  ) => {
    const record = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    )!;
    return { record, rect: root.getGeometry([record.id]).get(record.id)! };
  };

  it("ColorArea: the thumb's center is RAC's `left/top %` of the area (hsl · axes)", async () => {
    const { root } = await open("colorarea", {
      defaultValue: "hsl(210, 60%, 40%)",
      colorSpace: "hsl",
      xChannel: "hue",
      yChannel: "lightness",
    });
    const area = box(root, "ColorArea").rect;
    const thumb = box(root, "ColorThumb").rect;
    // RAC: x = 210 / 360, y = 1 − 40 / 100 of the box (`useColorAreaGradient`).
    expect(thumb.x + thumb.width / 2).toBeCloseTo((210 / 360) * area.width, 2);
    expect(thumb.y + thumb.height / 2).toBeCloseTo(0.6 * area.height, 2);
    expect(thumb.width).toBe(16);
  });

  it("ColorSlider: the grid (label · output over a 20px track), the thumb at the snapped channel value on the track's middle", async () => {
    const { root } = await open("colorslider", {
      defaultValue: "hsl(120, 100%, 50%)",
    });
    const slider = box(root, "ColorSlider").rect;
    const track = box(root, "SliderTrack").rect;
    const thumb = box(root, "ColorThumb").rect;
    expect(slider.width).toBe(300); // the rule's max-width
    // (The label · output row is the SliderOutput line — S2 controlFont line 18, ADR-295 Phase 3c-3c.)
    expect(track).toMatchObject({ x: 0, y: 22, width: 300, height: 20 });
    expect(thumb.x + thumb.width / 2).toBeCloseTo((120 / 360) * 300, 2);
    expect(thumb.y + thumb.height / 2).toBe(10);
  });

  it("ColorSlider vertical: no label · output, the track 20 × 150, the thumb along it", async () => {
    const { root } = await open("colorslider", {
      defaultValue: "hsl(90, 100%, 50%)",
      orientation: "vertical",
    });
    expect(box(root, "Label").rect).toMatchObject({ width: 0, height: 0 });
    expect(box(root, "SliderTrack").rect).toMatchObject({
      width: 20,
      height: 150,
    });
    const thumb = box(root, "ColorThumb").rect;
    expect(thumb.x + thumb.width / 2).toBe(10);
    expect(thumb.y + thumb.height / 2).toBeCloseTo((1 - 90 / 360) * 150, 2);
  });

  it("ColorWheel: the ring is the wheel's square, the thumb on its mid radius at the hue (0° = 3 o'clock, clockwise)", async () => {
    const { root } = await open("colorwheel", {
      defaultValue: "hsl(90, 100%, 50%)",
      size: 240,
    });
    expect(box(root, "ColorWheelTrack").rect).toMatchObject({
      x: 0,
      y: 0,
      width: 240,
      height: 240,
    });
    const thumb = box(root, "ColorThumb").rect;
    // hue 90 → 6 o'clock on the radius (120 + 94) / 2 = 107.
    expect(thumb.x + thumb.width / 2).toBeCloseTo(120, 2);
    expect(thumb.y + thumb.height / 2).toBeCloseTo(120 + 107, 2);
  });

  it("the parts' derived paint follows a value edit (record diff — no reload)", async () => {
    const { root, edit } = await open("colorslider", {
      defaultValue: "hsl(0, 100%, 50%)",
    });
    const before = box(root, "ColorThumb");
    expect(
      JSON.parse(String(before.record.derivedProps?._colorThumb)).color,
    ).toBe("#ff0000ff");
    edit({ defaultValue: "hsl(240, 100%, 50%)" });
    const after = box(root, "ColorThumb");
    expect(
      JSON.parse(String(after.record.derivedProps?._colorThumb)).color,
    ).toBe("#0000ffff");
    expect(after.rect.x + 8).toBeCloseTo((240 / 360) * 300, 2);
    edit({ channel: "lightness" });
    const track = box(root, "SliderTrack").record;
    expect(
      JSON.parse(String(track.derivedProps?._colorGradient)).layers[0].stops,
    ).toEqual(["#000000ff", "#0000ffff", "#ffffffff"]);
  });

  it("a Slider's track paints its own bar — no color gradient there", async () => {
    const { root } = await open("slider");
    const track = box(root, "SliderTrack").record;
    expect(track.derivedProps?._colorGradient).toBeUndefined();
  });

  it("disabled: the rule's gray (and the track's disabled dimming)", async () => {
    const { root } = await open("colorslider", { isDisabled: true });
    const track = box(root, "SliderTrack").record;
    expect(JSON.parse(String(track.derivedProps?._colorGradient))).toEqual({
      kind: "solid",
      color: "#808080ff",
    });
    expect(track.derivedProps?._opacity).toBe(0.38);
    const thumb = box(root, "ColorThumb").record;
    expect(JSON.parse(String(thumb.derivedProps?._colorThumb)).color).toBe(
      "#808080ff",
    );
    expect(thumb.derivedProps?._opacity).toBe(0.5);
  });
});
