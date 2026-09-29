import { describe, expect, it } from "vitest";
import { createG1Fixture } from "../../document/fixture";
import { CatalogGraph } from "../../document/graph";
import type { NodeEntry, PageEntry } from "../../document/types";
import { CatalogValidationError } from "../../document/validation";
import {
  applyCatalogTransaction,
  stageCatalogTransaction,
  type CatalogReader,
} from "../../transactions/transaction";
import { composeCommands, type CatalogCommand } from "../compose";

/**
 * ADR-248 Phase 4b: a composed edit plans each command against the records the earlier ones
 * staged, and commits as one transaction with one history entry.
 */
const PAGE = "project:page:main" as const;
const fixture = () => {
  const { document, library } = createG1Fixture();
  return new CatalogGraph(document, library);
};
const text = (id: NodeEntry["id"]): NodeEntry => ({
  kind: "node",
  id,
  definitionId: "lib:definition:text",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
/** Insert a text node at the end of the page (reads the page as the reader sees it). */
const insertText =
  (id: NodeEntry["id"]): CatalogCommand =>
  (reader) => {
    const page = reader.getEntry(PAGE) as PageEntry;
    return {
      label: "insert",
      ops: [
        { kind: "put", entry: text(id) },
        { kind: "put", entry: { ...page, children: [...page.children, id] } },
      ],
      selectAfter: [id],
    };
  };
/** Set a text node's content; the node must exist for the reader. */
const setText =
  (id: NodeEntry["id"], value: string): CatalogCommand =>
  (reader) => {
    if (reader.getEntry(id)?.kind !== "node")
      throw new CatalogValidationError("NODE_REQUIRED", id);
    return {
      label: "text",
      ops: [
        {
          kind: "patchNodeProp",
          id,
          key: "children",
          write: { kind: "set", value },
        },
      ],
    };
  };
const commit = (graph: CatalogGraph, label: string, ops: readonly never[]) =>
  applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label },
    ops,
  });

describe("ADR-248 Phase 4b composed commands", () => {
  it("plans the second command against the first one's staged insert; one transaction, one history entry", () => {
    const graph = fixture();
    const revision = graph.revision;
    const historyLength = graph.history.length;
    const pageBefore = graph.getEntry(PAGE);
    const plan = composeCommands(graph, "insert and label", [
      insertText("project:node:a"),
      setText("project:node:a", "Hello"),
      insertText("project:node:b"),
    ]);
    // Planning commits nothing.
    expect(graph.revision).toBe(revision);
    expect(graph.getEntry("project:node:a")).toBeUndefined();
    expect(plan.selectAfter).toEqual(["project:node:a", "project:node:b"]);
    const result = commit(graph, plan.label, plan.ops as never[]);
    expect(graph.history.length).toBe(historyLength + 1);
    expect((graph.getEntry(PAGE) as PageEntry).children.slice(-2)).toEqual([
      "project:node:a",
      "project:node:b",
    ]);
    expect(
      (graph.getEntry("project:node:a") as NodeEntry).props.children,
    ).toEqual({ kind: "set", value: "Hello" });
    commit(graph, "undo", result.inverse as never[]);
    expect(graph.getEntry(PAGE)).toEqual(pageBefore);
    expect(graph.getEntry("project:node:a")).toBeUndefined();
  });

  it("aborts the whole plan when a later command fails", () => {
    const graph = fixture();
    const revision = graph.revision;
    expect(() =>
      composeCommands(graph, "bad", [
        insertText("project:node:a"),
        setText("project:node:missing", "x"),
      ]),
    ).toThrow(CatalogValidationError);
    expect(graph.revision).toBe(revision);
    expect(graph.getEntry("project:node:a")).toBeUndefined();
  });

  it("reads owner, referrers and instances through the staged records", () => {
    const graph = fixture();
    const reader: CatalogReader = stageCatalogTransaction(graph, [
      { kind: "put", entry: text("project:node:a") },
      {
        kind: "put",
        entry: {
          ...(graph.getEntry(PAGE) as PageEntry),
          children: ["project:node:a", "project:node:cardB"],
        },
      },
      { kind: "remove", id: "project:node:cardA" },
    ]);
    expect(reader.ownerOf("project:node:a")).toBe(PAGE);
    expect(graph.ownerOf("project:node:a")).toBeUndefined();
    // cardA left the page's staged children: the committed owner no longer claims it.
    expect(reader.ownerOf("project:node:cardA")).toBeUndefined();
    expect(graph.ownerOf("project:node:cardA")).toBe(PAGE);
    expect([...reader.instancesOf("lib:definition:card")]).toEqual([
      "project:node:cardB",
    ]);
    expect([...reader.instancesOf("lib:definition:text")]).toContain(
      "project:node:a",
    );
    // The committed graph is unchanged.
    expect([...graph.instancesOf("lib:definition:card")].sort()).toEqual([
      "project:node:cardA",
      "project:node:cardB",
    ]);
  });
});
