import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getReusableOriginId } from "@composition/shared";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCompilerState } from "../../../services/ai/compiler/builderHost";
import { validateProgram } from "../../../services/ai/compiler/manifest";
import { catalogCreationEditFields } from "../creationContract";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-254 Phase 1: the Heading part origin. A Heading the AI creates is an instance of it (one
 * creation path — `catalogPaletteDefinitionId`), its creation contract keeps the Heading's own
 * props (the origin accepts `children`; `size` comes from its root, the `heading` definition), and
 * an edit of the origin reaches it on the Canvas and in the DOM.
 */
const HEADING_ORIGIN =
  "lib:definition:origin-component-heading" as LibraryDefinitionId;
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:heading" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
/** The Heading's AI props before the origin (the primitive's — main `1b51bcfe5`). */
const PROPS_BEFORE = [
  "children",
  "size",
  "fontSize",
  "lineHeight",
  "color",
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "opacity",
  "height",
];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

async function workspaceWith(props: Record<string, string>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr254-heading" as EntryId<"project">,
        name: "ADR-254 heading",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr254-heading-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  // The AI's create_element: the palette definition of the type and its creation props.
  const definitionId = catalogPaletteDefinitionId(library, "Heading");
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: NODE,
          definitionId,
          children: [],
          props: catalogCreationProps(library, definitionId, "Heading", props),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  const record = () =>
    [...workspace.root.canvasInputs.values()].find(
      (item) => item.sourceId === NODE,
    )!;
  return { workspace, definitionId, record };
}

describe("ADR-254 Phase 1 — the Heading origin", () => {
  it("is the Heading's reusable origin", () => {
    expect(getReusableOriginId("Heading")).toBe("component-heading");
  });

  it("keeps the Heading's creation contract — size and its choices from the root", () => {
    const fields = catalogCreationEditFields("Heading");
    const size = fields.find((field) => field.key === "size");
    expect(fields.map((field) => field.key)).toEqual(PROPS_BEFORE);
    expect(size?.options?.map((option) => option.value)).toEqual(SIZES);
  });

  it("changes only the AI manifest's creation mode and origin for Heading", () => {
    // The compiler manifest's Heading before the origin (main `1b51bcfe5`).
    const before = JSON.parse(
      readFileSync(
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          "fixtures/adr254-heading-manifest-before.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const heading = readCompilerState().manifest.components.find(
      (component) => component.type === "Heading",
    )!;
    expect(heading).toEqual({
      ...before,
      kind: "reusable",
      creationMode: "reusable",
      reusableId: "component-heading",
    });
  });

  it("accepts the AI's Heading with a size", () => {
    const { manifest } = readCompilerState();
    expect(
      validateProgram(
        {
          version: 1,
          source: "llm",
          operations: [
            {
              op: "create_element",
              args: {
                type: "Heading",
                props: { children: "Title", size: "L" },
              },
            },
          ],
        },
        manifest,
        {
          parentId: "body",
          selectedId: null,
          nodes: [{ id: "body", type: "Body" }],
        },
      ),
    ).toMatchObject({ ok: true });
  });

  it("creates the AI's Heading as an instance of the origin, sized by the Heading rule", async () => {
    const { definitionId, record } = await workspaceWith({
      children: "Title",
      size: "L",
    });
    expect(definitionId).toBe(HEADING_ORIGIN);
    expect(record().collapsedSourceIds).toEqual([
      "lib:template:component-heading",
    ]);
    expect(record().bindingId).toBe("heading");
    expect(record().props.children).toBe("Title");
    expect(record().visual.fontSize).toBe(18);
    expect(Number(record().visual.fontWeight)).toBe(600);
  });

  it("follows an edit of the origin on the Canvas and in the DOM", async () => {
    const { workspace, record } = await workspaceWith({ children: "Title" });
    for (const color of ["#ff0000", "#0000ff"]) {
      workspace.execute(
        setLibraryDefault({
          definitionId: HEADING_ORIGIN,
          scope: "visual",
          key: "color",
          write: set(color),
          newId: workspace.newId,
        }),
      );
      expect(record().visual.color).toBe(color);
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, record().id),
      );
      expect(html).toMatch(/^<h3 [^>]*class="react-aria-Heading"/);
      expect(html).toContain(`color:${color}`);
    }
  });
});
