// @vitest-environment jsdom
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
import type {
  CatalogDocument,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  CatalogCompositionRoot,
  type CatalogTextMeasure,
} from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { renderToStaticMarkup } from "react-dom/server";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { TAILWIND_PALETTE } from "@composition/rendering";

const TAILWIND_NEUTRAL_600 = TAILWIND_PALETTE.neutral[600];

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

async function openOwner(
  type: string,
  props: Record<string, string> = {},
  definitionId?: string,
) {
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
          definitionId:
            definitionId ?? catalogPaletteDefinitionId(library, type),
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
 * A standalone item origin directly on the page (the palette inserts it into a host; the G3 state
 * scenario lays the origin itself out, as `phase3Presence` does).
 */
async function openStandalone(definitionId: string) {
  const library = await buildCodeCatalogLibrary();
  const projectId = "project:project:standalone" as const;
  const pageId = "project:page:main" as const;
  const nodeId = "project:node:owner" as NodeId;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 32,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "Standalone",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [nodeId],
      },
      [nodeId]: {
        kind: "node",
        id: nodeId,
        definitionId: definitionId as DefinitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    },
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `adr248-4e11-standalone-${Math.random()}`),
  );
  return new CatalogCompositionRoot(
    runtime,
    await nodeLayoutEngine(),
    { width: 1000, height: 800 },
    undefined,
    undefined,
    measure,
  );
}

/**
 * button-min-width-68: the field trigger buttons are `.react-aria-Button` elements without a
 * `data-size`, so the generic Button sheet's default `min-width: 68px` reached them over the
 * catalog's icon-sized width. The owner's button delegation resets it (`min-width: unset`, like
 * NumberField's steppers); the Canvas trigger icon is the declared icon size.
 */

/**
 * ADR-256 Decision 4 — a ListBoxItem's label Text is RAC's `Text slot="label"` in the item's Text
 * context: the option is named by it (`aria-labelledby` → the label's id) and described by the
 * description. Before, the Preview drew a plain span and the option's label id pointed nowhere.
 */
describe("ADR-256 — named slots reach RAC (Preview DOM)", () => {
  it("a ListBoxItem's label · description Text name and describe the option", async () => {
    const root = await openStandalone(
      "lib:definition:origin-component-listbox",
    );
    const owner = [...root.domInputs.values()].find(
      (record) => record.sourceId === "project:node:owner",
    )!;
    const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
    const option = /<div[^>]*role="option"[^>]*>/.exec(html)?.[0] ?? "";
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(option)?.[1];
    const describedBy = /aria-describedby="([^"]+)"/.exec(option)?.[1];
    expect(labelledBy, option).toBeTruthy();
    const label = new RegExp(
      `<span[^>]*id="${labelledBy}"[^>]*slot="label"|<span[^>]*slot="label"[^>]*id="${labelledBy}"`,
    );
    expect(html).toMatch(label);
    if (describedBy) expect(html).toContain(`id="${describedBy}"`);
  });
});

/**
 * Phase 1 review h1 — the slot scope is the element the DOM pass decorates: a state value's
 * variables reach the rendered element **over** its own style, not instead of it. Before, the
 * hover variables replaced the authored width · font size of a Text · Heading · Description · Button.
 */
describe("ADR-256 — the RAC slot scope keeps the element's own style", () => {
  it.each([
    "lib:definition:text",
    "lib:definition:origin-component-heading",
    "lib:definition:origin-component-description",
    "lib:definition:origin-component-button",
  ])(
    "%s: the authored style and the hover variables both reach the element",
    async (definitionId) => {
      const workspace = await openOwner("", {}, "lib:definition:type-frame");
      const set = <T>(value: T) => ({ kind: "set" as const, value });
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: "project:node:home-body" },
          entries: [
            {
              kind: "node",
              id: "project:node:styled",
              definitionId: definitionId as DefinitionId,
              children: [],
              props: {},
              visual: { fontSize: set(31) },
              sizing: { width: set(234) },
              stateRules: { hover: { color: set("#abcdef") } },
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: ["project:node:styled" as NodeId],
          newId: workspace.newId,
        }),
      );
      const record = [...workspace.root.domInputs.values()].find(
        (item) => item.sourceId === "project:node:styled",
      )!;
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, record.id),
      );
      expect(html).toContain("--catalog-hover-color:#abcdef");
      expect(html).toContain("width:234px");
      expect(html).toContain("font-size:31px");
    },
  );
});
