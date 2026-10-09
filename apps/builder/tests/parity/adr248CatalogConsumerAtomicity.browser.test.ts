import { beforeAll, describe, expect, it } from "vitest";

import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import {
  createLayoutEngine,
  type LayoutEngineAPI,
} from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import {
  CatalogRuntime,
  CatalogStepAbortedError,
} from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";

/**
 * ADR-248 Phase 3 (G2), real Rust layout engine: a layout failure after the engine already
 * recomputed the edited tree aborts the step, and the geometry afterwards equals a root freshly
 * assembled from the unchanged graph. The failure is injected at the engine boundary (the real
 * `computeLayout` runs first, then the call throws).
 */
beforeAll(async () => {
  await initEngineWasm();
});

const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeEntry["id"],
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
const text = (id: string, label: string) =>
  node(id, "lib:definition:text", {
    props: { children: { kind: "set", value: label } },
    sizing: {
      width: { kind: "set", value: 80 },
      height: { kind: "set", value: 20 },
    },
  });

/** The real engine; `failAfterCompute` makes the next `computeLayout` throw after it ran. */
function faultEngine() {
  const real = createLayoutEngine();
  const control = { failAfterCompute: false };
  const engine = new Proxy(real, {
    get(target, key) {
      const value = Reflect.get(target, key) as unknown;
      if (typeof value !== "function") return value;
      if (key === "computeLayout")
        return (...args: unknown[]) => {
          (value as (...a: unknown[]) => void).apply(target, args);
          if (!control.failAfterCompute) return;
          control.failAfterCompute = false;
          throw new Error("WASM_FAILED:computeLayout");
        };
      return (value as (...a: unknown[]) => unknown).bind(target);
    },
  }) as LayoutEngineAPI;
  return { engine, control };
}

function scene(name: string) {
  const a = text("a", "A");
  const b = text("b", "B");
  const t1 = text("t1", "One");
  const t2 = text("t2", "Two");
  const group = node("group", "lib:definition:group", {
    children: [t1.id, t2.id],
    props: { orientation: { kind: "set", value: "horizontal" } },
  });
  const frame = node("frame", "lib:definition:frame", {
    children: [a.id, b.id, group.id],
  });
  const projectId = "project:project:atomicwasm" as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "atomic wasm",
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
  for (const entry of [frame, a, b, group, t1, t2]) entries[entry.id] = entry;
  const catalog: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 34,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(catalog, createPencilFixtureLibrary()),
    new CatalogStorage(indexedDB, `adr248-atomic-wasm-${name}`),
  );
  const { engine, control } = faultEngine();
  const create = (layoutEngine: LayoutEngineAPI = createLayoutEngine()) =>
    new CatalogCompositionRoot(runtime, layoutEngine, {
      width: 1440,
      height: 900,
    });
  const root = create(engine);
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find(
      (input) => input.sourceId === sourceId,
    )!.id;
  const geometry = (of: CatalogCompositionRoot) =>
    Object.fromEntries(
      [...of.getGeometry(of.canvasInputs.keys())].map(([id, rect]) => [
        id,
        [rect.x, rect.y, rect.width, rect.height],
      ]),
    );
  const widen = (id: NodeEntry["id"], width: number) =>
    root.dispatch(`widen ${id}`, [
      {
        kind: "patchNodeSizing",
        id,
        key: "width",
        write: { kind: "set", value: width },
      },
    ]);
  return {
    root,
    runtime,
    control,
    ids: { a: a.id, t1: t1.id },
    inputId,
    geometry,
    fresh: () => geometry(create()),
    widen,
  };
}

describe("ADR-248 Phase 3 consumer atomicity on the real layout engine", () => {
  it.each(["a", "t1"] as const)(
    "a failure after the engine recomputed (%s widened) restores the geometry",
    (target) => {
      const s = scene(`fail-${target}`);
      const id = s.ids[target];
      const before = {
        revision: s.runtime.graph.revision,
        history: s.runtime.historyDepth,
        pending: s.runtime.pendingCount,
        geometry: s.geometry(s.root),
      };
      expect(before.geometry[s.inputId(id)][2]).toBe(80);
      s.control.failAfterCompute = true;
      let aborted: unknown;
      try {
        s.widen(id, 200);
      } catch (error) {
        aborted = error;
      }
      expect(aborted).toBeInstanceOf(CatalogStepAbortedError);
      expect({
        revision: s.runtime.graph.revision,
        history: s.runtime.historyDepth,
        pending: s.runtime.pendingCount,
        geometry: s.geometry(s.root),
      }).toEqual(before);
      expect(s.geometry(s.root)).toEqual(s.fresh());
      // The next edit applies incrementally on the rebuilt tree and matches a fresh root.
      s.widen(id, 200);
      expect(s.root.metrics.layoutInputVisits).toBe(1);
      const after = s.geometry(s.root);
      expect(after[s.inputId(id)][2]).toBe(200);
      expect(after).toEqual(s.fresh());
    },
  );
});
