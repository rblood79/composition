// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A page body of a fixed Height (100%) laid out as a column flex, its content past the screen:
 * the flex shrinks its items, and an item shrinks no lower than its automatic minimum size —
 * its content, unless its overflow is not visible (then 0). Card (no overflow clip) and
 * ProgressCircle (it does not shrink — the DOM's `flex-shrink: 0`, declared by its rule) keep
 * their height on the Canvas as in Publish (user 2026-11-13 — 「Card 도 overflow 삭제」 ·
 * 「ProgressCircle 높이 0」 · 「listbox 도 overflow 삭제」).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function squeeze(
  type: "card" | "progresscircle" | "listbox",
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:squeeze" as EntryId<"project">,
        name: "Squeeze",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `squeeze-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 390, height: 844 },
      autosaveSchedule: () => {},
    },
  );
  const node = (id: string, definitionId: string, sizing = {}) =>
    ({
      kind: "node",
      id,
      definitionId,
      children: [],
      props: {},
      visual: {},
      sizing,
      descendantOverrides: [],
    }) as unknown as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node(PLACED, `lib:definition:origin-component-${type}`)],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const height = () => {
    const record = [...root.canvasInputs.values()].find(
      (candidate) => candidate.sourceId === PLACED,
    )!;
    return root.getGeometry([record.id]).get(record.id)!.height;
  };
  const natural = height();
  const breakpoint = workspace.session.getSnapshot().breakpoint;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("project:node:tall", "lib:definition:type-frame", {
          height: { kind: "set", value: 3000 },
        }),
      ],
      rootIds: ["project:node:tall" as NodeId],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: BODY }],
      breakpoint,
      layout: {
        display: { kind: "set", value: "flex" },
        flexDirection: { kind: "set", value: "column" },
      },
      visual: { height: { kind: "set", value: "100%" } },
    }),
  );
  return { natural, squeezed: height() };
}

describe("a fixed-Height column flex body does not squeeze its items to nothing", () => {
  it("Card keeps its content height (no overflow clip)", async () => {
    const { natural, squeezed } = await squeeze("card");
    expect(natural).toBeGreaterThan(0);
    expect(squeezed).toBe(natural);
  });

  it("ProgressCircle keeps its diameter (it does not shrink)", async () => {
    const { natural, squeezed } = await squeeze("progresscircle");
    expect(natural).toBe(32);
    expect(squeezed).toBe(32);
  });

  it("ListBox keeps its content height (no scroll box of its own outside a picker)", async () => {
    const { natural, squeezed } = await squeeze("listbox");
    expect(natural).toBeGreaterThan(0);
    expect(squeezed).toBe(natural);
  });

});
