import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EditTarget,
  EntryId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogCommand } from "../../../../../../packages/shared/src/catalog/commands/compose";
import {
  createPage,
  removePage,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { documentOf } from "../../../../../../packages/shared/src/catalog/commands/__tests__/fixture";
import { CatalogRuntime } from "../controller";
import { CatalogSession } from "../session";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4c session state: selection, hover, editing context, text editing and page live
 * outside the document and every published step (undo/redo included) drops what no longer
 * addresses a shown element.
 */
const PAGE = "project:page:main" as EntryId<"page">;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  patch: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id: id(name),
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...patch,
  }) as NodeEntry;
const text = (name: string, value: string) =>
  node(name, "lib:definition:text", {
    props: { children: { kind: "set", value } },
  });
const item = (target: EditTarget) => ({
  target,
  identity:
    target.kind === "node"
      ? `::${target.id}`
      : `${target.address.instances.join("/")}::${target.address.templatePath.at(-1)}`,
});
const DESCRIPTION_TARGET: EditTarget = {
  kind: "descendant",
  ownerId: id("list"),
  address: {
    instances: [
      id("list"),
      "lib:template:component-listbox__item-1" as TemplateId,
    ],
    templatePath: [
      "lib:template:component-listbox-item-default" as TemplateId,
      "lib:template:component-listbox-item-default__description" as TemplateId,
    ],
  },
};
const DESCRIPTION = item(DESCRIPTION_TARGET);

async function open() {
  const graph = new CatalogGraph(
    documentOf(
      [
        text("a", "A"),
        text("b", "B"),
        node("list", "lib:definition:origin-component-listbox"),
      ],
      ["a", "b", "list"],
    ),
    await buildCodeCatalogLibrary(),
  );
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr248-phase4c-session-${Math.random()}`),
  );
  const session = new CatalogSession(runtime);
  let notices = 0;
  session.subscribe(() => notices++);
  const run = (command: CatalogCommand) => {
    const plan = command(runtime.graph);
    runtime.dispatch(plan.label, plan.ops);
    return plan;
  };
  return { runtime, session, run, notices: () => notices };
}

describe("ADR-248 Phase 4c session state", () => {
  it("drops a removed node and a switched-off template position from the selection; undo does not bring them back", async () => {
    const { runtime, session, run } = await open();
    session.select([item({ kind: "node", id: id("a") }), DESCRIPTION]);
    expect(session.getSnapshot().selection).toHaveLength(2);
    run(removeTargets({ targets: [{ kind: "node", id: id("a") }] }));
    expect(session.getSnapshot().selection).toEqual([DESCRIPTION]);
    run(removeTargets({ targets: [DESCRIPTION_TARGET] }));
    expect(session.getSnapshot().selection).toEqual([]);
    runtime.undo();
    runtime.undo();
    expect(session.getSnapshot().selection).toEqual([]);
    // A target that exists again can be selected again.
    session.select([DESCRIPTION]);
    expect(session.getSnapshot().selection).toEqual([DESCRIPTION]);
    // Removing the owner removes its positions.
    run(removeTargets({ targets: [{ kind: "node", id: id("list") }] }));
    expect(session.getSnapshot().selection).toEqual([]);
  });

  it("toggles additively and drops duplicates and missing targets", async () => {
    const { session } = await open();
    const a = item({ kind: "node", id: id("a") });
    const b = item({ kind: "node", id: id("b") });
    session.select([a, a, item({ kind: "node", id: id("missing") })]);
    expect(session.getSnapshot().selection).toEqual([a]);
    session.select([b], { additive: true });
    session.select([a], { additive: true });
    expect(session.getSnapshot().selection).toEqual([b]);
  });

  it("deduplicates a large replacement selection with bounded identity reads", async () => {
    const { session, runtime, notices } = await open();
    const count = 5000;
    let reads = 0;
    const target: EditTarget = { kind: "node", id: id("a") };
    // Different drawn positions may address the same source node.
    const selection = Array.from({ length: count }, (_, i) => ({
      target,
      get identity() {
        reads++;
        return `drawn-position-${i}`;
      },
    }));
    const revision = runtime.graph.revision;
    const before = notices();
    session.select(selection);
    const selectionReads = reads;
    expect(session.getSnapshot().selection).toHaveLength(count);
    expect(session.getSnapshot().selection[0]).toBe(selection[0]);
    expect(session.getSnapshot().selection[count - 1]).toBe(
      selection[count - 1],
    );
    expect(notices() - before).toBe(1);
    expect(runtime.graph.revision).toBe(revision);
    expect(selectionReads).toBeLessThanOrEqual(count * 6);
  });

  it("preserves first occurrences, distinct identity/target pairs and unchanged snapshots", async () => {
    const { session, notices } = await open();
    const a = item({ kind: "node", id: id("a") });
    const samePositionOtherTarget = {
      ...a,
      target: { kind: "node" as const, id: id("b") },
    };
    const sameTargetOtherPosition = {
      ...a,
      identity: `${a.identity}:instance`,
    };
    const description = { ...DESCRIPTION, identity: a.identity };
    const selected = [
      a,
      samePositionOtherTarget,
      sameTargetOtherPosition,
      description,
    ];
    session.startTextEdit(a);
    session.select([
      a,
      { ...a },
      samePositionOtherTarget,
      sameTargetOtherPosition,
      description,
      { ...description },
    ]);
    const snapshot = session.getSnapshot();
    expect(snapshot.selection).toEqual(selected);
    expect(snapshot.selection[0]).toBe(a);
    expect(snapshot.textEditing).toBe(a);
    const before = notices();
    session.select([...selected, { ...a }, { ...description }]);
    expect(session.getSnapshot()).toBe(snapshot);
    expect(notices()).toBe(before);
    session.select([a, a], { additive: true });
    expect(session.getSnapshot().selection).toEqual([...selected.slice(1), a]);
  });

  it("ends text editing, hover and context with their element; a gone page falls back to the first", async () => {
    const { session, run } = await open();
    const a = item({ kind: "node", id: id("a") });
    session.startTextEdit(a);
    session.setHover(item({ kind: "node", id: id("b") }));
    session.enterContext(id("list"));
    expect(session.getSnapshot()).toMatchObject({
      selection: [a],
      textEditing: a,
      editingContext: id("list"),
    });
    run(
      removeTargets({
        targets: [a.target, { kind: "node", id: id("b") }],
      }),
    );
    expect(session.getSnapshot()).toMatchObject({
      selection: [],
      textEditing: undefined,
      hover: undefined,
      editingContext: id("list"),
    });
    const second = "project:page:second" as EntryId<"page">;
    run(
      createPage({
        page: {
          kind: "page",
          id: second,
          route: "/second",
          name: "Second",
          children: [],
        },
      }),
    );
    session.setPage(second);
    session.select([item({ kind: "node", id: id("list") })]);
    expect(session.getSnapshot().pageId).toBe(second);
    run(removePage({ id: second }));
    expect(session.getSnapshot().pageId).toBe(PAGE);
  });

  it("publishes a new snapshot only when something changed", async () => {
    const { session, run, notices } = await open();
    const a = item({ kind: "node", id: id("a") });
    session.select([a]);
    const snapshot = session.getSnapshot();
    const before = notices();
    session.select([a]);
    run(
      setFields({
        targets: [{ kind: "node", id: id("b") }],
        props: { children: { kind: "set", value: "B2" } },
      }),
    );
    expect(session.getSnapshot()).toBe(snapshot);
    expect(notices()).toBe(before);
  });
});
