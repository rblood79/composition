// @vitest-environment jsdom
/**
 * S2 체크리스트 §4.1 Autocomplete (2026-11-22) — S2 의 Autocomplete 예제 (`Menu.md` 「Autocomplete」):
 * `<SearchField aria-label="Search tags" autoFocus />` + `<Menu styles={style({marginTop: 8})}>` —
 *   - the search has no visible label: it names itself (`aria-label` — RAC gives it to the input);
 *   - the list sits 8 below the search.
 * Canvas (the record · its geometry) and the DOM (RAC SearchField · ListBox) read the same template.
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
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

const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as Record<string, unknown>).IntersectionObserver ??= NoopObserver;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-autocomplete" as EntryId<"project">,
        name: "S2 autocomplete",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-autocomplete-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, "Autocomplete"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].find((r) => root.typeOf(r) === type)!;
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  return { root, of, box };
}

describe("S2 Autocomplete — a search with no visible label, the list 8 below", () => {
  it("Canvas: the search's label row is not drawn; the list sits 8 below the search", async () => {
    const { root, of, box } = await open();
    const search = of("SearchField");
    const labelRow = search.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((part) => root.typeOf(part) === "FieldLabel")!;
    expect(labelRow.hidden).toBe(true);
    const searchBox = box(search.id);
    expect(searchBox.height).toBe(32);
    expect(box(of("ListBox").id).y - (searchBox.y + searchBox.height)).toBe(8);
  });

  it("DOM: RAC SearchField without a label element, named by its aria-label; the ListBox margin 8", async () => {
    const { root, of } = await open();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(renderCatalogDom(root, of("Autocomplete").id)),
    );
    const field = document.querySelector(".react-aria-SearchField")!;
    expect(field.querySelector(".react-aria-Label")).toBeNull();
    const input = field.querySelector("input")!;
    expect(input.getAttribute("aria-label")).toBe("Search items");
    expect(input.hasAttribute("aria-labelledby")).toBe(false);
    expect(
      document.querySelector<HTMLElement>(".react-aria-ListBox")!.style
        .marginTop,
    ).toBe("8px");
    await act(async () => reactRoot.unmount());
    host.remove();
  });
});
