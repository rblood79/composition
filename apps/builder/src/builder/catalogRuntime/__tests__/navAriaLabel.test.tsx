// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「Nav aria-label vs label 진행해」): the Nav takes `aria-label` (its binding's
 * accepts — the HTML `<nav>` name; RSP / HTML have no `label` for it), and its DOM read `label`,
 * which nothing writes — an `aria-label` prop never reached the element. The DOM now names the
 * `<nav>` with the `aria-label` prop ("Navigation" without one); the Attributes axis (metadata
 * `ariaLabel`, every element) still wins over both.
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

async function navHtml(
  props: Record<string, string>,
  metadata?: { ariaLabel: string },
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:nav-label" as EntryId<"project">,
        name: "Nav label",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `nav-label-${Math.random()}`),
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
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, "Nav"),
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
          ...(metadata ? { metadata } : {}),
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const nav = [...root.domInputs.values()].find(
    (r) => root.typeOf(r) === "Nav",
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(root, nav.id));
  return /^<nav[^>]*aria-label="([^"]*)"/.exec(html)?.[1];
}

describe("Nav — its name is the `aria-label` it accepts", () => {
  it("accepts `aria-label`, not `label`", () => {
    const accepts = getPrimitiveBinding("Nav")?.props.accepts ?? {};
    expect(accepts).toHaveProperty("aria-label");
    expect(accepts).not.toHaveProperty("label");
  });

  it("no name: Navigation", async () => {
    expect(await navHtml({})).toBe("Navigation");
  });

  it("an `aria-label` prop names the <nav>", async () => {
    expect(await navHtml({ "aria-label": "Main" })).toBe("Main");
  });

  it("the Attributes axis (metadata ariaLabel) wins", async () => {
    expect(
      await navHtml({ "aria-label": "Main" }, { ariaLabel: "Primary" }),
    ).toBe("Primary");
  });
});
