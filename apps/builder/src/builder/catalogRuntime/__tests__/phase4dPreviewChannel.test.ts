import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogCommand } from "../../../../../../packages/shared/src/catalog/commands/compose";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { documentOf } from "../../../../../../packages/shared/src/catalog/commands/__tests__/fixture";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import type {
  CatalogPreviewDeltaMessage,
  CatalogPreviewMessage,
} from "../../../../../../packages/shared/src/catalog/preview/protocol";
import { CatalogPreviewReceiver } from "../../../../../../packages/shared/src/catalog/preview/receiver";
import { CatalogRuntime } from "../controller";
import { CatalogPreviewChannel } from "../previewChannel";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4d Preview payload: one snapshot when the Preview is ready, then one delta per
 * step with only the entries it names. The Preview replica applies a delta only at its base
 * revision, ignores stale and old-format messages, and recovers from a gap or a refused delta by
 * requesting a snapshot. Messages cross a structured clone as they would through postMessage.
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
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:p${++next}` as EntryId<K>;
};

let library: CatalogLibrary | undefined;
async function open(
  nodes: NodeEntry[],
  roots: string[],
  options: {
    deferFlush?: boolean;
    drop?: (m: CatalogPreviewMessage) => boolean;
  } = {},
) {
  library ??= await buildCodeCatalogLibrary();
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentOf(nodes, roots), library),
    new CatalogStorage(indexedDB, `adr248-phase4d-preview-${Math.random()}`),
  );
  const sent: CatalogPreviewMessage[] = [];
  const flushes: (() => void)[] = [];
  const receipts: string[] = [];
  // Both ends call each other only after construction (onReady, a request).
  const channel: CatalogPreviewChannel = new CatalogPreviewChannel(runtime, {
    post: (message) => {
      sent.push(message);
      if (options.drop?.(message)) return;
      receipts.push(receiver.receive(structuredClone(message)).kind);
    },
    schedule: options.deferFlush ? (flush) => flushes.push(flush) : undefined,
  });
  const receiver = new CatalogPreviewReceiver(library, (request) =>
    channel.onPreviewMessage(structuredClone(request)),
  );
  const run = (command: CatalogCommand) => {
    const plan = command(runtime.graph);
    runtime.dispatch(plan.label, plan.ops);
    return plan;
  };
  const same = () => {
    const replica = receiver.graph!;
    expect(replica.exportDocument().entries).toEqual(
      runtime.graph.exportDocument().entries,
    );
    const page = runtime.graph.getEntry(PAGE);
    for (const root of page?.kind === "page" ? page.children : [])
      expect(resolveCatalogNode(replica, root)).toEqual(
        resolveCatalogNode(runtime.graph, root),
      );
  };
  return { runtime, channel, receiver, sent, receipts, flushes, run, same };
}

describe("ADR-248 Phase 4d Preview payload", () => {
  it("sends nothing before ready, a snapshot on ready, then deltas the replica follows through edits, undo and redo", async () => {
    const { runtime, channel, receiver, sent, receipts, run, same } =
      await open(
        [
          node("frame", "lib:definition:type-frame", { children: [id("a")] }),
          text("a", "A"),
        ],
        ["frame"],
      );
    run(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        props: { children: { kind: "set", value: "A1" } },
      }),
    );
    expect(sent).toEqual([]);
    channel.onReady();
    expect(sent.map((m) => m.type)).toEqual(["CATALOG_SNAPSHOT"]);
    expect(receiver.revision).toBe(runtime.graph.revision);
    same();
    run(
      insertNodes({
        parent: { kind: "node", id: id("frame") },
        entries: [text("b", "B")],
        rootIds: [id("b")],
        newId: allocator(),
      }),
    );
    run(removeTargets({ targets: [{ kind: "node", id: id("a") }] }));
    same();
    runtime.undo();
    same();
    runtime.redo();
    same();
    expect(receipts).toEqual(["snapshot", "delta", "delta", "delta", "delta"]);
    const removal = sent[2] as CatalogPreviewDeltaMessage;
    expect(removal.removedIds).toEqual([id("a")]);
    expect(removal.baseRevision + 1).toBe(removal.revision);
  });

  it("5k siblings: a leaf edit sends one entry and never exports the document", async () => {
    const leaves = Array.from({ length: 5000 }, (_, index) =>
      text(`leaf${index}`, `Leaf ${index}`),
    );
    const { runtime, channel, sent, run, receiver } = await open(
      [
        node("frame", "lib:definition:type-frame", {
          children: leaves.map((leaf) => leaf.id),
        }),
        ...leaves,
      ],
      ["frame"],
    );
    channel.onReady();
    const exportSpy = vi.spyOn(runtime.graph, "exportDocument");
    const replicaExport = vi.spyOn(receiver.graph!, "exportDocument");
    run(
      setFields({
        targets: [{ kind: "node", id: id("leaf2500") }],
        props: { children: { kind: "set", value: "Edited" } },
      }),
    );
    const delta = sent.at(-1) as CatalogPreviewDeltaMessage;
    expect(delta.type).toBe("CATALOG_DELTA");
    expect(delta.changed.map((entry) => entry.id)).toEqual([id("leaf2500")]);
    expect(delta.removedIds).toEqual([]);
    expect(exportSpy).not.toHaveBeenCalled();
    expect(replicaExport).not.toHaveBeenCalled();
    expect(
      (receiver.graph!.getEntry(id("leaf2500")) as NodeEntry).props.children,
    ).toEqual({ kind: "set", value: "Edited" });
  });

  it("a dropped delta is a gap: the next delta is not applied, a snapshot is requested and the replica converges; stale messages change nothing", async () => {
    let dropNext = false;
    const { channel, receiver, sent, receipts, run, same } = await open(
      [text("a", "A")],
      ["a"],
      {
        drop: (message) => {
          if (!dropNext || message.type !== "CATALOG_DELTA") return false;
          dropNext = false;
          return true;
        },
      },
    );
    channel.onReady();
    const edit = (value: string) =>
      run(
        setFields({
          targets: [{ kind: "node", id: id("a") }],
          props: { children: { kind: "set", value } },
        }),
      );
    edit("A1");
    const first = sent.at(-1)!;
    dropNext = true;
    edit("A2");
    edit("A3");
    // gap → request → snapshot at the current revision (this transport is synchronous, so the
    // snapshot is applied inside the gap's receive and recorded first).
    expect(receipts.slice(-2)).toEqual(["snapshot", "gap"]);
    same();
    const revision = receiver.revision;
    expect(receiver.receive(structuredClone(first))).toEqual({ kind: "stale" });
    expect(
      receiver.receive(
        structuredClone(sent.find((m) => m.type === "CATALOG_SNAPSHOT")!),
      ),
    ).toEqual({ kind: "stale" });
    expect(receiver.revision).toBe(revision);
    same();
  });

  it("a delta the validator refuses leaves the replica at its last good revision and requests a snapshot once", async () => {
    const requests: unknown[] = [];
    library ??= await buildCodeCatalogLibrary();
    const { runtime, channel, sent } = await open([text("a", "A")], ["a"]);
    channel.onReady();
    const receiver = new CatalogPreviewReceiver(library, (request) =>
      requests.push(request),
    );
    receiver.receive(structuredClone(sent[0]));
    const revision = receiver.revision!;
    const before = receiver.graph!.exportDocument().entries;
    const bad: CatalogPreviewDeltaMessage = {
      type: "CATALOG_DELTA",
      version: 1,
      projectId: runtime.graph.projectId,
      baseRevision: revision,
      revision: revision + 1,
      changed: [
        {
          ...(runtime.graph.getEntry(id("a")) as NodeEntry),
          children: [id("missing")],
        },
      ],
      removedIds: [],
    };
    expect(receiver.receive(bad).kind).toBe("rejected");
    expect(receiver.revision).toBe(revision);
    expect(receiver.graph!.exportDocument().entries).toEqual(before);
    expect(
      receiver.receive({
        ...bad,
        baseRevision: revision + 1,
        revision: revision + 2,
      }).kind,
    ).toBe("gap");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      type: "CATALOG_SNAPSHOT_REQUEST",
      haveRevision: revision,
    });
  });

  it("old canonical messages and other payload versions are never applied", async () => {
    const { channel, receiver, sent } = await open([text("a", "A")], ["a"]);
    channel.onReady();
    const revision = receiver.revision;
    expect(
      receiver.receive({
        type: "UPDATE_CANONICAL_DOCUMENT",
        projectId: "p",
        documentRevision: 9,
        document: {},
      }),
    ).toEqual({ kind: "ignored" });
    expect(receiver.receive({ ...sent[0], version: 2, revision: 99 })).toEqual({
      kind: "ignored",
    });
    expect(receiver.revision).toBe(revision);
  });

  it("steps between two frames go out as one delta spanning both revisions", async () => {
    const { runtime, channel, sent, flushes, run, same, receipts } = await open(
      [text("a", "A"), text("b", "B")],
      ["a", "b"],
      { deferFlush: true },
    );
    channel.onReady();
    const start = runtime.graph.revision;
    run(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        props: { children: { kind: "set", value: "A1" } },
      }),
    );
    run(removeTargets({ targets: [{ kind: "node", id: id("b") }] }));
    expect(flushes).toHaveLength(1);
    flushes.shift()!();
    const delta = sent.at(-1) as CatalogPreviewDeltaMessage;
    expect([delta.baseRevision, delta.revision]).toEqual([start, start + 2]);
    expect(delta.removedIds).toEqual([id("b")]);
    expect(receipts.at(-1)).toBe("delta");
    same();
  });
});
