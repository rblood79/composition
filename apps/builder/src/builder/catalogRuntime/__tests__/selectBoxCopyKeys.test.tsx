// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  copyNodes,
  duplicateNodes,
  insertNodes,
  pasteNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
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
 * 2026-11-08 (사용자 Preview 오류 「Duplicate key "two" found in collection」): a duplicate or paste
 * copied a collection item's `id` (its RAC key) as it was — a copy of "Option two" in its own group
 * made two items keyed "two", and RAC threw for the whole Preview. A copy placed in a collection that
 * already has its key takes a new one; a copy elsewhere (a whole group pasted) keeps its keys.
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:select-box-keys" as EntryId<"project">,
        name: "Select box keys",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `select-box-keys-${Math.random()}`),
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
          id: GROUP,
          definitionId: catalogPaletteDefinitionId(library, "SelectBoxGroup"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const groups = () =>
    [...workspace.root.domInputs.values()].filter(
      (r) => workspace.root.typeOf(r) === "SelectBoxGroup",
    );
  /** Each group's item keys (the resolved `id`). */
  const keys = () =>
    groups().map((group) =>
      group.children
        .map((id) => workspace.root.domInputs.get(id)!)
        .filter((r) => workspace.root.typeOf(r) === "SelectBox")
        .map((r) => String(r.props.id)),
    );
  /** The node behind a group's item of this key (its owned node id). */
  const itemNode = (key: string) => {
    const record = [...workspace.root.domInputs.values()].find(
      (r) => workspace.root.typeOf(r) === "SelectBox" && r.props.id === key,
    )!;
    return record.id.split("::").pop() as NodeId;
  };
  const renderGroups = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    let options = 0;
    for (const group of groups()) {
      const host = document.body.appendChild(document.createElement("div"));
      const reactRoot = createRoot(host, {
        onUncaughtError: (error) => errors.push(error),
      });
      try {
        await act(async () =>
          reactRoot.render(renderCatalogDom(workspace.root, group.id)),
        );
      } catch (error) {
        errors.push(error);
      }
      options += host.querySelectorAll("[role=option]").length;
      await act(async () => reactRoot.unmount());
      host.remove();
    }
    window.removeEventListener("error", onError);
    return { errors: errors.map(String), options };
  };
  return { workspace, keys, itemNode, renderGroups };
}

describe("SelectBox copies — a collection keeps unique item keys", () => {
  it("a duplicated item takes a new key beside its original", async () => {
    const scene = await open();
    scene.workspace.execute(
      duplicateNodes({
        ids: [scene.itemNode("two")],
        newId: scene.workspace.newId,
      }),
    );
    const [keys] = scene.keys();
    expect(keys).toHaveLength(3);
    expect(keys.slice(0, 2)).toEqual(["one", "two"]);
    expect(new Set(keys).size).toBe(3);
    expect(await scene.renderGroups()).toEqual({ errors: [], options: 3 });
  });

  it("an item pasted into its own group takes a new key", async () => {
    const scene = await open();
    const clipboard = copyNodes(scene.workspace.root.runtime.graph, [
      scene.itemNode("one"),
    ]);
    scene.workspace.execute(
      pasteNodes({
        clipboard,
        parent: { kind: "node", id: GROUP },
        newId: scene.workspace.newId,
      }),
    );
    const [keys] = scene.keys();
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect((await scene.renderGroups()).errors).toEqual([]);
  });

  it("a whole group pasted elsewhere keeps its item keys", async () => {
    const scene = await open();
    const clipboard = copyNodes(scene.workspace.root.runtime.graph, [GROUP]);
    scene.workspace.execute(
      pasteNodes({
        clipboard,
        parent: { kind: "node", id: BODY },
        newId: scene.workspace.newId,
      }),
    );
    expect(scene.keys()).toEqual([
      ["one", "two"],
      ["one", "two"],
    ]);
    expect(await scene.renderGroups()).toEqual({ errors: [], options: 4 });
  });
});
