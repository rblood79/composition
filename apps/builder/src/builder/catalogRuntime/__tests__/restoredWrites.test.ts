import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { tokenToCSSVar, type TokenRef } from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { catalogDropRestoredWrites } from "../restoredWrites";
import { catalogStyleWritesOf } from "../styleFields";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 사용자 보고 2026-11-11 「변경 후 원상태로 복원했지만 변경 이력이 남는다」 — a Styles value set
 * back to what the instance showed leaves no override (사용자 결정: 보이던 값과 같으면 지움). The
 * palette Button shows `fontWeight` 500 (its rule, a literal) and `radius` from `{radius.full}`.
 */
const BODY = "project:node:home-body" as NodeId;
const BUTTON = "lib:definition:origin-component-button" as LibraryDefinitionId;
const ID = "project:node:button" as NodeId;

let workspace: CatalogWorkspace;
let identity: string;
beforeEach(async () => {
  const library = await buildCodeCatalogLibrary();
  workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:restored" as EntryId<"project">,
        name: "restored writes",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `restored-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const entry: NodeEntry = {
    kind: "node",
    id: ID,
    definitionId: BUTTON,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [entry],
      rootIds: [ID],
      newId: workspace.newId,
    }),
  );
  identity = workspace.root.recordsOfSource(ID)[0]!;
});

/** The Styles panel's write of `styles`, through the restored-write cleanup. */
const writeStyles = (styles: Record<string, string>) =>
  workspace.execute(
    catalogDropRestoredWrites(
      workspace.root,
      [{ target: { kind: "node", id: ID }, identity }],
      setFields({
        targets: [{ kind: "node", id: ID }],
        ...catalogStyleWritesOf(styles),
      } as Parameters<typeof setFields>[0]),
    ),
  );
const ownVisual = () =>
  (workspace.runtime.graph.getEntry(ID) as NodeEntry).visual;

describe("catalogDropRestoredWrites", () => {
  it("a value changed and set back to the shown one leaves no write", () => {
    writeStyles({ fontWeight: "700" });
    expect(ownVisual().fontWeight).toEqual({ kind: "set", value: 700 });
    writeStyles({ fontWeight: "500" });
    expect(ownVisual()).not.toHaveProperty("fontWeight");
    // (One step each — the cleanup joins the write, so one undo brings 700 back.)
    workspace.undo();
    expect(ownVisual().fontWeight).toEqual({ kind: "set", value: 700 });
  });

  it("the shown token chosen again leaves no write", () => {
    writeStyles({ borderRadius: "4px" });
    expect(ownVisual()).toHaveProperty("radius");
    writeStyles({ borderRadius: tokenToCSSVar("{radius.full}" as TokenRef) });
    expect(ownVisual()).not.toHaveProperty("radius");
  });

  it("the shown px typed as a literal leaves no write — it resolves the same", () => {
    // (A literal over the rule's token resolves to the same value and ref — nothing shows apart.)
    writeStyles({ borderRadius: "4px" });
    writeStyles({ borderRadius: "9999px" });
    expect(ownVisual()).not.toHaveProperty("radius");
  });

  it("a value that differs stays", () => {
    writeStyles({ fontWeight: "700" });
    expect(ownVisual().fontWeight).toEqual({ kind: "set", value: 700 });
  });
});
