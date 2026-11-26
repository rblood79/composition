// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, expect, it } from "vitest";
import { loadCatalogSideNav } from "../../../../../../packages/shared/src/catalog/runtime/sideNav.lazy";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
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
 * ADR-300 — a SideNavHeader's written type reaches its Text in the DOM as on the Canvas: the header
 * element carries it inline and the Text (`inherit`) takes it; the Canvas Text takes the header's
 * record values (`compositionRoot.ts` `sideNavText`). Why (2026-11-27): the header's DOM style was a
 * binding box style (`catalogDomStyle`) with no type, so a header written 16 · red was 16 · red on the
 * Canvas and the rule's 12 · grey in the Preview (G3 `incremental-header-edit`).
 */

const BODY = "project:node:home-body" as NodeId;
const PANEL = "project:node:panel" as NodeId;
const NAV = "project:node:nav" as NodeId;
const SECTION = "project:node:section" as NodeId;
const HEADER = "project:node:header" as NodeId;
const HEADER_TEXT = "project:node:header-text" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const cleanups: Array<() => void> = [];
beforeAll(() => loadCatalogSideNav());
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const node = (
  id: NodeId,
  definitionId: string,
  children: NodeId[],
  extra: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as unknown as NodeEntry;

async function headerRecords(visual: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:sidenav-header" as EntryId<"project">,
        name: "SideNav header",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `sidenav-header-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  cleanups.push(() => act(() => workspace.dispose()));
  // (The G3 SideNav fixture's shape — `adr300SideNavParity` `documentFor`: type definitions.)
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(PANEL, "lib:definition:type-SideNavPanel", [NAV], {
          props: { "aria-label": set("Side navigation") } as NodeEntry["props"],
        }),
        node(NAV, "lib:definition:type-SideNav", [SECTION], {
          props: { "aria-label": set("Docs") } as NodeEntry["props"],
        }),
        node(SECTION, "lib:definition:type-SideNavSection", [HEADER]),
        node(HEADER, "lib:definition:type-SideNavHeader", [HEADER_TEXT], {
          visual: Object.fromEntries(
            Object.entries(visual).map(([key, value]) => [key, set(value)]),
          ) as NodeEntry["visual"],
        }),
        node(HEADER_TEXT, "lib:definition:text", [], {
          props: { children: set("Docs") } as NodeEntry["props"],
        }),
      ],
      rootIds: [PANEL],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const panel = [...root.canvasInputs.values()].find(
    (record) => record.bindingId === "sidenavpanel",
  )!;
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, panel.id));
  // (Insert gives the nodes new ids — the header's Text is the text record saying "Docs".)
  const text = [...root.canvasInputs.values()].find(
    (record) => record.bindingId === "text" && record.props.children === "Docs",
  )!;
  return {
    header: host.querySelector<HTMLElement>(".react-aria-SideNavHeader")!,
    canvasText: text.derivedProps ?? {},
  };
}

it("a header's written size · weight · line height · color go on its element (its Text inherits them)", async () => {
  const { header, canvasText } = await headerRecords({
    fontSize: 16,
    fontWeight: 600,
    color: "#c00000",
  });
  expect(header).not.toBeNull();
  expect(header.style.fontSize).toBe("16px");
  expect(header.style.fontWeight).toBe("600");
  expect(header.style.color).toBe("rgb(192, 0, 0)");
  // The Canvas Text draws the same values (its owner's — `sideNavText`).
  expect(canvasText).toMatchObject({ fontSize: 16, fontWeight: 600 });
});

it("an unwritten header leaves its type to the rule sheet (nothing inline)", async () => {
  const { header } = await headerRecords({});
  expect(header.style.fontSize).toBe("");
  expect(header.style.color).toBe("");
});
