import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  copyNodes,
  createPage,
  insertNodes,
  pasteNodes,
  setHtmlId,
} from "../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "../../../i18n";
import { CatalogAttributesSection } from "../../panels/properties/catalog/CatalogAttributesSection";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { CatalogWorkspaceProvider } from "../react";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-8: every element a user action creates gets an author DOM id (the old app's
 * `customId` = `{type}_{n}`, the first free number): an insert, a paste (a copied id that is
 * taken moves to its next free number), not a page body. The id is part of the same step.
 */
const BODY = "project:node:home-body" as NodeId;
const node = (
  id: string,
  definitionId: string,
  metadata?: NodeEntry["metadata"],
): NodeEntry => ({
  kind: "node",
  id: id as NodeId,
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...(metadata ? { metadata } : {}),
});

async function open() {
  return new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:autoid" as EntryId<"project">,
        name: "Auto id",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e8-autoid-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
}

const htmlIdOf = (workspace: CatalogWorkspace, id: string) =>
  (workspace.runtime.graph.getEntry(id) as NodeEntry | undefined)?.metadata
    ?.htmlId;

describe("ADR-248 4e-8 automatic element ids", () => {
  it("an insert names each new element type_N (first free number) in the same step", async () => {
    const workspace = await open();
    const button = catalogPaletteDefinitionId(
      workspace.runtime.graph.library,
      "Button",
    );
    const insert = (ids: string[], definitions: string[]) =>
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: ids.map((id, i) => node(id, definitions[i]!)),
          rootIds: ids as NodeId[],
          newId: workspace.newId,
        }),
      );
    const depth = workspace.runtime.historyDepth.undo;
    insert(
      ["project:node:b1", "project:node:t1"],
      [button, "lib:definition:text"],
    );
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(htmlIdOf(workspace, "project:node:b1")).toBe("button_1");
    expect(htmlIdOf(workspace, "project:node:t1")).toBe("text_1");
    insert(["project:node:b2"], [button]);
    expect(htmlIdOf(workspace, "project:node:b2")).toBe("button_2");

    // One undo removes the element and its id; the number is free again.
    workspace.undo();
    insert(["project:node:b3"], [button]);
    expect(htmlIdOf(workspace, "project:node:b3")).toBe("button_2");
    // The page body keeps none.
    expect(htmlIdOf(workspace, BODY)).toBeUndefined();
  });

  it("an id the action already gives stays; a pasted copy of a taken id moves to its next free number", async () => {
    const workspace = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("project:node:hero", "lib:definition:text", { htmlId: "hero" }),
        ],
        rootIds: ["project:node:hero" as NodeId],
        newId: workspace.newId,
      }),
    );
    expect(htmlIdOf(workspace, "project:node:hero")).toBe("hero");

    const clipboard = copyNodes(workspace.runtime.graph, [
      "project:node:hero" as NodeId,
    ]);
    const paste = () =>
      workspace.execute(
        pasteNodes({
          clipboard,
          parent: { kind: "node", id: BODY },
          newId: workspace.newId,
        }),
      ).plan.selectAfter![0]!;
    const first = paste();
    const second = paste();
    expect(htmlIdOf(workspace, "project:node:hero")).toBe("hero");
    expect(htmlIdOf(workspace, first)).toBe("hero_1");
    expect(htmlIdOf(workspace, second)).toBe("hero_2");
  });

  it("a page's body gets no id; an id edit is not touched", async () => {
    const workspace = await open();
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: "project:page:second" as EntryId<"page">,
          route: "/second",
          name: "Second",
          children: ["project:node:second-body" as NodeId],
        },
        entries: [
          {
            ...node("project:node:second-body", "lib:definition:type-body"),
            name: "Body",
          },
        ],
      }),
    );
    expect(htmlIdOf(workspace, "project:node:second-body")).toBeUndefined();

    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("project:node:t", "lib:definition:text")],
        rootIds: ["project:node:t" as NodeId],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      setHtmlId({ id: "project:node:t" as NodeId, htmlId: "" }),
    );
    expect(htmlIdOf(workspace, "project:node:t")).toBeUndefined();
  });

  it("an emptied ID field shows the id the element would get (the first free type_N), and the check assigns it", async () => {
    const workspace = await open();
    const button = catalogPaletteDefinitionId(
      workspace.runtime.graph.library,
      "Button",
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("project:node:b1", button), node("project:node:b2", button)],
        rootIds: ["project:node:b1", "project:node:b2"] as NodeId[],
        newId: workspace.newId,
      }),
    );
    const second = "project:node:b2" as NodeId;
    const view = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogAttributesSection
            target={{ kind: "node", id: second }}
            identity={workspace.root.recordsOfSource(second)[0]!}
          />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const input = () => view.getAllByRole("textbox")[0] as HTMLInputElement;
    expect(input().value).toBe("button_2");
    act(() => {
      workspace.execute(setHtmlId({ id: second, htmlId: "" }));
    });
    expect(input().value).toBe("");
    // button_1 is the first button's, so the empty field stands for button_2.
    expect(input().placeholder).toBe("button_2");
    // Freeing button_1 moves it there.
    act(() => {
      workspace.execute(
        setHtmlId({ id: "project:node:b1" as NodeId, htmlId: "cta" }),
      );
    });
    expect(input().placeholder).toBe("button_1");
    fireEvent.click(view.getByRole("button", { name: /unique/i }));
    expect(htmlIdOf(workspace, second)).toBe("button_1");
    view.unmount();
  });
});
