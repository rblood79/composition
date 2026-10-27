import { act } from "@testing-library/react";
import { appendFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  ViewCondition,
  ViewConditionGroup,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { ChangeSet } from "@codemirror/state";
import type { CodeViewChange } from "../../../../../../packages/shared/src/codeView/inverse/identity";
import type { CodeViewCollection } from "../../../../../../packages/shared/src/codeView/types";
import { catalogCodeView } from "../../../builder/catalogRuntime/codeView";
import {
  catalogCodeViewApply,
  catalogCodeViewSession,
  type CatalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../../../builder/catalogRuntime/paletteInsert";
import { catalogFilterCommand } from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-285 Phase 0 (G0) — RED 8: a code edit outside the 1:1 positions (an element · a variable · a
 * `filter` term added, an element deleted or moved) is refused today; the identity of an edited
 * element (h1), the edit session's baseline (h2) and the derived lines (m3) are the review's
 * repairs. Each test states the expected behavior through `applyCode` — an edit session started on
 * the page and the editor's edit operations — so the cases stay when the apply path changes
 * (Phase 2 swaps the helper's body for the new path and turns `it.fails` into `it`).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;

const USERS: CodeViewCollection = {
  id: "users",
  name: "users",
  schema: [
    { id: "u-id", key: "id", type: "string" },
    { id: "u-name", key: "name", type: "string" },
    { id: "u-age", key: "age", type: "number" },
  ],
};
/** The same collection loaded from an endpoint that carries its view in the request. */
const USERS_API: CodeViewCollection = {
  ...USERS,
  endpoint: {
    url: "https://api.example.com/users",
    querySerialization: { kind: "suffix" },
  },
};

async function open(
  types: readonly string[],
  collections: readonly CodeViewCollection[] = [],
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([]);
  const graph = () => h.workspace.runtime.graph;
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: collections.map((collection) => ({
        ...collection,
        mockData: [],
        runtimeData: [],
        useMockData: true,
      })),
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  /** A palette item (the Components panel's insert path). */
  const add = (type: string, props?: Record<string, unknown>) => {
    const definitionId = catalogPaletteDefinitionId(graph().library, type);
    const id = h.workspace.newId("node") as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id,
            definitionId,
            children: [],
            props: catalogCreationProps(
              graph().library,
              definitionId,
              type,
              props,
            ),
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id],
        newId: h.workspace.newId,
      }),
    );
    return id;
  };
  for (const type of types) add(type);
  const color = (id: NodeId, value: string) =>
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        visual: { color: { kind: "set", value } },
        label: "Color",
      }),
    );
  const bind = (id: NodeId, collectionId: string) =>
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({
          source: "dataTable",
          collectionId,
          name: collectionId,
        })!,
      ),
    );
  /** 「검색 추가」 on a bound list (the Data panel's command). */
  const search = (listId: NodeId, collection: CodeViewCollection) => {
    const field = collection.schema.find((item) => item.key === "name")!;
    const { command } = catalogFilterCommand(
      graph(),
      {
        listId,
        field: { id: field.id!, key: field.key, type: field.type },
        kind: "SearchField" as never,
        control: { insert: true },
        values: [],
        allLabel: "All",
      },
      h.workspace.newId,
    );
    h.workspace.execute(command);
  };
  const code = () =>
    catalogCodeView(graph(), HOME, {
      collections: [...collections],
      endpoints: [],
    })!.code;
  const body = () => (graph().getEntry(BODY) as NodeEntry).children;
  const node = (id: string) => graph().getEntry(id) as NodeEntry | undefined;
  const history = () => h.workspace.runtime.historyDepth.undo;
  return {
    ...h,
    graph,
    add,
    color,
    bind,
    search,
    code,
    body,
    node,
    history,
    collections,
  };
}
type Harness = Awaited<ReturnType<typeof open>>;

/** An edit operation of the editor: replace `[from, to)` of the text as it is at that point. */
interface Change {
  readonly from: number;
  readonly to: number;
  readonly insert: string;
}

/** 「코드 고치기」: the page's code at this moment (the session's baseline). */
function begin(h: Harness) {
  const session = catalogCodeViewSession(h.graph(), HOME, {
    collections: [...h.collections],
    endpoints: [],
  })!;
  return { ...session, code: session.baseline.code };
}
type Session = CatalogCodeViewSession & { code: string };

/** The text after the editor's operations, in order. */
function edited(session: Session, changes: readonly Change[]): string {
  let text = session.code;
  for (const change of changes)
    text = text.slice(0, change.from) + change.insert + text.slice(change.to);
  return text;
}

/** A change that replaces the first occurrence of `find` (at the text before it). */
function replace(text: string, find: string, insert: string): Change {
  const from = text.indexOf(find);
  if (from < 0) throw new Error(`not in the code: ${find}`);
  return { from, to: from + find.length, insert };
}

/** The editor's operations composed since the baseline (what CodeMirror hands the panel). */
function composed(
  session: Session,
  changes: readonly Change[],
): CodeViewChange[] {
  let set = ChangeSet.empty(session.code.length);
  for (const change of changes) {
    const next = ChangeSet.of([change], set.newLength);
    set = set.compose(next);
  }
  const out: CodeViewChange[] = [];
  set.iterChanges((fromA, toA, _fromB, _toB, inserted) =>
    out.push({ fromA, toA, insert: inserted.toString() }),
  );
  return out;
}

/** Apply: the edit session's code with the editor's operations (the panel's Apply). */
function applyCode(
  h: Harness,
  session: Session,
  changes: readonly Change[],
): { applied: boolean; reasons: readonly string[] } {
  const result = catalogCodeViewApply(
    h.workspace,
    session,
    edited(session, changes),
    composed(session, changes),
    { collections: [...h.collections], endpoints: [] },
  );
  // (Set `ADR285_DEBUG` to a file to see each refusal's line · reason · detail.)
  if (process.env.ADR285_DEBUG && result.rejected.length)
    appendFileSync(
      process.env.ADR285_DEBUG,
      `${JSON.stringify(result.rejected)}\n`,
    );
  return {
    applied: result.applied,
    reasons: result.rejected.map((line) => line.reason),
  };
}

const conditions = (group: ViewConditionGroup | undefined): ViewCondition[] =>
  (group?.items ?? []).flatMap((item) =>
    "items" in item ? conditions(item) : [item],
  );
const viewOf = (h: Harness, listId: NodeId) => {
  const binding = h.node(listId)!.binding!;
  if (binding.view) return binding.view;
  const view = binding.viewId ? h.graph().getEntry(binding.viewId) : undefined;
  return view?.kind === "view" ? view : undefined;
};
const textOf = (h: Harness, id: string) => {
  const write = h.node(id)?.props.children;
  return write?.kind === "set" ? write.value : undefined;
};
const colorOf = (h: Harness, id: string) => {
  const write = h.node(id)?.visual?.color as { value?: unknown } | undefined;
  return write?.value;
};
const typeOf = (h: Harness, id: string) => h.node(id)?.definitionId;

describe("ADR-285 G0 — RED 8 (code edit across the closed vocabulary)", () => {
  it("① a Text line added to the page's code adds a Text node (one Undo)", async () => {
    const h = await open(["Text"]);
    const session = begin(h);
    const line = "      <Text>Text</Text>\n";
    const change = replace(session.code, line, line + line);
    const before = h.history();
    const result = applyCode(h, session, [change]);
    expect(result).toEqual({ applied: true, reasons: [] });
    expect(h.body()).toHaveLength(2);
    expect(h.body().map((id) => typeOf(h, id))).toEqual([
      "lib:definition:text",
      "lib:definition:text",
    ]);
    expect(h.history()).toBe((before ?? 0) + 1);
  });

  it("② 「검색 추가」 written as code — a variable, a SearchField, its rule and a condition", async () => {
    // (The code of the same page after the Data panel's 「검색 추가」 — applied on the page without it.)
    const target = await open(["ListBox"], [USERS]);
    target.bind(target.body()[0]! as NodeId, "users");
    target.search(target.body()[0]! as NodeId, USERS);
    const searched = target.code();

    const h = await open(["ListBox"], [USERS]);
    const list = h.body()[0]! as NodeId;
    h.bind(list, "users");
    const session = begin(h);
    const variables = h.graph().getEntry(h.graph().projectId);
    const result = applyCode(h, session, [
      { from: 0, to: session.code.length, insert: searched },
    ]);
    expect(result).toEqual({ applied: true, reasons: [] });
    const project = h.graph().getEntry(h.graph().projectId) as {
      stateVariableIds: readonly string[];
      interactionIds: readonly string[];
    };
    void variables;
    expect(project.stateVariableIds).toHaveLength(1);
    expect(h.body().map((id) => typeOf(h, id))).toContain(
      "lib:definition:origin-component-searchfield",
    );
    expect(project.interactionIds).toHaveLength(1);
    expect(conditions(viewOf(h, list)?.where)).toHaveLength(1);
    // (Round trip: the page's code is now the code that was applied.)
    expect(h.code()).toBe(searched);
  });

  it("③ a `filter` term added (`&& item.age >= 20`) adds a condition", async () => {
    const h = await open(["ListBox"], [USERS]);
    const list = h.body()[0]! as NodeId;
    h.bind(list, "users");
    h.search(list, USERS);
    const session = begin(h);
    const term = /contains\(String\(item\.name\), [A-Za-z]+\)/.exec(
      session.code,
    )![0];
    const result = applyCode(h, session, [
      replace(session.code, term, `${term} &&\n      item.age >= 20`),
    ]);
    expect(result).toEqual({ applied: true, reasons: [] });
    const added = conditions(viewOf(h, list)?.where).find(
      (condition) => condition.op === "gte",
    );
    expect(added?.value).toBe(20);
  });

  it("④ an element's lines deleted delete the node and the rules that read it (one Undo restores both)", async () => {
    const h = await open(["Text", "Button"]);
    const [, button] = h.body() as NodeId[];
    h.rule(button!, "onPress", {
      opcode: "toast",
      message: "Saved",
    } as never);
    const session = begin(h);
    const start = session.code.indexOf("      <Button");
    const end = session.code.indexOf("\n", session.code.indexOf("/>", start));
    const result = applyCode(h, session, [
      { from: start, to: end + 1, insert: "" },
    ]);
    expect(result).toEqual({ applied: true, reasons: [] });
    expect(h.node(button!)).toBeUndefined();
    const project = () =>
      h.graph().getEntry(h.graph().projectId) as {
        interactionIds: readonly string[];
      };
    expect(project().interactionIds).toHaveLength(0);
    h.workspace.undo();
    expect(h.node(button!)).toBeDefined();
    expect(project().interactionIds).toHaveLength(1);
  });

  it("⑤ two elements' lines swapped move the nodes (not delete + add — style kept)", async () => {
    const h = await open([]);
    const a = h.add("Text", { children: "A" });
    const b = h.add("Text", { children: "B" });
    h.color(a, "#ff0000");
    const session = begin(h);
    // (Cut the A line, then paste it after the B line — two editor operations.)
    const cut = replace(session.code, "      <Text>A</Text>\n", "");
    const paste = replace(
      edited(session, [cut]),
      "      <Text>B</Text>\n",
      "      <Text>B</Text>\n      <Text>A</Text>\n",
    );
    const result = applyCode(h, session, [cut, paste]);
    expect(result).toEqual({ applied: true, reasons: [] });
    expect(h.body()).toEqual([b, a]);
    expect(colorOf(h, a)).toBe("#ff0000");
  });

  describe("⑥ identity follows the editor's operations (h1)", () => {
    it("a letter typed inside one element keeps its id and style", async () => {
      const h = await open([]);
      const a = h.add("Text", { children: "A" });
      h.color(a, "#ff0000");
      const session = begin(h);
      const at = session.code.indexOf("<Text>A</Text>") + "<Text>".length;
      const result = applyCode(h, session, [
        { from: at, to: at + 1, insert: "B" },
      ]);
      expect(result).toEqual({ applied: true, reasons: [] });
      expect(h.body()).toEqual([a]);
      expect(textOf(h, a)).toBe("B");
      expect(colorOf(h, a)).toBe("#ff0000");
    });

    it("the second of two same lines deleted deletes the second node (the first keeps its style)", async () => {
      const h = await open([]);
      const first = h.add("Text");
      const second = h.add("Text");
      h.color(first, "#ff0000");
      h.color(second, "#0000ff");
      const session = begin(h);
      const line = "      <Text>Text</Text>\n";
      const at = session.code.indexOf(line) + line.length;
      const result = applyCode(h, session, [
        { from: at, to: at + line.length, insert: "" },
      ]);
      expect(result).toEqual({ applied: true, reasons: [] });
      expect(h.body()).toEqual([first]);
      expect(colorOf(h, first)).toBe("#ff0000");
    });

    it("two same lines (different styles) pasted over as one are refused — nothing changes", async () => {
      const h = await open([]);
      const first = h.add("Text");
      const second = h.add("Text");
      h.color(first, "#ff0000");
      h.color(second, "#0000ff");
      const session = begin(h);
      const line = "      <Text>Text</Text>\n";
      const result = applyCode(h, session, [
        replace(session.code, line + line, line),
      ]);
      expect(result.applied).toBe(false);
      expect(result.reasons).toContain("ambiguousIdentity");
      expect(h.body()).toEqual([first, second]);
    });

    it("two lines selected and pasted as B · A move the nodes (blue B · red A — no letters rewritten)", async () => {
      const h = await open([]);
      const a = h.add("Text", { children: "A" });
      const b = h.add("Text", { children: "B" });
      h.color(a, "#ff0000");
      h.color(b, "#0000ff");
      const session = begin(h);
      const result = applyCode(h, session, [
        replace(
          session.code,
          "      <Text>A</Text>\n      <Text>B</Text>\n",
          "      <Text>B</Text>\n      <Text>A</Text>\n",
        ),
      ]);
      expect(result).toEqual({ applied: true, reasons: [] });
      expect(h.body().map((id) => [id, textOf(h, id), colorOf(h, id)])).toEqual(
        [
          [b, "B", "#0000ff"],
          [a, "A", "#ff0000"],
        ],
      );
    });
  });

  it("⑦ an edit started before a Canvas change applies nothing (h2 — the draft stays)", async () => {
    const h = await open(["Text"]);
    const session = begin(h);
    // (Meanwhile on the Canvas: a Button added.)
    const button = h.add("Button");
    const line = "      <Text>Text</Text>\n";
    const result = applyCode(h, session, [
      replace(session.code, line, line + line),
    ]);
    expect(result.applied).toBe(false);
    expect(result.reasons).toEqual(["staleBaseline"]);
    expect(h.node(button)).toBeDefined();
    expect(h.body()).toHaveLength(2);
  });

  it("⑧ a derived line changed (the reload effect) refuses the whole edit — the Text added with it too (m3)", async () => {
    const h = await open(["ListBox"], [USERS_API]);
    const list = h.body()[0]! as NodeId;
    h.bind(list, "users");
    h.search(list, USERS_API);
    const session = begin(h);
    const effect = /useEffect\(\(\) => \{ [A-Za-z]+\.reload\(\); \}/.exec(
      session.code,
    )![0];
    const end = session.code.lastIndexOf("    </>");
    const result = applyCode(h, session, [
      replace(session.code, effect, "useEffect(() => { doSomething(); }"),
      {
        from: end - 1,
        to: end - 1,
        insert: "\n      <Text>Text</Text>",
      },
    ]);
    expect(result.applied).toBe(false);
    expect(result.reasons).toEqual(["derivedChanged"]);
    expect(h.body()).toHaveLength(2);
  });
});
