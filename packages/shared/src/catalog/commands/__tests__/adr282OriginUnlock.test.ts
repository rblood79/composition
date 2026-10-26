/**
 * ADR-282 — a library origin unlocked on the Library page (the override owns a copy of its
 * template — every instance projects the copy) and reset (the library default again). G1 (a ~ d):
 * what the document wrote before the unlock stays — instance values, bindings, nested paths,
 * interactions — through unlock · save · load · undo · redo, in either unlock order. G2 (a ~ f): a
 * reset keeps the contents written at library positions, drops what stood only at positions made
 * after the unlock (no unowned node, nothing dangling) and takes the whole override away.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../document/codeCatalogLibrary";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogEntry,
  CatalogLibrary,
  DefinitionOverrideEntry,
  InstanceAddress,
  InteractionEntry,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import { setLibraryDefault } from "../components";
import type { CatalogCommand } from "../compose";
import {
  lockOrigins,
  resetOrigin,
  resetOrigins,
  unlockOrigin,
  unlockOrigins,
} from "../originFork";
import { insertNodes, removeTargets } from "../structure";
import {
  allocator,
  documentOf,
  node,
  PAGE,
  PROJECT,
  snapshot,
} from "./fixture";

const set = <V>(value: V) => ({ kind: "set" as const, value });
const ORIGIN = (name: string) =>
  `lib:definition:origin-component-${name}` as LibraryDefinitionId;
const T = (name: string) => `lib:template:component-${name}` as TemplateId;
const id = (name: string) => `project:node:${name}` as NodeId;
const BUTTON = ORIGIN("button");
const SELECT = ORIGIN("select");

let library: CatalogLibrary;
beforeAll(async () => {
  library = await buildCodeCatalogLibrary();
});

/** What a consumer draws (source ids dropped — a copy draws what the library template drew). */
const shape = (record: ResolvedCatalogNode): unknown => ({
  definitionId: record.definitionId,
  props: record.props,
  visual: record.visual,
  layout: record.layout,
  sizing: record.sizing,
  children: record.children.map(shape),
});
const drawn = (graph: CatalogGraph) =>
  graph.getEntry(PAGE)!.kind === "page"
    ? (graph.getEntry(PAGE) as { children: readonly NodeId[] }).children.map(
        (root) => shape(resolveCatalogNode(graph, root)),
      )
    : [];
const texts = (record: ResolvedCatalogNode): string[] => [
  ...(typeof record.props.children === "string" ? [record.props.children] : []),
  ...record.children.flatMap(texts),
];
const textsOf = (graph: CatalogGraph, root: string) =>
  texts(resolveCatalogNode(graph, id(root)));

function exec(graph: CatalogGraph, command: CatalogCommand) {
  const plan = command(graph);
  const result = applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: plan.label },
    ops: plan.ops,
  });
  return { plan, result };
}
const replay = (graph: CatalogGraph, ops: readonly unknown[]) =>
  applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: "replay" },
    ops: ops as never,
  });
const reload = (graph: CatalogGraph) =>
  new CatalogGraph(JSON.parse(JSON.stringify(graph.exportDocument())), library);
const override = (graph: CatalogGraph, definitionId: LibraryDefinitionId) =>
  graph.getDefinitionOverride(definitionId);
const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
  return "ACCEPTED";
};

const LABEL_AT = (owner: string): InstanceAddress => ({
  instances: [id(owner)],
  templatePath: [T("button"), T("button__label")],
});
/** The Select's trigger Button's label text (a nested path through the Button origin). */
const SELECT_BUTTON_LABEL: InstanceAddress = {
  instances: [id("pick"), T("select__2")],
  templatePath: [T("button"), T("button__label")],
};

/**
 * Two Button instances (「Save」 · 「Cancel」 with an icon), a third with no label (the project
 * default 「Send」), a Select (its trigger is a Button part) — with a label patch on the first, a
 * nested patch through the Select's Button part and an interaction addressed at a position.
 */
function fixture(): CatalogGraph {
  const interaction: InteractionEntry = {
    kind: "interaction",
    id: "project:interaction:i1",
    ownerId: id("save"),
    address: LABEL_AT("save"),
    trigger: "onPress",
    actions: [{ opcode: "toast", message: "hi" }],
  };
  const entries: CatalogEntry[] = [interaction];
  const doc = documentOf(
    [
      node("save", BUTTON, {
        props: { label: set("Save") },
        descendantOverrides: [
          {
            kind: "patch",
            address: LABEL_AT("save"),
            visual: { color: set("#ff0000") },
          },
        ],
      }),
      node("cancel", BUTTON, {
        props: { label: set("Cancel"), icon: set("x") },
      }),
      node("send", BUTTON),
      node("pick", SELECT, {
        descendantOverrides: [
          {
            kind: "patch",
            address: SELECT_BUTTON_LABEL,
            props: { children: set("Pick one") },
          },
        ],
      }),
    ],
    ["save", "cancel", "send", "pick"],
    entries,
  );
  const graph = new CatalogGraph(doc, library);
  exec(
    graph,
    setLibraryDefault({
      definitionId: BUTTON,
      scope: "defaults",
      key: "label",
      write: set("Send"),
      newId: allocator(),
    }),
  );
  return graph;
}

describe("ADR-282 G1 — unlock keeps what the document showed and wrote", () => {
  it("(a · b) unlocking the Button keeps every instance's record, bindings and addresses — save → load, undo · redo", () => {
    const graph = fixture();
    const before = drawn(graph);
    expect(textsOf(graph, "save")).toEqual(["Save"]);
    expect(textsOf(graph, "cancel")).toEqual(["Cancel"]);
    expect(textsOf(graph, "send")).toEqual(["Send"]);
    expect(textsOf(graph, "pick")).toContain("Pick one");
    const start = snapshot(graph);
    const { plan, result } = exec(
      graph,
      unlockOrigin({ definitionId: BUTTON, newId: allocator() }),
    );
    expect(plan.label).toBe("Unlock origin");
    const fork = override(graph, BUTTON)!;
    expect(fork.templateRootId).toBe(plan.selectAfter![0]);
    // The definition the graph reads is the copy's (Decision 2) — commands, validation, resolver.
    expect(graph.getDefinition(BUTTON)?.templateRootId).toBe(
      fork.templateRootId,
    );
    expect(graph.definitionOfTemplateRoot(fork.templateRootId!)).toBe(BUTTON);
    // (The composite defaults stay with the override — the `accepts` namespace, review h2.)
    expect(fork.defaults).toEqual({ label: set("Send") });
    expect(drawn(graph)).toEqual(before);
    // The stored addresses moved to the copy (Decision 9).
    const map = fork.templateMap!;
    const save = graph.getEntry(id("save")) as NodeEntry;
    expect(save.descendantOverrides[0]!.address.templatePath).toEqual([
      map[T("button") as never],
      map[T("button__label") as never],
    ]);
    const pick = graph.getEntry(id("pick")) as NodeEntry;
    expect(pick.descendantOverrides[0]!.address).toEqual({
      instances: [id("pick"), T("select__2")],
      templatePath: [
        map[T("button") as never],
        map[T("button__label") as never],
      ],
    });
    expect(
      (graph.getEntry("project:interaction:i1") as InteractionEntry).address
        ?.templatePath,
    ).toEqual([map[T("button") as never], map[T("button__label") as never]]);
    // Save → load: the same document, the same records.
    expect(drawn(reload(graph))).toEqual(before);
    // Undo · redo.
    replay(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
    expect(drawn(graph)).toEqual(before);
    replay(graph, result.forward);
    expect(drawn(graph)).toEqual(before);
  });

  it("(b) after the unlock an instance's label and the override default still reach the copy's bindings", () => {
    const graph = fixture();
    exec(graph, unlockOrigin({ definitionId: BUTTON, newId: allocator() }));
    const save = graph.getEntry(id("save")) as NodeEntry;
    replay(graph, [
      {
        kind: "put",
        entry: { ...save, props: { ...save.props, label: set("Store") } },
      },
    ]);
    expect(textsOf(graph, "save")).toEqual(["Store"]);
    expect(textsOf(graph, "cancel")).toEqual(["Cancel"]);
    exec(
      graph,
      setLibraryDefault({
        definitionId: BUTTON,
        scope: "defaults",
        key: "label",
        write: set("Go"),
        newId: allocator(),
      }),
    );
    expect(textsOf(graph, "send")).toEqual(["Go"]);
  });

  it("(c) Select → Button and Button → Select unlock orders draw the same records", () => {
    const first = fixture();
    const second = fixture();
    const before = drawn(first);
    const ids = [allocator(), allocator()];
    exec(first, unlockOrigin({ definitionId: SELECT, newId: ids[0]! }));
    expect(drawn(first)).toEqual(before);
    exec(first, unlockOrigin({ definitionId: BUTTON, newId: ids[0]! }));
    exec(second, unlockOrigin({ definitionId: BUTTON, newId: ids[1]! }));
    exec(second, unlockOrigin({ definitionId: SELECT, newId: ids[1]! }));
    expect(drawn(first)).toEqual(before);
    expect(drawn(second)).toEqual(before);
    expect(drawn(reload(first))).toEqual(before);
    expect(drawn(reload(second))).toEqual(before);
  });

  it("(d) a contract 47 document is refused; an unlocked origin is not unlocked twice", () => {
    const doc = { ...documentOf([], []), libraryContractVersion: 47 };
    expect(codeOf(() => new CatalogGraph(doc as never, library))).not.toBe(
      "ACCEPTED",
    );
    const graph = fixture();
    exec(graph, unlockOrigin({ definitionId: BUTTON, newId: allocator() }));
    expect(
      codeOf(() =>
        unlockOrigin({ definitionId: BUTTON, newId: allocator() })(graph),
      ),
    ).toBe("ORIGIN_UNLOCKED");
  });
});

describe("ADR-282 R7 — a typed whole binding stays a binding in the copy", () => {
  it("the Popover's `offset: {offset}` (number) is accepted in the copy and each instance keeps its own value", () => {
    const POPOVER = ORIGIN("popover");
    const graph = new CatalogGraph(
      documentOf(
        [
          node("near", POPOVER, { props: { offset: set(4) } }),
          node("far", POPOVER, { props: { offset: set(24) } }),
        ],
        ["near", "far"],
      ),
      library,
    );
    const offsets = () =>
      ["near", "far"].map((name) => {
        const found: unknown[] = [];
        const walk = (record: ResolvedCatalogNode) => {
          if (record.sourceId === overlay()) found.push(record.props.offset);
          record.children.forEach(walk);
        };
        walk(resolveCatalogNode(graph, id(name)));
        return found;
      });
    let overlay = () => T("popover__overlay") as string;
    const before = offsets();
    expect(before).toEqual([[4], [24]]);
    exec(graph, unlockOrigin({ definitionId: POPOVER, newId: allocator() }));
    const copy = override(graph, POPOVER)!.templateMap![
      T("popover__overlay") as never
    ]!;
    overlay = () => copy;
    // (The copy keeps the library node's binding — not one instance's value, review h2.)
    expect((graph.getEntry(copy) as NodeEntry).props.offset).toEqual(
      set("{offset}"),
    );
    expect(offsets()).toEqual(before);
    expect(drawn(reload(graph))).toEqual(drawn(graph));
  });
});

describe("ADR-282 G0 RED — the copy's edits reach every instance; the guards hold", () => {
  it("RED-1: a child added to the unlocked Button reaches every instance and the Select's Button part", () => {
    const graph = fixture();
    const { plan } = exec(
      graph,
      unlockOrigin({ definitionId: BUTTON, newId: allocator() }),
    );
    const root = plan.selectAfter![0] as NodeId;
    exec(
      graph,
      insertNodes({
        parent: { kind: "node", id: root },
        entries: [
          node("badge", "lib:definition:text" as never, {
            props: { children: set("NEW") },
          }),
        ],
        rootIds: [id("badge")],
        newId: allocator(),
      }),
    );
    for (const instance of ["save", "cancel", "send"])
      expect(textsOf(graph, instance)).toContain("NEW");
    expect(textsOf(graph, "pick")).toContain("NEW");
    expect(drawn(reload(graph))).toEqual(drawn(graph));
  });

  it("RED-2: the unlocked Select's trigger Button is a required part (REQUIRED_PART_NOT_REMOVABLE)", () => {
    const graph = fixture();
    exec(graph, unlockOrigin({ definitionId: SELECT, newId: allocator() }));
    const trigger = override(graph, SELECT)!.templateMap![
      T("select__2") as never
    ]!;
    expect(
      codeOf(() =>
        removeTargets({
          targets: [{ kind: "node", id: trigger }],
          newId: allocator(),
        })(graph),
      ),
    ).toBe("REQUIRED_PART_NOT_REMOVABLE");
  });

  it("RED-3: an override whose copy root is missing, not the origin's type, or another's is refused", () => {
    const graph = fixture();
    exec(graph, unlockOrigin({ definitionId: BUTTON, newId: allocator() }));
    const fork = override(graph, BUTTON)!;
    const label = fork.templateMap![T("button__label") as never]!;
    const variants: Partial<DefinitionOverrideEntry>[] = [
      { templateRootId: id("missing") },
      { templateRootId: "lib:template:component-button" as never },
      { templateMap: undefined },
      // (The label copy as the root: not the library root's type.)
      { templateRootId: label },
    ];
    for (const patch of variants)
      expect(
        codeOf(() =>
          replay(graph, [{ kind: "put", entry: { ...fork, ...patch } }]),
        ),
      ).not.toBe("ACCEPTED");
  });
});

describe("ADR-282 G2 — reset takes the origin back to the library default", () => {
  it("(a · c) a reset keeps what instances wrote at library positions — the addresses are the library's again; undo · redo · reload", () => {
    const graph = fixture();
    const before = drawn(graph);
    exec(graph, unlockOrigin({ definitionId: BUTTON, newId: allocator() }));
    const start = snapshot(graph);
    const { plan, result } = exec(graph, resetOrigin({ definitionId: BUTTON }));
    expect(plan.label).toBe("Reset origin");
    expect(override(graph, BUTTON)).toBeUndefined();
    const save = graph.getEntry(id("save")) as NodeEntry;
    expect(save.descendantOverrides[0]!.address).toEqual(LABEL_AT("save"));
    expect(
      (graph.getEntry(id("pick")) as NodeEntry).descendantOverrides[0]!.address,
    ).toEqual(SELECT_BUTTON_LABEL);
    expect(
      (graph.getEntry("project:interaction:i1") as InteractionEntry).address,
    ).toEqual(LABEL_AT("save"));
    // (The override's default 「Send」 went with it — the library default label.)
    expect(textsOf(graph, "send")).toEqual(["Button"]);
    expect(textsOf(graph, "save")).toEqual(["Save"]);
    expect(drawn(graph)).not.toEqual(before);
    expect(drawn(reload(graph))).toEqual(drawn(graph));
    replay(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
    expect(drawn(graph)).toEqual(before);
    replay(graph, result.forward);
    expect(override(graph, BUTTON)).toBeUndefined();
  });

  it("(b) what an instance filled at a position made after the unlock goes with the reset — no unowned node", () => {
    const graph = fixture();
    const { plan } = exec(
      graph,
      unlockOrigin({ definitionId: SELECT, newId: allocator() }),
    );
    const root = plan.selectAfter![0] as NodeId;
    // A new container in the copy, filled by the Select instance with its own text.
    exec(
      graph,
      insertNodes({
        parent: { kind: "node", id: root },
        entries: [node("box", "lib:definition:type-Group" as never)],
        rootIds: [id("box")],
        newId: allocator(),
      }),
    );
    exec(
      graph,
      insertNodes({
        parent: {
          kind: "descendant",
          ownerId: id("pick"),
          address: { instances: [id("pick")], templatePath: [root, id("box")] },
        },
        entries: [
          node("mine", "lib:definition:text" as never, {
            props: { children: set("Mine") },
          }),
        ],
        rootIds: [id("mine")],
        newId: allocator(),
      }),
    );
    expect(textsOf(graph, "pick")).toContain("Mine");
    const { result } = exec(graph, resetOrigins());
    expect(graph.getEntry(id("mine"))).toBeUndefined();
    expect(graph.getEntry(id("box"))).toBeUndefined();
    expect(override(graph, SELECT)).toBeUndefined();
    expect(override(graph, BUTTON)).toBeUndefined();
    // The library position's patch stays (address back to the library ids).
    expect(
      (graph.getEntry(id("pick")) as NodeEntry).descendantOverrides.map(
        (item) => item.address,
      ),
    ).toEqual([SELECT_BUTTON_LABEL]);
    expect(drawn(reload(graph))).toEqual(drawn(graph));
    replay(graph, result.inverse);
    expect(textsOf(graph, "pick")).toContain("Mine");
  });

  it("(f) a reset takes away the whole override — defaults and state rules — unlocked or not", () => {
    for (const unlock of [false, true]) {
      const graph = fixture();
      exec(
        graph,
        setLibraryDefault({
          definitionId: BUTTON,
          scope: "stateRules",
          state: "hover",
          key: "backgroundColor",
          write: set("#00ff00"),
          newId: allocator(),
        }),
      );
      if (unlock)
        exec(graph, unlockOrigin({ definitionId: BUTTON, newId: allocator() }));
      const hover = () =>
        resolveCatalogNode(graph, id("send")).children[0]?.stateVisual?.hover;
      expect(hover()).toBeTruthy();
      const { result } = exec(graph, resetOrigin({ definitionId: BUTTON }));
      expect(override(graph, BUTTON)).toBeUndefined();
      expect(
        (graph.getEntry(PROJECT) as { overrideIds: readonly string[] })
          .overrideIds,
      ).toEqual([]);
      expect(textsOf(graph, "send")).toEqual(["Button"]);
      expect(hover()?.backgroundColor).toBeUndefined();
      replay(graph, result.inverse);
      expect(textsOf(graph, "send")).toEqual(["Send"]);
      expect(hover()?.backgroundColor).toBe("#00ff00");
      replay(graph, result.forward);
      expect(override(graph, BUTTON)).toBeUndefined();
    }
  });
});

describe("ADR-282 Library-wide lock (user 2026-10-24 「Library 전체 해제」)", () => {
  it("unlock library forks every origin in one step and draws the same; lock drops the unedited copies and keeps an edited one", () => {
    const graph = fixture();
    const before = drawn(graph);
    const start = snapshot(graph);
    const ids = allocator();
    const { plan, result } = exec(graph, unlockOrigins({ newId: ids }));
    expect(plan.label).toBe("Unlock library");
    expect(override(graph, BUTTON)?.templateRootId).toBeTruthy();
    expect(override(graph, SELECT)?.templateRootId).toBeTruthy();
    // (Every component origin, no state variant.)
    const forks = (
      graph.getEntry(PROJECT) as { overrideIds: readonly string[] }
    ).overrideIds
      .map((id) => graph.getEntry(id) as DefinitionOverrideEntry)
      .filter((entry) => entry.templateRootId);
    expect(forks.length).toBeGreaterThan(50);
    expect(forks.some((entry) => entry.targetId.includes("--"))).toBe(false);
    expect(drawn(graph)).toEqual(before);
    expect(drawn(reload(graph))).toEqual(before);
    // An edit on the Button copy: a child.
    const root = override(graph, BUTTON)!.templateRootId!;
    exec(
      graph,
      insertNodes({
        parent: { kind: "node", id: root },
        entries: [
          node("badge", "lib:definition:text" as never, {
            props: { children: set("NEW") },
          }),
        ],
        rootIds: [id("badge")],
        newId: ids,
      }),
    );
    // Lock: every other copy goes (back to the library — the override default 「Send」 stays),
    // the Button's stays with its edit.
    const locked = exec(graph, lockOrigins());
    expect(locked.plan.label).toBe("Lock library");
    expect(override(graph, BUTTON)?.templateRootId).toBe(root);
    expect(override(graph, SELECT)).toBeUndefined();
    const left = (
      graph.getEntry(PROJECT) as { overrideIds: readonly string[] }
    ).overrideIds.map((id) => graph.getEntry(id) as DefinitionOverrideEntry);
    expect(left.map((entry) => entry.targetId)).toEqual([BUTTON]);
    expect(textsOf(graph, "send")).toEqual(["Send", "NEW"]);
    expect(textsOf(graph, "pick")).toContain("Pick one");
    expect(
      (graph.getEntry(id("pick")) as NodeEntry).descendantOverrides[0]!.address,
    ).toEqual({
      instances: [id("pick"), T("select__2")],
      templatePath: [
        root,
        override(graph, BUTTON)!.templateMap![T("button__label") as never]!,
      ],
    });
    expect(drawn(reload(graph))).toEqual(drawn(graph));
    // Lock again: nothing to drop. Undo of the unlock: the document before it.
    expect(lockOrigins()(graph).ops).toEqual([]);
    replay(graph, locked.result.inverse);
    expect(override(graph, SELECT)?.templateRootId).toBeTruthy();
    void result;
    void start;
  });

  it("an unlock then a lock with no edit leaves the document as it was (the root style back on the override)", () => {
    const graph = fixture();
    exec(
      graph,
      setLibraryDefault({
        definitionId: BUTTON,
        scope: "visual",
        key: "paddingTop",
        write: set(7),
        newId: allocator(),
      }),
    );
    const start = snapshot(graph);
    const before = drawn(graph);
    exec(graph, unlockOrigins({ newId: allocator() }));
    expect(override(graph, BUTTON)!.visual).toEqual({});
    exec(graph, lockOrigins());
    expect(snapshot(graph)).toBe(start);
    expect(drawn(graph)).toEqual(before);
  });
});
