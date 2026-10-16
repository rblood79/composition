import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogEntry,
  CatalogLibrary,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  moveNodes,
  removeTargets,
  renameNode,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogPosition } from "../../../../../../packages/shared/src/catalog/resolution/positions";
import { newCatalogProjectDocument } from "../project";
import { catalogCanvasMenuItems } from "../canvasMenu";
import { catalogParentOfNode } from "../insertParent";
import { CatalogReadModel } from "../readModel";
import { catalogMenuHost } from "../shortcuts";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-265 G1 (Phase 1): the edit levers keep every result — random steps (style · text · rename ·
 * insert · move · remove · template part edits and hides · undo · redo) checked after each one
 * against an oracle that does not use the lever:
 *
 * - C1: the step's invalidated ids are the old formula, the walk before the commit and the walk
 *   after it, in that order (`[...new Set([...pre, ...post])]`) — the runtime now skips the second
 *   walk when it cannot differ.
 * - L2 · L3: the graph's indexes equal those of a graph built fresh from its exported document, and
 *   every committed record is frozen all the way down (records now share unchanged fields).
 * - L4: every row list of the read model (page rows and each listed position's child rows, to the
 *   leaves) equals a fresh read model's over the same runtime.
 * - C8 (Phase 2): every drawn row's `positionOfRecord` (a row index per list) is the row a linear
 *   search finds.
 */
const PROJECT = "project:project:adr265" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:q${++next}` as EntryId<K>;
};
/** mulberry32 — a fixed sequence for a fixed seed. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deepFrozen(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(deepFrozen);
}

async function open(library: CatalogLibrary) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-265" }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr265-equivalence-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const newId = allocator();
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("list", "lib:definition:type-frame", [id("a"), id("b"), id("c")]),
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
        node("c", "lib:definition:text"),
        node("box", "lib:definition:type-frame", [id("d")]),
        node("d", "lib:definition:text"),
        node("button", "lib:definition:origin-component-button"),
      ],
      rootIds: [id("list"), id("box"), id("button")],
      newId,
    }),
  );
  return { workspace, newId };
}

/** Every row list the Layers tree could read, from the page down (key → rows). */
function allRows(model: CatalogReadModel, pageId: EntryId<"page">) {
  const out = new Map<string, readonly CatalogPosition[]>();
  const walk = (key: string, rows: readonly CatalogPosition[]) => {
    out.set(key, rows);
    for (const row of rows) walk(row.identity, model.childRows(row));
  };
  walk(pageId, model.pageRows(pageId));
  return out;
}

describe("ADR-265 G1 — Phase 1 edit levers keep every result", () => {
  it("1,200 random steps: invalidated ids, indexes, frozen records, row lists", async () => {
    const library = await buildCodeCatalogLibrary();
    const { workspace, newId } = await open(library);
    const graph = workspace.runtime.graph;
    const pageId = workspace.session.getSnapshot().pageId!;
    const next = random(265);
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(next() * items.length)]!;

    // C1 oracle: the first walk of each step (before the commit) is recorded.
    const walks: ReadonlySet<string>[] = [];
    const collect = graph.collectAffectedIds.bind(graph);
    graph.collectAffectedIds = (ids) => {
      const found = collect(ids);
      walks.push(found);
      return found;
    };
    let invalidated: readonly string[] | undefined;
    let seeds: string[] = [];
    workspace.runtime.subscribeSteps(({ result, invalidatedIds }) => {
      invalidated = invalidatedIds;
      seeds = [...result.changedIds, ...result.removedIds];
    });

    const counts = { steps: 0, skippedWalks: 0, refused: 0 };
    let made = 0;
    for (let step = 0; step < 1_200; step++) {
      const owned = [...allRows(workspace.readModel, pageId).values()]
        .flat()
        .filter((row) => row.target.kind === "node")
        .map((row) => (row.target as { id: NodeId }).id);
      const nodes = [BODY, ...owned];
      const containers = nodes.filter((nodeId) => {
        const entry = graph.getEntry(nodeId);
        return (
          entry?.kind === "node" &&
          (nodeId === BODY ||
            entry.definitionId === "lib:definition:type-frame")
        );
      });
      const parts = [...allRows(workspace.readModel, pageId).values()]
        .flat()
        .filter((row) => row.target.kind === "descendant");
      walks.length = 0;
      invalidated = undefined;
      const roll = next();
      try {
        if (roll < 0.3)
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: pick(nodes) }],
              visual: {
                backgroundColor: {
                  kind: "set",
                  value: `#${Math.floor(next() * 0xffffff)
                    .toString(16)
                    .padStart(6, "0")}`,
                },
              },
            }),
          );
        else if (roll < 0.4 && parts.length)
          workspace.execute(
            setFields({
              targets: [pick(parts).target],
              visual: {
                backgroundColor: { kind: "set", value: "#123456" },
              },
            }),
          );
        else if (roll < 0.45 && parts.length)
          workspace.execute(removeTargets({ targets: [pick(parts).target] }));
        else if (roll < 0.55 && owned.length)
          workspace.execute(renameNode({ id: pick(owned), name: `n${step}` }));
        else if (roll < 0.7) {
          made += 1;
          workspace.execute(
            insertNodes({
              parent: { kind: "node", id: pick(containers) },
              entries: [
                node(
                  `made${made}`,
                  pick([
                    "lib:definition:text",
                    "lib:definition:type-frame",
                    "lib:definition:origin-component-button",
                  ]),
                ),
              ],
              rootIds: [id(`made${made}`)],
              newId,
            }),
          );
        } else if (roll < 0.78 && owned.length)
          workspace.execute(
            moveNodes({
              ids: [pick(owned)],
              parent: { kind: "node", id: pick(containers) },
              newId,
            }),
          );
        else if (roll < 0.84 && owned.length > 3)
          workspace.execute(
            removeTargets({ targets: [{ kind: "node", id: pick(owned) }] }),
          );
        else if (roll < 0.94) workspace.undo();
        else workspace.redo();
      } catch {
        counts.refused += 1;
        continue;
      }
      if (invalidated === undefined) continue; // nothing to undo / redo
      counts.steps += 1;

      // C1: the old formula — the pre-commit walk, then a fresh post-commit walk.
      const pre = walks[0]!;
      const post = collect(seeds);
      if (walks.length === 1) counts.skippedWalks += 1;
      expect(invalidated).toEqual([...new Set([...pre, ...post])]);

      // L2 · L3: indexes as a fresh graph's; committed records frozen all the way down.
      const fresh = new CatalogGraph(graph.exportDocument(), library);
      expect(graph.indexes).toEqual(fresh.indexes);
      for (const changed of seeds) {
        const entry = graph.getEntry(changed) as CatalogEntry | undefined;
        if (entry) expect(deepFrozen(entry)).toBe(true);
      }

      // L4: every row list as a fresh read model computes it.
      const reference = new CatalogReadModel(workspace.runtime);
      const mine = allRows(workspace.readModel, pageId);
      const theirs = allRows(reference, pageId);
      expect([...mine.keys()]).toEqual([...theirs.keys()]);
      for (const [key, rows] of mine) expect(rows).toEqual(theirs.get(key));
      reference.dispose();

      // C8 (Phase 2): a drawn record's row, by the row index, is the row a search finds.
      for (const rows of mine.values())
        for (const row of rows)
          if (workspace.root.domInputs.has(row.identity))
            expect(workspace.positionOfRecord(row.identity)).toEqual(
              rows.find((item) => item.identity === row.identity),
            );
    }
    // The sequence exercised the levers (not a run of refusals).
    expect(counts.steps).toBeGreaterThan(1_000);
    expect(counts.skippedWalks).toBeGreaterThan(200);
    expect(counts.steps - counts.skippedWalks).toBeGreaterThan(100);
  }, 120_000);

  it("C7: one plan decides the z-order items — 1,000 random selections against each move planned", async () => {
    const library = await buildCodeCatalogLibrary();
    const { workspace, newId } = await open(library);
    const graph = workspace.runtime.graph;
    const pageId = workspace.session.getSnapshot().pageId!;
    // More siblings and depth: two frames of eight, a frame in a frame.
    const more = ["e", "f", "g", "h", "i", "j", "k", "l"];
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("box") },
        entries: [
          ...more.map((name) => node(name, "lib:definition:text")),
          node("inner", "lib:definition:type-frame", [id("m"), id("n")]),
          node("m", "lib:definition:text"),
          node("n", "lib:definition:origin-component-button"),
        ],
        rootIds: [...more.map(id), id("inner")],
        newId,
      }),
    );
    const next = random(7);
    const ZORDER = [
      "bring-to-front",
      "bring-forward",
      "send-backward",
      "send-to-back",
    ];
    let checked = 0;
    for (let round = 0; round < 1_000; round++) {
      const drawn = [...allRows(workspace.readModel, pageId).values()]
        .flat()
        .filter(
          (row) =>
            row.target.kind === "node" &&
            workspace.root.domInputs.has(row.identity),
        );
      const count = next() < 0.8 ? 1 : 2;
      const picked = Array.from(
        { length: count },
        () => drawn[Math.floor(next() * drawn.length)]!.identity,
      );
      workspace.selectRecords([...new Set(picked)]);
      const refusals = new Map<string, unknown>();
      const host = {
        ...catalogMenuHost(workspace),
        noteRefusal: (itemId: string, error: unknown) =>
          refusals.set(itemId, error),
      };
      const items = catalogCanvasMenuItems(host, "canvas-element", undefined);
      const shown = items
        .filter((item) => item.kind === "action" && ZORDER.includes(item.id))
        .map((item) => item.id);
      // Each z-order move planned on its own (the menu before ADR-265).
      // (The menu leaves the page body out of the selection it acts on.)
      const selection = workspace.session
        .getSnapshot()
        .selection.filter(
          (item) => item.target.kind !== "node" || item.target.id !== BODY,
        );
      const expected: string[] = [];
      const refused = new Map<string, string>();
      if (selection.length === 1 && selection[0]!.target.kind === "node") {
        const nodeId = selection[0]!.target.id as NodeId;
        const record = host.records.get(selection[0]!.identity)!;
        const parent = host.records.get(record.parentId);
        const into = catalogParentOfNode(graph, nodeId);
        if (parent && into) {
          const index = parent.children.indexOf(record.id);
          const siblings = parent.children.length - 1;
          const moves: [string, number][] = [
            ...(index < siblings
              ? ([
                  ["bring-to-front", siblings],
                  ["bring-forward", index + 1],
                ] as [string, number][])
              : []),
            ...(index > 0
              ? ([
                  ["send-backward", index - 1],
                  ["send-to-back", 0],
                ] as [string, number][])
              : []),
          ];
          for (const [itemId, to] of moves)
            try {
              moveNodes({
                ids: [nodeId],
                parent: into,
                index: to,
                newId,
                label: "Reorder",
              })(graph);
              expected.push(itemId);
            } catch (error) {
              refused.set(itemId, String((error as { code?: string }).code));
            }
          checked += 1;
        }
      }
      expect(shown).toEqual(expected);
      for (const itemId of ZORDER)
        expect(
          refusals.has(itemId)
            ? String((refusals.get(itemId) as { code?: string }).code)
            : undefined,
        ).toBe(refused.get(itemId));
    }
    expect(checked).toBeGreaterThan(600);
  }, 120_000);
});
