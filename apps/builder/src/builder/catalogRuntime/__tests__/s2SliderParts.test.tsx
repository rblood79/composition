// @vitest-environment jsdom
/**
 * S2 1.8.2 Slider · RangeSlider parts (2026-11-18, 조작기 묶음 B — `Slider.tsx`):
 * - the track is S2's row (24 · 32 · 40 · 48) holding the bar (`upperTrack` — the SliderTrackBar node)
 *   with the fill in it, and the thumbs on the row's middle;
 * - rows: the label container (label row · top value text) above the field input (track · side value
 *   text) — no row gap; at the side two columns `auto 1fr`, column gap = the field input's gap (S 16 ·
 *   M 16 · L 20 · XL 24);
 * - colors: bar `gray-300`, fill `gray-700` (`accent-900` emphasized), thumb `gray-25` with a 2px
 *   `gray-800` border; disabled = S2's `disabled` colors, no dimming — on the Canvas (the rules'
 *   trees, the Slider's derived `isDisabled`) and in the DOM (RAC's `data-disabled` on every part).
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:slider" as NodeId;
// (A glyph advance of half the font size — a "0" too: `ch`.)
const measure: CatalogTextMeasure = (text, font) => ({
  width: [...text].length * font.fontSize * 0.5,
  exactWidth: [...text].length * font.fontSize * 0.5,
  minWidth: [...text].length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});
const element = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
};

async function open(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-slider" as const,
        name: "S2 Slider",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-slider-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      textMeasure: measure,
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
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: { width: { kind: "set", value: 400 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = [...root.domInputs.values()];
  const owner = records.find((item) => item.sourceId === OWNER)!;
  const parts = (partType: string) =>
    records.filter((item) => root.typeOf(item) === partType);
  const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  type Box = {
    fillColor?: ArrayLike<number>;
    strokeColor?: ArrayLike<number>;
  };
  const hex = (color?: ArrayLike<number>) =>
    color && color[3] !== 0
      ? `#${[0, 1, 2]
          .map((i) =>
            Math.round(color[i]! * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")}`
      : undefined;
  const box = (partType: string, index = 0) =>
    (
      getSkiaNode(parts(partType)[index]!.id) as unknown as {
        box?: Box;
      }
    ).box;
  const painted = {
    track: hex(box("SliderTrack")?.fillColor),
    bar: hex(box("SliderTrackBar")?.fillColor),
    fill: hex(box("SliderFill")?.fillColor),
    thumb: hex(box("SliderThumb")?.fillColor),
    thumbBorder: hex(box("SliderThumb")?.strokeColor),
    label: parts("Label")[0]?.derivedProps?.color,
    output: parts("SliderOutput")[0]?.derivedProps?.isDisabled,
  };
  const shownOutput = parts("SliderOutput").find((output) => !output.hidden)!;
  // (the rule painter's text child)
  type Painted = {
    text?: { fontVariant?: string; align?: string };
    children?: Painted[];
  };
  const textOf = (data: Painted | undefined): Painted["text"] =>
    data?.text ?? data?.children?.map(textOf).find(Boolean);
  const outputText = textOf(getSkiaNode(shownOutput.id) as unknown as Painted);
  canvas.dispose();
  return { root, parts, html, painted, shownOutput, outputText };
}

describe("S2 Slider parts — the track row, the bar, S2 colors", () => {
  it("Slider: track > bar > fill · thumb; the S2 light colors", async () => {
    const { parts, painted, html } = await open("Slider", { value: 30 });
    const [bar] = parts("SliderTrackBar");
    expect(parts("SliderFill")[0]!.parentId).toBe(bar!.id);
    expect(parts("SliderThumb")[0]!.parentId).toBe(bar!.parentId);
    expect(painted).toMatchObject({
      bar: "#dadada", // gray-300
      fill: "#505050", // gray-700
      thumb: "#ffffff", // gray-25
      thumbBorder: "#292929", // gray-800
      label: "#505050", // neutral-subdued
    });
    expect(painted.track).toBeUndefined();
    const dom = element(html);
    const barElement = dom.querySelector(".react-aria-SliderTrackBar")!;
    expect(barElement.firstElementChild?.className).toBe(
      "react-aria-SliderFill",
    );
    expect(barElement.getAttribute("data-variant")).toBe("default");
    expect(barElement.hasAttribute("data-disabled")).toBe(false);
  });

  it("disabled: S2's disabled colors on every part, no dimming — both consumers", async () => {
    const { painted, html } = await open("Slider", {
      value: 30,
      isDisabled: true,
    });
    expect(painted).toMatchObject({
      bar: "#e9e9e9", // disabled
      fill: "#e9e9e9",
      thumb: "#ffffff",
      thumbBorder: "#dadada", // disabled border
      label: "#c6c6c6", // disabled content
      output: true,
    });
    expect(html).not.toMatch(/opacity/);
    const dom = element(html);
    for (const part of [
      "SliderTrackBar",
      "SliderFill",
      "SliderThumb",
      "SliderOutput",
    ]) {
      const node = dom.querySelector(`.react-aria-${part}`)!;
      expect(node.getAttribute("data-disabled"), part).toBe("true");
    }
    // (the sheets' disabled branches are `[data-variant][data-disabled]`)
    for (const part of ["SliderTrackBar", "SliderFill", "SliderOutput"])
      expect(
        dom.querySelector(`.react-aria-${part}`)!.getAttribute("data-variant"),
        part,
      ).toBe("default");
  });

  it("RangeSlider: two thumbs on the row, the fill between them in the bar", async () => {
    const { root, parts } = await open("RangeSlider", {});
    const [bar] = parts("SliderTrackBar");
    const [fill] = parts("SliderFill");
    expect(fill!.parentId).toBe(bar!.id);
    const geometry = root.getGeometry([bar!.id, fill!.id]);
    expect(
      geometry.get(fill!.id)!.x / geometry.get(bar!.id)!.width,
    ).toBeCloseTo(0.25, 2);
    expect(parts("SliderThumb")).toHaveLength(2);
  });

  it("rows: label container (label row · value text) above the field input (track), no row gap", async () => {
    const { root, parts, html } = await open("Slider", { value: 30 });
    const [container] = parts("SliderLabelContainer");
    const [input] = parts("SliderFieldInput");
    const shown = parts("SliderOutput").filter((output) => !output.hidden);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.parentId).toBe(container!.id);
    expect(parts("SliderTrack")[0]!.parentId).toBe(input!.id);
    const geometry = root.getGeometry([container!.id, input!.id]);
    // (S2 M: label row 18 + track row 32 — S2's `--field-gap` is 0 in a slider's label container)
    expect(geometry.get(container!.id)!.height).toBe(18);
    expect(geometry.get(input!.id)!.y).toBe(18);
    const dom = element(html);
    const rows = [...dom.querySelector(".react-aria-Slider")!.children].map(
      (child) => child.className,
    );
    expect(rows).toEqual([
      "react-aria-SliderLabelContainer",
      "react-aria-SliderFieldInput",
    ]);
    expect(
      dom.querySelector(
        ".react-aria-SliderLabelContainer .react-aria-SliderOutput",
      ),
    ).not.toBeNull();
  });

  it.each([
    ["M", 16],
    ["XL", 24],
  ])(
    "side %s: the value text after the track, two columns %d apart",
    async (size, gap) => {
      const { root, parts, html } = await open("Slider", {
        value: 30,
        labelPosition: "side",
        size,
      });
      const [container] = parts("SliderLabelContainer");
      const [input] = parts("SliderFieldInput");
      const shown = parts("SliderOutput").filter((output) => !output.hidden);
      expect(shown).toHaveLength(1);
      expect(shown[0]!.parentId).toBe(input!.id);
      const geometry = root.getGeometry([container!.id, input!.id]);
      const label = geometry.get(container!.id)!;
      const field = geometry.get(input!.id)!;
      expect(field.y).toBe(0);
      // (The Slider's thumb size reaches the thumb through the field input — its part rule.)
      const thumb = parts("SliderThumb")[0]!;
      expect(root.getGeometry([thumb.id]).get(thumb.id)!.width).toBe(
        size === "XL" ? 24 : 20,
      );
      expect(field.x - (label.x + label.width)).toBeCloseTo(gap, 1);
      // (The track shrinks for the value text — S2 `track` `width: 'full'` is a rule length; a
      //  template-written `100%` was the author's fixed size, `flex-shrink: 0`, and pushed the
      //  value text out of the Slider.)
      const [track] = parts("SliderTrack");
      const value = root
        .getGeometry([shown[0]!.id, track!.id])
        .get(shown[0]!.id)!;
      expect(value.x + value.width).toBeCloseTo(field.width, 1);
      expect(root.getGeometry([track!.id]).get(track!.id)!.width).toBeCloseTo(
        field.width - gap - value.width,
        1,
      );
      expect(
        element(html).querySelector<HTMLElement>(".react-aria-SliderTrack")!
          .style.flexShrink,
      ).not.toBe("0");
      const dom = element(html);
      const inField = [
        ...dom.querySelector(".react-aria-SliderFieldInput")!.children,
      ].map((child) => child.className);
      expect(inField).toEqual([
        "react-aria-SliderTrack",
        "react-aria-SliderOutput",
      ]);
      expect(
        dom.querySelector(
          ".react-aria-SliderLabelContainer .react-aria-SliderOutput",
        ),
      ).toBeNull();
    },
  );

  it.each([
    ["top", "end", "right"],
    ["side", "start", "left"],
  ])(
    "value text (%s): S2's `${n}ch` width — the same at every value — tabular digits, aligned %s",
    async (labelPosition, align, canvasAlign) => {
      const width = async (type: string, value: unknown) => {
        const opened = await open(type, { value, labelPosition });
        const { root, shownOutput } = opened;
        return {
          ...opened,
          width: root.getGeometry([shownOutput.id]).get(shownOutput.id)!.width,
        };
      };
      const low = await width("Slider", 5);
      const high = await width("Slider", 100);
      // (S2 `maxLabelLength`: 「0」 · 「100」 → 3)
      expect(low.shownOutput.derivedProps).toMatchObject({
        _valueChars: 3,
        _valueAlign: align,
      });
      // (3ch at M's 14px = 3 × 7)
      expect(low.width).toBe(21);
      expect(high.width).toBe(low.width);
      expect(low.outputText?.fontVariant).toBe("tabular-nums");
      expect(low.outputText?.align).toBe(canvasAlign);
      const output = element(low.html).querySelector<HTMLElement>(
        ".react-aria-SliderOutput",
      )!;
      expect(output.style.width).toBe("3ch");
      expect(output.style.minWidth).toBe("3ch");
      expect(output.style.fontVariantNumeric).toBe("tabular-nums");
      // (the rule's box is flex: `text-align` would not move the text — `justify-content` does)
      expect(output.style.justifyContent).toBe(`flex-${align}`);
      // (A RangeSlider's: 「99–100」 → 6, twice the Slider's.)
      const range = await width("RangeSlider", { start: 20, end: 40 });
      expect(range.shownOutput.derivedProps?._valueChars).toBe(6);
      expect(range.width).toBeCloseTo(low.width * 2, 3);
    },
  );
});
