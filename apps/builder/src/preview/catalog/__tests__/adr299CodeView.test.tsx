import { ChangeSet } from "@codemirror/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { applyTextRunMarks } from "../../../../../../packages/shared/src/catalog/document/textRuns";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  RichText,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CodeViewChange } from "../../../../../../packages/shared/src/codeView/inverse/identity";
import { catalogCodeView } from "../../../builder/catalogRuntime/codeView";
import {
  catalogCodeViewApply,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-299 Decision 6 · G4 — the code view projects a text's runs as `<span style={{…}}>` and an edit
 * of that code writes the runs back (ADR-285's closed vocabulary — a key outside the range keys, or
 * other JSX inside the text, is refused).
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const BOLD = { fontWeight: 700 } as const;

async function open(children: string | RichText) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([]);
  const graph = () => h.workspace.runtime.graph;
  const definitionId = catalogPaletteDefinitionId(graph().library, "Text");
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
          props: catalogCreationProps(graph().library, definitionId, "Text"),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: h.workspace.newId,
    }),
  );
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id }],
      props: { children: { kind: "set", value: children } },
    }),
  );
  const code = () =>
    catalogCodeView(graph(), HOME, { collections: [], endpoints: [] })!.code;
  const text = () => {
    const write = (graph().getEntry(id) as NodeEntry).props.children;
    return write?.kind === "set" ? write.value : undefined;
  };
  const apply = (find: string, insert: string) => {
    const session = catalogCodeViewSession(graph(), HOME, {
      collections: [],
      endpoints: [],
    })!;
    const before = session.baseline.code;
    const from = before.indexOf(find);
    if (from < 0) throw new Error(`not in the code: ${find}`);
    const after =
      before.slice(0, from) + insert + before.slice(from + find.length);
    const set = ChangeSet.of(
      [{ from, to: from + find.length, insert }],
      before.length,
    );
    const changes: CodeViewChange[] = [];
    set.iterChanges((fromA, toA, _fromB, _toB, inserted) =>
      changes.push({ fromA, toA, insert: inserted.toString() }),
    );
    const result = catalogCodeViewApply(h.workspace, session, after, changes, {
      collections: [],
      endpoints: [],
    });
    return {
      applied: result.applied,
      reasons: result.rejected.map((line) => line.reason),
    };
  };
  return { code, text, apply };
}

describe("ADR-299 code view — runs as `<span style>`", () => {
  it("projects the runs of a text", async () => {
    const h = await open(applyTextRunMarks("Hello world", 6, 11, BOLD));
    expect(h.code()).toContain(
      "<Text>Hello <span style={{ fontWeight: 700 }}>world</span></Text>",
    );
  });

  it("a mark edited in the code writes the run", async () => {
    const h = await open(applyTextRunMarks("Hello world", 6, 11, BOLD));
    expect(
      h.apply("fontWeight: 700", 'fontWeight: 700, color: "#e00000"'),
    ).toEqual({ applied: true, reasons: [] });
    expect(h.text()).toEqual({
      kind: "text",
      runs: [
        { text: "Hello " },
        { text: "world", marks: { fontWeight: 700, color: "#e00000" } },
      ],
    });
  });

  it("a span written around plain text makes runs; removing it gives the string back", async () => {
    const h = await open("Hello world");
    expect(
      h.apply(
        "<Text>Hello world</Text>",
        '<Text>Hello <span style={{ fontStyle: "italic" }}>world</span></Text>',
      ),
    ).toEqual({ applied: true, reasons: [] });
    expect(h.text()).toEqual({
      kind: "text",
      runs: [
        { text: "Hello " },
        { text: "world", marks: { fontStyle: "italic" } },
      ],
    });
    expect(
      h.apply(
        '<Text>Hello <span style={{ fontStyle: "italic" }}>world</span></Text>',
        "<Text>Hello world</Text>",
      ).applied,
    ).toBe(true);
    expect(h.text()).toBe("Hello world");
  });

  it("a style key outside the range keys is refused", async () => {
    const h = await open(applyTextRunMarks("Hello world", 6, 11, BOLD));
    const result = h.apply("fontWeight: 700", "letterSpacing: 2");
    expect(result.applied).toBe(false);
    expect(result.reasons).toContain("outsideVocabulary");
  });
});
