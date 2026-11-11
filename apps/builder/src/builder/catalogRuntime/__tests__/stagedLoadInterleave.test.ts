import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createPage,
  groupNodes,
  insertNodes,
  moveNodes,
  removePage,
  removeTargets,
  reorderPages,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogCompositionRoot } from "../compositionRoot";
import {
  authorStagedFixture,
  buildStagedRoot,
  stagedEntries,
  stagedGraph,
  stagedNodeId,
  stagedSnapshot as snapshot,
} from "./support/stagedLoadFixture";

/**
 * ADR-307 G2 — edits between fill units: a step never fills what the fill has not reached, the fill
 * goes on from the edited document, and the end state is the one a batch-built root reaches with
 * the same edits. Undo · redo, page structure, a template edit, a data refresh, a node request
 * (`fillNode`) and an engine failure after an edit included.
 */
type Root = CatalogCompositionRoot;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const node = (id: string) => ({ kind: "node" as const, id: id as NodeId });
const newIds = (): NewId => {
  let next = 0;
  return ((kind: string) => `project:${kind}:new-${next++}`) as NewId;
};
const children = (root: Root, id: string): NodeId[] => {
  const entry = stagedGraph(root).getEntry(id);
  if (entry?.kind !== "node") throw new Error(`fixture:${id}`);
  return [...entry.children];
};
/** The flex page: body > column > [title, cards row, deep column, footer]. */
const flex = (root: Root) => {
  const body = stagedNodeId("flex-body");
  const [column] = children(root, body);
  const [title, cards, deep, footer] = children(root, column);
  return { body, column, title, cards, deep, footer };
};
/** `units` single-unit tasks of a page root. */
const fillUnits = (root: Root, rootId: NodeId, units: number) => {
  for (let index = 0; index < units; index++)
    root.fill(rootId, { deadline: () => true });
};
const fillAll = (root: Root) => {
  for (let guard = 0; root.pendingFillRoots().length; guard++) {
    if (guard > 100) throw new Error("fill does not end");
    for (const rootId of root.pendingFillRoots())
      expect(root.fill(rootId).status).toBe("filled");
  }
};

describe("ADR-307 edits between fill units (G2)", () => {
  beforeAll(async () => {
    await authorStagedFixture();
  }, 60_000);

  /**
   * `edit` on a batch-built root, and on a staged root with `units` units of the flex page in —
   * then the staged root is filled: the two end in the same state.
   */
  const converge = async (
    edit: (root: Root) => void,
    units: number,
    check?: (root: Root, before: number) => void,
  ) => {
    const batch = await buildStagedRoot();
    edit(batch);
    const staged = await buildStagedRoot({ unitLimit: 3 });
    fillUnits(staged, flex(staged).body, units);
    const before = staged.domInputs.size;
    const pending = staged.pendingFillRoots().length;
    edit(staged);
    check?.(staged, before);
    // A step fills no root.
    expect(staged.pendingFillRoots().length).toBeGreaterThanOrEqual(
      Math.min(pending, staged.pendingFillRoots({ failed: true }).length),
    );
    fillAll(staged);
    expect(snapshot(staged)).toEqual(snapshot(batch));
  };

  const EDITS: Record<string, (root: Root) => void> = {
    "a value of the shell column": (root) =>
      root.execute(
        setFields({
          targets: [node(flex(root).column)],
          visual: { gap: set(40) },
        }),
      ),
    "a value of the first child": (root) =>
      root.execute(
        setFields({
          targets: [node(flex(root).title)],
          props: { children: set("Changed title") },
        }),
      ),
    "a value of the last child": (root) =>
      root.execute(
        setFields({
          targets: [node(flex(root).footer)],
          props: { children: set("Changed footer") },
        }),
      ),
    "a node put in front": (root) => {
      const { entries, rootIds } = stagedEntries([
        { text: "Inserted first", name: "ins-front" },
      ]);
      root.execute(
        insertNodes({
          parent: node(flex(root).column),
          index: 0,
          entries,
          rootIds,
          newId: newIds(),
        }),
      );
    },
    "a node put at the end": (root) => {
      const { entries, rootIds } = stagedEntries([
        { text: "Inserted last", name: "ins-end" },
      ]);
      root.execute(
        insertNodes({
          parent: node(flex(root).column),
          entries,
          rootIds,
          newId: newIds(),
        }),
      );
    },
    "a node put into the deep column": (root) => {
      const { entries, rootIds } = stagedEntries([
        { text: "Inserted deep", name: "ins-deep" },
      ]);
      root.execute(
        insertNodes({
          parent: node(flex(root).deep),
          index: 0,
          entries,
          rootIds,
          newId: newIds(),
        }),
      );
    },
    "the first child removed": (root) =>
      root.execute(removeTargets({ targets: [node(flex(root).title)] })),
    "the last child removed": (root) =>
      root.execute(removeTargets({ targets: [node(flex(root).footer)] })),
    "a heavy child removed": (root) =>
      root.execute(removeTargets({ targets: [node(flex(root).cards)] })),
    "the last child moved to the front": (root) =>
      root.execute(
        moveNodes({
          ids: [flex(root).footer],
          parent: node(flex(root).column),
          index: 0,
          newId: newIds(),
        }),
      ),
    "the first child moved to the end": (root) =>
      root.execute(
        moveNodes({
          ids: [flex(root).title],
          parent: node(flex(root).column),
          newId: newIds(),
        }),
      ),
    "a heavy child moved to another page": (root) =>
      root.execute(
        moveNodes({
          ids: [flex(root).cards],
          parent: node(stagedNodeId("wide-body")),
          index: 0,
          newId: newIds(),
        }),
      ),
    "an edit, its undo and its redo": (root) => {
      root.execute(removeTargets({ targets: [node(flex(root).cards)] }));
      root.undo();
      root.redo();
    },
    "an edit and its undo": (root) => {
      root.execute(
        moveNodes({
          ids: [flex(root).footer],
          parent: node(flex(root).column),
          index: 0,
          newId: newIds(),
        }),
      );
      root.undo();
    },
  };
  for (const [name, edit] of Object.entries(EDITS))
    for (const units of [0, 2, 9])
      it(`${name}, ${units} units in`, () => converge(edit, units));

  it("a value edit of a page that is still a shell resolves nothing of it", () =>
    converge(EDITS["a value of the last child"], 0, (root, before) =>
      expect(root.domInputs.size).toBe(before),
    ));

  const PAGE_EDITS: Record<string, (root: Root) => void> = {
    "a page added": (root) => {
      const { entries, rootIds } = stagedEntries([
        { text: "New page", name: "added-text" },
      ]);
      const body: NodeEntry = {
        kind: "node",
        id: stagedNodeId("added-body"),
        definitionId: "lib:definition:type-body",
        name: "Body",
        children: rootIds,
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      root.execute(
        createPage({
          page: {
            kind: "page",
            id: "project:page:added" as EntryId<"page">,
            route: "/added",
            name: "added",
            children: [body.id],
          },
          entries: [body, ...entries],
          index: 2,
        }),
      );
    },
    "a page removed": (root) =>
      root.execute(removePage({ id: "project:page:grid" as EntryId<"page"> })),
    "the pages reversed": (root) => {
      const graph = stagedGraph(root);
      const project = graph.getEntry(graph.projectId);
      if (project?.kind !== "project") throw new Error("fixture");
      root.execute(reorderPages({ ids: [...project.pageIds].reverse() }));
    },
    "a page removed and brought back": (root) => {
      root.execute(removePage({ id: "project:page:wide" as EntryId<"page"> }));
      root.undo();
    },
  };
  for (const [name, edit] of Object.entries(PAGE_EDITS))
    for (const units of [0, 5])
      it(`${name}, ${units} units in: the other shells stay shells`, () =>
        converge(edit, units, (root, before) => {
          // (The step resolved the roots as they stood: no shell was filled by it.)
          expect(root.domInputs.size).toBeLessThan(before + 8);
          expect(root.pendingFillRoots().length).toBeGreaterThan(4);
        }));

  it("a layout template's edit reaches a partly filled page of it", async () => {
    const edit = (root: Root) => {
      const [header] = children(root, stagedNodeId("shell"));
      root.execute(
        setFields({
          targets: [node(header)],
          props: { children: set("Changed shell header") },
        }),
      );
    };
    for (const units of [0, 1, 4]) {
      const batch = await buildStagedRoot();
      edit(batch);
      const staged = await buildStagedRoot({ unitLimit: 3 });
      // (The page's root is the layout's instance; the fixture's body sits in its slot.)
      const shelled = staged
        .pendingFillRoots()
        .find((id) => staged.pageOfRoot(id) === "project:page:shelled")!;
      fillUnits(staged, shelled, units);
      edit(staged);
      fillAll(staged);
      expect(snapshot(staged)).toEqual(snapshot(batch));
    }
  });

  // (Phase 2 review H1.) A layout's template position and a page node in its slot keep their
  // identity when the template nests them elsewhere: a held-back position that moved under a new
  // container is listed by no shell any more — the root is resolved whole.
  const shelledRoot = (root: Root) =>
    root
      .pendingFillRoots()
      .find((id) => root.pageOfRoot(id) === "project:page:shelled")!;
  const TEMPLATE_EDITS: Record<string, (root: Root) => void> = {
    "the layout's header grouped": (root) => {
      const [header] = children(root, stagedNodeId("shell"));
      const { entries } = stagedEntries([{ frame: [], name: "tpl-group-a" }]);
      root.execute(
        groupNodes({
          ids: [header],
          group: { ...entries[0], children: [] },
          newId: newIds(),
        }),
      );
    },
    "the layout's footer grouped": (root) => {
      const footer = children(root, stagedNodeId("shell")).at(-1)!;
      const { entries } = stagedEntries([{ frame: [], name: "tpl-group-b" }]);
      root.execute(
        groupNodes({
          ids: [footer],
          group: { ...entries[0], children: [] },
          newId: newIds(),
        }),
      );
    },
    "the layout's header moved into a new frame": (root) => {
      const { entries, rootIds } = stagedEntries([
        { frame: [], name: "tpl-wrap" },
      ]);
      root.execute(
        insertNodes({
          parent: node(stagedNodeId("shell")),
          index: 1,
          entries,
          rootIds,
          newId: newIds(),
        }),
      );
      const [header] = children(root, stagedNodeId("shell"));
      root.execute(
        moveNodes({
          ids: [header],
          parent: node(stagedNodeId("tpl-wrap")),
          newId: newIds(),
        }),
      );
    },
  };
  for (const [name, edit] of Object.entries(TEMPLATE_EDITS))
    for (const units of [0, 1, 3])
      it(`${name}, ${units} units in: the moved position is still filled`, async () => {
        const batch = await buildStagedRoot();
        edit(batch);
        const staged = await buildStagedRoot({ unitLimit: 3 });
        fillUnits(staged, shelledRoot(staged), units);
        edit(staged);
        fillAll(staged);
        expect(snapshot(staged)).toEqual(snapshot(batch));
      });

  // (Phase 2 review M1.) A shell that goes and comes back (a delete and its undo) is resolved
  // whole by the step that brings it back: the next step must not refuse what now has a record.
  for (const units of [3, 5, 6])
    it(`a shell removed and brought back, then an edit inside it, ${units} units in`, async () => {
      const edit = (root: Root) => {
        const { cards } = flex(root);
        root.execute(removeTargets({ targets: [node(cards)] }));
        root.undo();
        const card = children(root, cards)[4];
        const { entries, rootIds } = stagedEntries([
          { text: "Into a card", name: "back-into" },
        ]);
        root.execute(
          insertNodes({
            parent: node(card),
            index: 0,
            entries,
            rootIds,
            newId: newIds(),
          }),
        );
      };
      const batch = await buildStagedRoot();
      edit(batch);
      const staged = await buildStagedRoot({ unitLimit: 3 });
      fillUnits(staged, flex(staged).body, units);
      edit(staged);
      fillAll(staged);
      expect(snapshot(staged)).toEqual(snapshot(batch));
    });

  it("a data refresh between units leaves the unfilled positions to the fill", async () => {
    const batch = await buildStagedRoot();
    batch.refreshRows();
    for (const units of [0, 1, 2]) {
      const staged = await buildStagedRoot({ unitLimit: 3 });
      fillUnits(staged, stagedNodeId("bound-body"), units);
      expect(staged.refreshRows()).toEqual([]);
      staged.refreshState();
      fillAll(staged);
      expect(snapshot(staged)).toEqual(snapshot(batch));
    }
  });

  it("a requested node is filled out of document order, whole; the rest follows", async () => {
    const batch = snapshot(await buildStagedRoot());
    const staged = await buildStagedRoot({ unitLimit: 3 });
    const page = flex(staged);
    // The deep column's innermost Button: its owners are shells, in the middle of the page.
    const [inner] = children(staged, page.deep);
    const [innermost] = children(staged, inner);
    const button = children(staged, innermost).at(-1)!;
    expect(staged.recordsOfSource(button)).toEqual([]);
    const report = staged.fillNode(button);
    expect(report.status).toBe("partial");
    expect(report.errors).toEqual([]);
    expect(staged.recordsOfSource(button).length).toBe(1);
    // Not the page: what stands before it in the document is still missing.
    expect(staged.recordsOfSource(page.title)).toEqual([]);
    expect(staged.pendingFillRoots()).toContain(page.body);
    // Then the last child, then a heavy one — whole, whatever the unit limit.
    staged.fillNode(page.footer);
    staged.fillNode(page.cards);
    expect(staged.recordsOfSource(page.footer).length).toBe(1);
    const cells = children(staged, children(staged, page.cards)[5]);
    expect(staged.recordsOfSource(cells[1]).length).toBe(1);
    // A node whose records are all in: nothing to do.
    expect(staged.fillNode(button).units).toBe(0);
    // A node of a page whose body is a layout's instance, and of a repeated month block.
    const shelled = children(
      staged,
      children(staged, stagedNodeId("shelled-body"))[0],
    ).at(-1)!;
    staged.fillNode(shelled);
    expect(staged.recordsOfSource(shelled).length).toBe(1);
    fillAll(staged);
    expect(snapshot(staged)).toEqual(batch);
  });

  it("an engine failure of the task after an edit rolls back to the edited state", async () => {
    let failing = false;
    const wrap = (
      engine: Parameters<NonNullable<Parameters<typeof buildStagedRoot>[1]>>[0],
    ) => ({
      ...engine,
      computeLayout: (...args: Parameters<typeof engine.computeLayout>) => {
        if (failing) {
          failing = false;
          throw new Error("ENGINE_DOWN");
        }
        return engine.computeLayout(...args);
      },
    });
    const edit = EDITS["a node put in front"];
    const batch = await buildStagedRoot();
    edit(batch);
    const staged = await buildStagedRoot({ unitLimit: 3 }, wrap);
    const { body } = flex(staged);
    fillUnits(staged, body, 3);
    edit(staged);
    const edited = snapshot(staged);
    failing = true;
    expect(staged.fill(body, { deadline: () => true }).status).toBe("failed");
    expect(snapshot(staged)).toEqual(edited);
    expect(staged.pendingFillRoots()).not.toContain(body);
    // The next step lets the root try again (a new revision).
    staged.execute(
      setFields({
        targets: [node(flex(staged).column)],
        visual: { gap: set(24) },
      }),
    );
    batch.execute(
      setFields({
        targets: [node(flex(batch).column)],
        visual: { gap: set(24) },
      }),
    );
    expect(staged.pendingFillRoots()).toContain(body);
    fillAll(staged);
    expect(snapshot(staged)).toEqual(snapshot(batch));
  });
});
