import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/library";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import {
  CatalogCompositionRoot,
  type CatalogTextMeasure,
} from "../compositionRoot";
import {
  CatalogRuntime,
  CatalogStepAbortedError,
  CatalogSubscriberError,
} from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3 (G2): a step a consumer cannot take is not applied at all — graph content,
 * revision, history, pending saves and root inputs are exactly as before, and a save + reload
 * never shows it. A throwing subscriber runs after the step is committed; the caller gets the
 * committed revision.
 */
class FaultLayoutEngine implements LayoutEngineAPI {
  private next = 1;
  /** Throw once from the named engine call (a WASM failure during the layout apply). */
  failNext: "updateStyleRaw" | "computeLayout" | undefined;
  /** Every `computeLayout` throws (an engine that stays broken). */
  failAlways = false;
  calls = { updateStyleRaw: 0, computeLayout: 0, buildTreeBatch: 0, clear: 0 };
  /** Style JSON of every live engine node. */
  private readonly styles = new Map<number, string>();
  liveStyles(): string[] {
    return [...this.styles.values()].sort();
  }
  private fault(call: "updateStyleRaw" | "computeLayout") {
    if (this.failAlways && call === "computeLayout")
      throw new Error("WASM_BROKEN");
    if (this.failNext !== call) return;
    this.failNext = undefined;
    throw new Error(`WASM_FAILED:${call}`);
  }
  isAvailable() {
    return true;
  }
  hasBinaryProtocol() {
    return false;
  }
  buildTreeBatch(json: string) {
    this.calls.buildTreeBatch++;
    return (JSON.parse(json) as { style: unknown }[]).map((node) => {
      this.styles.set(this.next, JSON.stringify(node.style));
      return this.next++;
    });
  }
  buildTreeBatchBinary(): number[] {
    throw new Error("not used");
  }
  createNodeRaw(json: string) {
    this.styles.set(this.next, json);
    return this.next++;
  }
  updateStyleRaw(handle: number, json: string) {
    this.calls.updateStyleRaw++;
    this.styles.set(handle, json);
    this.fault("updateStyleRaw");
  }
  setChildren() {}
  markDirty() {}
  removeNode(handle: number) {
    this.styles.delete(handle);
  }
  setViewport() {}
  computeLayout() {
    this.calls.computeLayout++;
    this.fault("computeLayout");
  }
  getLayoutsBatch() {
    return new Map();
  }
  clear() {
    this.calls.clear++;
    this.styles.clear();
  }
  nodeCount() {
    return this.next - 1;
  }
}

const library = buildCatalogLibrary({
  contractVersion: 15,
  revision: "adr248-consumer-atomicity",
  bindingIds: ["frame", "label"],
  actionOpCodes: [],
  definitions: [
    {
      id: "lib:definition:frame",
      name: "Frame",
      mode: "native",
      bindingId: "frame",
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
    },
    {
      id: "lib:definition:label",
      name: "Label",
      mode: "primitive",
      bindingId: "label",
      accepts: { children: "string" },
      defaults: { children: "" },
      visual: { fontSize: 14, lineHeight: 1.5 },
      stateRules: {},
    },
  ],
  templates: [],
  tokens: [],
});

const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

async function scene(name: string) {
  const a = node("a", "lib:definition:label", {
    props: { children: { kind: "set", value: "a" } },
  });
  const b = node("b", "lib:definition:label", {
    props: { children: { kind: "set", value: "b" } },
  });
  const frame = node("frame", "lib:definition:frame", {
    children: [a.id, b.id],
  });
  const projectId = "project:project:atomic" as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "atomic",
      pageIds: [pageId],
      definitionIds: [],
      overrideIds: [],
      themeIds: [],
      tokenIds: [],
      stateVariableIds: [],
      interactionIds: [],
      assetIds: [],
    },
    [pageId]: {
      kind: "page",
      id: pageId,
      name: "Main",
      route: "/",
      children: [frame.id],
    },
  };
  for (const entry of [frame, a, b]) entries[entry.id] = entry;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 15,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  // The Label binding measures its text for the layout input — a real consumer computation.
  const failing = { text: undefined as string | undefined };
  const measure: CatalogTextMeasure = (text, font) => {
    if (text === failing.text) throw new Error(`MEASURE_FAILED:${text}`);
    return { width: text.length * 8, height: font.fontSize * font.lineHeight };
  };
  const storage = new CatalogStorage(indexedDB, `adr248-atomic-g2-${name}`);
  await storage.create(document, library);
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    storage,
  );
  const engine = new FaultLayoutEngine();
  const create = (layoutEngine: LayoutEngineAPI = new FaultLayoutEngine()) =>
    new CatalogCompositionRoot(
      runtime,
      layoutEngine,
      { width: 800, height: 600 },
      undefined,
      undefined,
      measure,
    );
  const root = create(engine);
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find(
      (input) => input.sourceId === sourceId,
    )!.id;
  const notified: string[] = [];
  for (const id of root.canvasInputs.keys()) {
    root.subscribeCanvas(id, () => notified.push(`canvas:${id}`));
    root.subscribeDom(id, () => notified.push(`dom:${id}`));
  }
  const edit = (value: string) =>
    root.dispatch(`edit ${value}`, [
      {
        kind: "patchNodeProp",
        id: a.id,
        key: "children",
        write: { kind: "set", value },
      },
    ]);
  const state = () => ({
    graphRevision: runtime.graph.revision,
    rootRevision: root.metrics.revision,
    history: runtime.historyDepth,
    graphHistory: runtime.graph.history.length,
    pending: runtime.pendingCount,
    dirty: [...runtime.graph.dirtyIds].sort(),
    entry: (runtime.graph.getEntry(a.id) as NodeEntry).props.children,
    input: root.canvasInputs.get(inputId(a.id))?.props.children,
  });
  /** Everything a failed step must leave untouched. */
  const snapshot = () => ({
    state: state(),
    document: runtime.graph.exportDocument(),
    indexes: runtime.graph.indexes,
    inputs: new Map(root.canvasInputs),
    chrome: new Map(root.slotChromeInputs),
    metrics: root.metrics,
  });
  /** Every root input and layout engine style equals a root freshly assembled from the graph. */
  const expectEqualsFresh = () => {
    const freshEngine = new FaultLayoutEngine();
    const fresh = create(freshEngine);
    expect(new Map(root.canvasInputs)).toEqual(new Map(fresh.canvasInputs));
    expect(engine.liveStyles()).toEqual(freshEngine.liveStyles());
  };
  /** Save everything pending, then reopen the project from storage in a new runtime. */
  const saveAndReload = async () => {
    await runtime.save();
    const loaded = await storage.load(projectId, library);
    const reopened = new CatalogRuntime(
      new CatalogGraph(loaded, library),
      new CatalogStorage(indexedDB, `adr248-atomic-g2-${name}`),
    );
    return {
      revision: loaded.revision,
      entry: (reopened.graph.getEntry(a.id) as NodeEntry).props.children,
      entries: loaded.entries,
    };
  };
  const expectAborted = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogStepAbortedError);
      return error as CatalogStepAbortedError;
    }
    throw new Error("EXPECTED_STEP_ABORTED");
  };
  const expectSubscriberError = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogSubscriberError);
      return error as CatalogSubscriberError;
    }
    throw new Error("EXPECTED_SUBSCRIBER_ERROR");
  };
  return {
    root,
    runtime,
    engine,
    failing,
    ids: { a: a.id, b: b.id, frame: frame.id },
    inputId,
    notified,
    edit,
    state,
    snapshot,
    expectEqualsFresh,
    saveAndReload,
    expectAborted,
    expectSubscriberError,
  };
}

describe("ADR-248 Phase 3 consumer error atomicity (G2)", () => {
  it("a root that cannot compute a dispatch leaves no trace, before or after reload", async () => {
    const s = await scene("dispatch");
    s.edit("x");
    s.root.undo(); // redo stack now holds "edit x"
    s.notified.length = 0;
    const before = s.snapshot();
    s.failing.text = "boom";
    const error = s.expectAborted(() => s.edit("boom"));
    expect(String(error.cause)).toContain("MEASURE_FAILED:boom");
    expect(error.revision).toBe(2);
    expect(s.snapshot()).toEqual(before);
    expect(s.state()).toEqual({
      graphRevision: 2,
      rootRevision: 2,
      history: { undo: 0, redo: 1 },
      graphHistory: 2,
      pending: 2,
      dirty: [s.ids.a],
      entry: { kind: "set", value: "a" },
      input: "a",
    });
    expect(s.notified).toEqual([]);
    s.expectEqualsFresh();
    // The failed edit never reaches storage.
    const reloaded = await s.saveAndReload();
    expect(reloaded).toMatchObject({
      revision: 2,
      entry: { kind: "set", value: "a" },
    });
    expect(reloaded.entries).toEqual(s.runtime.graph.exportDocument().entries);
    // The kept redo entry still applies, at the next revision.
    s.failing.text = undefined;
    s.root.redo();
    expect(s.state()).toMatchObject({
      graphRevision: 3,
      rootRevision: 3,
      history: { undo: 1, redo: 0 },
      input: "x",
    });
    s.expectEqualsFresh();
    expect(await s.saveAndReload()).toMatchObject({
      revision: 3,
      entry: { kind: "set", value: "x" },
    });
  });

  it("a root that cannot compute an undo or redo leaves that step unapplied", async () => {
    const s = await scene("undo-redo");
    s.edit("x");
    let before = s.snapshot();
    s.failing.text = "a";
    expect(s.expectAborted(() => s.root.undo()).revision).toBe(1);
    expect(s.snapshot()).toEqual(before);
    expect(s.state()).toMatchObject({
      graphRevision: 1,
      history: { undo: 1, redo: 0 },
      pending: 1,
      input: "x",
    });
    s.expectEqualsFresh();
    s.failing.text = undefined;
    s.root.undo();
    expect(s.state()).toMatchObject({
      graphRevision: 2,
      history: { undo: 0, redo: 1 },
      input: "a",
    });
    before = s.snapshot();
    s.failing.text = "x";
    expect(s.expectAborted(() => s.root.redo()).revision).toBe(2);
    expect(s.snapshot()).toEqual(before);
    s.expectEqualsFresh();
    expect(await s.saveAndReload()).toMatchObject({
      revision: 2,
      entry: { kind: "set", value: "a" },
    });
  });

  it.each(["updateStyleRaw", "computeLayout"] as const)(
    "a layout engine failure in %s during the apply leaves no trace",
    async (call) => {
      const s = await scene(`wasm-${call}`);
      s.edit("x");
      s.notified.length = 0;
      const before = s.snapshot();
      s.engine.failNext = call;
      const error = s.expectAborted(() => s.edit("wide text"));
      expect(String(error.cause)).toContain(`WASM_FAILED:${call}`);
      expect(error.revision).toBe(1);
      expect(s.snapshot()).toEqual(before);
      expect(s.notified).toEqual([]);
      s.expectEqualsFresh();
      expect(await s.saveAndReload()).toMatchObject({
        revision: 1,
        entry: { kind: "set", value: "x" },
      });
      // The rebuilt layout tree keeps taking leaf edits incrementally.
      const layoutCalls = { ...s.engine.calls };
      s.edit("y");
      expect(s.state()).toMatchObject({ graphRevision: 2, input: "y" });
      expect(s.root.metrics).toMatchObject({
        layoutInputVisits: 1,
        traversedWholeInputGraph: false,
      });
      expect(s.engine.calls.buildTreeBatch).toBe(layoutCalls.buildTreeBatch);
      s.expectEqualsFresh();
    },
  );

  it("an engine that stays broken: the step is still aborted, only geometry is unavailable", async () => {
    const s = await scene("wasm-broken");
    s.edit("x");
    const before = s.snapshot();
    s.engine.failAlways = true;
    const error = s.expectAborted(() => s.edit("wide text"));
    // The rebuild from the restored records failed too; both failures are reported.
    expect(error.cause).toBeInstanceOf(AggregateError);
    expect((error.cause as AggregateError).message).toBe(
      "CATALOG_LAYOUT_UNRECOVERABLE",
    );
    expect((error.cause as AggregateError).errors.map(String)).toEqual([
      "Error: WASM_BROKEN",
      "Error: WASM_BROKEN",
    ]);
    expect(s.snapshot()).toEqual(before);
    expect(await s.saveAndReload()).toMatchObject({
      revision: 1,
      entry: { kind: "set", value: "x" },
    });
  });

  it.each(["measure", "computeLayout"] as const)(
    "a structural edit (node added) failing in %s leaves no trace, indexes included",
    async (failure) => {
      const s = await scene(`structural-${failure}`);
      s.notified.length = 0;
      const before = s.snapshot();
      if (failure === "measure") s.failing.text = "added";
      else s.engine.failNext = "computeLayout";
      const added = node("c", "lib:definition:label", {
        props: { children: { kind: "set", value: "added" } },
      });
      s.expectAborted(() =>
        s.root.dispatch("add c", [
          { kind: "put", entry: added },
          {
            kind: "put",
            entry: {
              ...(s.runtime.graph.getEntry(s.ids.frame) as NodeEntry),
              children: [s.ids.a, s.ids.b, added.id],
            },
          },
        ]),
      );
      expect(s.snapshot()).toEqual(before);
      expect(s.runtime.graph.getEntry(added.id)).toBeUndefined();
      expect(s.notified).toEqual([]);
      s.expectEqualsFresh();
      expect((await s.saveAndReload()).entries[added.id]).toBeUndefined();
    },
  );

  it("a normal leaf edit keeps the incremental path (no table clone, no rebuild)", async () => {
    const s = await scene("leaf");
    const builds = s.engine.calls.buildTreeBatch;
    s.edit("wide"); // measured width 8 → 32: one style update
    expect(s.runtime.graph.metrics.transactionEntryTableClones).toBe(0);
    expect(s.root.metrics).toMatchObject({
      layoutInputVisits: 1,
      resolverVisits: 2,
      traversedWholeInputGraph: false,
    });
    expect(s.engine.calls).toMatchObject({
      buildTreeBatch: builds,
      updateStyleRaw: 1,
      clear: 0,
    });
  });

  it("a throwing root subscriber reports the committed revision", async () => {
    const s = await scene("root-subscriber");
    const a = s.inputId(s.ids.a);
    s.root.subscribeCanvas(a, () => {
      throw new Error("SUBSCRIBER_FAILED");
    });
    s.notified.length = 0;
    const error = s.expectSubscriberError(() => s.edit("y"));
    expect(error.errors.map(String)).toEqual(["Error: SUBSCRIBER_FAILED"]);
    expect(error.revision).toBe(1);
    expect(error.result.revision).toBe(1);
    expect(s.state()).toEqual({
      graphRevision: 1,
      rootRevision: 1,
      history: { undo: 1, redo: 0 },
      graphHistory: 1,
      pending: 1,
      dirty: [s.ids.a],
      entry: { kind: "set", value: "y" },
      input: "y",
    });
    expect(s.notified).toEqual([`canvas:${a}`, `dom:${a}`]);
    expect(s.root.metrics).toMatchObject({
      canvasInputUpdates: 2,
      domInputUpdates: 1,
    });
    s.expectEqualsFresh();
    expect(await s.saveAndReload()).toMatchObject({
      revision: 1,
      entry: { kind: "set", value: "y" },
    });
  });

  it("a throwing runtime subscriber reports the committed revision; the root still consumed it", async () => {
    const s = await scene("runtime-subscriber");
    s.runtime.subscribeEntryField(s.ids.a, "props.children", () => {
      throw new Error("RUNTIME_SUBSCRIBER_FAILED");
    });
    const error = s.expectSubscriberError(() => s.edit("z"));
    expect(error.errors.map(String)).toEqual([
      "Error: RUNTIME_SUBSCRIBER_FAILED",
    ]);
    expect(error.revision).toBe(1);
    expect(s.state()).toMatchObject({
      graphRevision: 1,
      rootRevision: 1,
      history: { undo: 1, redo: 0 },
      pending: 1,
      entry: { kind: "set", value: "z" },
      input: "z",
    });
    s.expectEqualsFresh();
  });
});
