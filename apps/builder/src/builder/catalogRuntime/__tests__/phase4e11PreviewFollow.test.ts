/**
 * ADR-248 4e-11 G3 previewFollow repairs: Preview defects the Phase 3 new Canvas followed (②) are
 * fixed in the product, and the Canvas reads the same catalog declaration.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCalendarHeaderParts } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderToStaticMarkup } from "react-dom/server";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const GENERATED = resolve(
  __dirname,
  "../../../../../../packages/shared/src/components/styles/generated",
);
const blockOf = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function openOwner(type: string, props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:follow" as const,
        name: "Follow",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e11-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id: "project:node:owner",
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: { width: { kind: "set", value: 300 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:owner"],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

/**
 * button-min-width-68: the field trigger buttons are `.react-aria-Button` elements without a
 * `data-size`, so the generic Button sheet's default `min-width: 68px` reached them over the
 * catalog's icon-sized width. The owner's button delegation resets it (`min-width: unset`, like
 * NumberField's steppers); the Canvas trigger icon is the declared icon size.
 */
describe("field trigger buttons — no generic Button min-width", () => {
  it.each(["ComboBox", "DatePicker", "DateRangePicker", "SearchField"])(
    "%s button delegation resets min-width",
    (owner) => {
      const css = readFileSync(`${GENERATED}/${owner}.css`, "utf8");
      expect(blockOf(css, `.react-aria-${owner} .react-aria-Button`)).toContain(
        "min-width: unset;",
      );
    },
  );

  it.each(["ComboBox", "DatePicker", "DateRangePicker"])(
    "%s Canvas trigger icon is the 18 icon box at md",
    async (owner) => {
      const workspace = await openOwner(owner, { size: "md" });
      const root = workspace.root;
      const icons = [...root.layoutInputs.values()].filter(
        (record) => record.bindingId === "selecticon",
      );
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) {
        expect(root.getLayoutInput(icon.id)).not.toMatchObject({
          minWidth: "68px",
        });
        expect(root.getGeometry([icon.id]).get(icon.id)!.width).toBe(18);
      }
      workspace.dispose();
    },
  );
});

/**
 * calendar-header: the Calendar nav buttons are `.react-aria-Button` elements without a
 * `data-size`; `Calendar.css` sizes them (height × height + spacing-xs) but the generic Button
 * `min-width: 68px` won, wrapping the month heading onto two lines. The shared Calendar sheet
 * resets it; the Canvas header row reads the nav width without the floor.
 */
describe("Calendar nav buttons — no generic Button min-width", () => {
  it("the shared Calendar sheet resets min-width on the nav buttons", () => {
    const css = readFileSync(
      resolve(GENERATED, "../CalendarCommon.css"),
      "utf8",
    );
    const block = css.slice(
      css.indexOf(".react-aria-RangeCalendar .react-aria-Button {"),
    );
    expect(block.slice(0, block.indexOf("&["))).toContain("min-width: unset;");
  });

  it("the Canvas header row reads the sized nav width (md 30 + 4)", () => {
    expect(catalogCalendarHeaderParts("md")?.navWidth).toBe(34);
    expect(catalogCalendarHeaderParts("sm")?.navWidth).toBe(28);
  });
});

/**
 * group-size-not-propagated (사용자 결정 2026-09-30 — RSP propagates): a group's `size` reaches its
 * items, and an item's `size` its label (the old `override: true` propagation rules). The resolver
 * sets the child's resolved `size`, so the Canvas rule box and the DOM `data-size` read one value.
 */
describe("group size reaches the items", () => {
  const sizeOf = (
    workspace: CatalogWorkspace,
    bindingId: string,
  ): Array<{ size: unknown; height: number }> => {
    const root = workspace.root;
    const records = [...root.layoutInputs.values()].filter(
      (record) => record.bindingId === bindingId && !record.hidden,
    );
    const geometry = root.getGeometry(records.map((record) => record.id));
    return records.map((record) => ({
      size: record.props.size,
      height: geometry.get(record.id)!.height,
    }));
  };

  it("ToggleButtonGroup lg sizes its ToggleButtons lg", async () => {
    const workspace = await openOwner("ToggleButtonGroup", { size: "lg" });
    const items = sizeOf(workspace, "togglebutton");
    expect(items.length).toBe(2);
    for (const item of items) expect(item).toEqual({ size: "lg", height: 42 });
    workspace.dispose();
  });

  it.each(["RadioGroup", "CheckboxGroup"])(
    "%s lg sizes its items and their labels lg",
    async (owner) => {
      const workspace = await openOwner(owner, { size: "lg" });
      const item = owner === "RadioGroup" ? "radio" : "checkbox";
      const items = sizeOf(workspace, item);
      expect(items.length).toBeGreaterThan(0);
      for (const entry of items) expect(entry.size).toBe("lg");
      const root = workspace.root;
      const labels = [...root.layoutInputs.values()].filter(
        (record) =>
          record.bindingId === "label" &&
          root.layoutInputs.get(record.parentId)?.bindingId === item,
      );
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) expect(label.props.size).toBe("lg");
      // The DOM items carry the same size (the group composes them).
      const group = [...root.domInputs.values()].find(
        (record) => record.sourceId === "project:node:owner",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, group.id));
      const itemClass = `react-aria-${item === "radio" ? "Radio" : "Checkbox"}`;
      const tags = html.match(new RegExp(`<label[^>]*class="${itemClass}"[^>]*>`, "g")) ?? [];
      expect(tags.length).toBe(items.length);
      if (item === "checkbox")
        for (const tag of tags) expect(tag).toContain('data-size="lg"');
      // The group root carries `data-size` (the generated per-size blocks apply), and the Canvas
      // reads the same catalog size: lg items gap 16.
      expect(html).toMatch(
        new RegExp(`class="react-aria-${owner}"[^>]*data-size="lg"|data-size="lg"[^>]*class="react-aria-${owner}"`),
      );
      const boxes = [...root.layoutInputs.values()].filter(
        (record) => record.bindingId === item,
      );
      const geometry = root.getGeometry(boxes.map((record) => record.id));
      const [first, second] = boxes.map((record) => geometry.get(record.id)!);
      expect(second.y - (first.y + first.height)).toBe(16);
      workspace.dispose();
    },
  );
});

/**
 * slider-track-size-not-propagated: the Slider size reaches its track (the old `size → SliderTrack`
 * propagation): the typed SliderTrack takes the catalog track height (sm 4 · lg 12), and the DOM
 * `<SliderTrack>` carries `data-size` so the generated `SliderTrack.css` size blocks apply.
 */
describe("Slider size reaches the track", () => {
  it.each([
    ["sm", 4],
    ["lg", 12],
  ])("Slider %s track is %d tall in both consumers", async (size, height) => {
    const workspace = await openOwner("Slider", { size });
    const root = workspace.root;
    const track = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "slidertrack",
    )!;
    expect(track.props.size).toBe(size);
    expect(root.getGeometry([track.id]).get(track.id)!.height).toBe(height);
    const group = [...root.domInputs.values()].find(
      (record) => record.sourceId === "project:node:owner",
    )!;
    const html = renderToStaticMarkup(renderCatalogDom(root, group.id));
    expect(html).toMatch(
      new RegExp(`class="react-aria-SliderTrack"[^>]*data-size="${size}"|data-size="${size}"[^>]*class="react-aria-SliderTrack"`),
    );
    workspace.dispose();
  });
});

/**
 * numberfield-trigger-content-height: the NumberField group's padding follows the size like
 * ComboBox's container (the SelectTrigger scale), so the trigger is 20/22/30/42/54 tall in both
 * consumers — no stylesheet read the catalog trigger heights before.
 */
describe("NumberField group — per-size padding", () => {
  it("generated CSS sizes the group padding per size", () => {
    const css = readFileSync(`${GENERATED}/NumberField.css`, "utf8");
    expect(blockOf(css, ".react-aria-NumberField .react-aria-Group")).toContain(
      "padding: var(--nf-group-padding);",
    );
    expect(css).toContain(
      "--nf-group-padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl);",
    );
  });

  it.each([
    ["xs", 20],
    ["sm", 22],
    ["md", 30],
    ["lg", 42],
    ["xl", 54],
  ])("NumberField %s trigger is %d tall", async (size, height) => {
    const workspace = await openOwner("NumberField", { size });
    const root = workspace.root;
    const trigger = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "selecttrigger",
    )!;
    expect(root.getGeometry([trigger.id]).get(trigger.id)!.height).toBe(height);
    workspace.dispose();
  });
});
