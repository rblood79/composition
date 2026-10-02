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
