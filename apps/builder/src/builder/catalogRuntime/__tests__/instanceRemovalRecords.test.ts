// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Removing an instance removes its records — the ones its origin's template gives too, not only the
 * document entries the step removed. (The owned-removal fast path removed only the records of the
 * removed entries: a Select's Label · Button · ListBox · items … stayed in the Canvas and DOM inputs,
 * and a node the author had put into one of its items left that item pointing at a removed child —
 * the Canvas scene failed with `CATALOG_CANVAS_CHILD_REQUIRED`, ADR-256 Phase 6f live.)
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const MARK = "project:node:mark" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:instance-removal" as EntryId<"project">,
        name: "Instance removal",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `instance-removal-${Math.random()}`),
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
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

/** Records of the removed instance left on one side, and children pointing at no record. */
function leftovers(records: ReadonlyMap<string, CatalogConsumerNode>) {
  return {
    left: [...records.keys()].filter((id) => id.includes(FIELD)),
    dangling: [...records.values()].flatMap((record) =>
      record.children
        .filter((child) => !records.has(child))
        .map((child) => `${record.id} -> ${child}`),
    ),
  };
}

describe("removing an instance removes its records", () => {
  it.each(["select", "combobox", "datepicker", "listbox"])(
    "%s: none of its records stays on either side",
    async (type) => {
      const workspace = await open(type);
      const root = workspace.root;
      const field = [...root.canvasInputs.values()].find(
        (record) => record.sourceId === FIELD,
      )!;
      expect(leftovers(root.canvasInputs).left.length).toBeGreaterThan(1);
      workspace.execute(
        removeTargets({ targets: [workspace.positionOfRecord(field.id)!.target] }),
      );
      for (const records of [root.canvasInputs, root.domInputs])
        expect(leftovers(records)).toEqual({ left: [], dangling: [] });
      // … and undo brings them back.
      workspace.undo();
      expect(leftovers(root.canvasInputs).left.length).toBeGreaterThan(1);
      expect(leftovers(root.canvasInputs).dangling).toEqual([]);
    },
  );

  it("a node the author put into one of its items goes with it — no item points at a removed child", async () => {
    const workspace = await open("select");
    const root = workspace.root;
    const item = [...root.canvasInputs.values()].find((record) =>
      record.sourceId.endsWith("__item-3"),
    )!;
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(item.id)!.target as never,
        index: 0,
        entries: [
          {
            kind: "node",
            id: MARK,
            definitionId: "lib:definition:type-Icon",
            children: [],
            props: { iconName: set("check") },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [MARK],
        newId: workspace.newId,
      }),
    );
    const field = [...root.canvasInputs.values()].find(
      (record) => record.sourceId === FIELD,
    )!;
    workspace.execute(
      removeTargets({ targets: [workspace.positionOfRecord(field.id)!.target] }),
    );
    for (const records of [root.canvasInputs, root.domInputs])
      expect(leftovers(records)).toEqual({ left: [], dangling: [] });
  });
});
