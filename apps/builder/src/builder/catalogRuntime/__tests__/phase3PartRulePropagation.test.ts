import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/library";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3: a parent prop edit reaches the direct children its definition's partRules
 * target (resolved value, Canvas/DOM input and notification); unrelated children stay untouched.
 */
class CountLayoutEngine implements LayoutEngineAPI {
  private next = 1;
  isAvailable() {
    return true;
  }
  hasBinaryProtocol() {
    return false;
  }
  buildTreeBatch(json: string) {
    return (JSON.parse(json) as unknown[]).map(() => this.next++);
  }
  buildTreeBatchBinary(): number[] {
    throw new Error("not used");
  }
  createNodeRaw() {
    return this.next++;
  }
  updateStyleRaw() {}
  setChildren() {}
  markDirty() {}
  removeNode() {}
  setViewport() {}
  computeLayout() {}
  getLayoutsBatch() {
    return new Map();
  }
  clear() {}
  nodeCount() {
    return this.next - 1;
  }
}

const library = buildCatalogLibrary({
  contractVersion: 10,
  revision: "adr248-part-rule-propagation",
  bindingIds: ["frame", "text"],
  actionOpCodes: [],
  definitions: [
    {
      id: "lib:definition:panel",
      name: "Panel",
      mode: "primitive",
      bindingId: "frame",
      accepts: { tone: "string", label: "string" },
      defaults: { tone: "neutral" },
      visual: {},
      partRules: [
        {
          child: {
            definitionId: "lib:definition:label",
            props: { kind: "title" },
          },
          when: { tone: "danger" },
          visual: { color: "#ff0000" },
        },
      ],
      stateRules: {},
    },
    {
      id: "lib:definition:label",
      name: "Label",
      mode: "primitive",
      bindingId: "text",
      accepts: { children: "string", kind: "string" },
      defaults: { children: "" },
      visual: {},
      stateRules: {},
    },
    {
      id: "lib:definition:text",
      name: "Text",
      mode: "primitive",
      bindingId: "text",
      accepts: { children: "string" },
      defaults: { children: "" },
      visual: {},
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
  id: `project:node:${id}` as NodeEntry["id"],
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

function makeRoot() {
  const title = node("title", "lib:definition:label", {
    props: { kind: { kind: "set", value: "title" } },
  });
  const hint = node("hint", "lib:definition:label", {
    props: { kind: { kind: "set", value: "hint" } },
  });
  const plain = node("plain", "lib:definition:text");
  const panel = node("panel", "lib:definition:panel", {
    children: [title.id, hint.id, plain.id],
  });
  const other = node("other", "lib:definition:text");
  const projectId = "project:project:partrules" as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "part rules",
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
      children: [panel.id, other.id],
    },
  };
  for (const entry of [panel, title, hint, plain, other])
    entries[entry.id] = entry;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 10,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, "adr248-phase3-part-rule-propagation"),
  );
  const root = new CatalogCompositionRoot(runtime, new CountLayoutEngine(), {
    width: 800,
    height: 600,
  });
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find(
      (input) => input.sourceId === sourceId,
    )!.id;
  return {
    root,
    panel: panel.id,
    ids: {
      panel: inputId(panel.id),
      title: inputId(title.id),
      hint: inputId(hint.id),
      plain: inputId(plain.id),
      other: inputId(other.id),
    },
  };
}

describe("ADR-248 Phase 3 partRules parent prop propagation", () => {
  it("a parent prop edit updates only the partRule-affected child inputs and notifications", () => {
    const { root, panel, ids } = makeRoot();
    expect(root.canvasInputs.get(ids.title)?.visual.color).toBeUndefined();
    const notified: Record<string, { canvas: number; dom: number }> = {};
    for (const [name, id] of Object.entries(ids)) {
      notified[name] = { canvas: 0, dom: 0 };
      root.subscribeCanvas(id, () => notified[name].canvas++);
      root.subscribeDom(id, () => notified[name].dom++);
    }
    const unrelatedBefore = {
      hint: root.canvasInputs.get(ids.hint),
      plain: root.canvasInputs.get(ids.plain),
      other: root.canvasInputs.get(ids.other),
    };

    root.dispatch("panel tone danger", [
      {
        kind: "patchNodeProp",
        id: panel,
        key: "tone",
        write: { kind: "set", value: "danger" },
      },
    ]);
    const metrics = root.metrics;
    console.info(
      "[adr248-part-rule-propagation]",
      JSON.stringify({
        resolverVisits: metrics.resolverVisits,
        resolverIncludeChecks: metrics.resolverIncludeChecks,
        layoutInputVisits: metrics.layoutInputVisits,
        canvasInputUpdates: metrics.canvasInputUpdates,
        domInputUpdates: metrics.domInputUpdates,
        notified,
      }),
    );

    // Affected child: resolved value and consumer input both carry the part rule.
    expect(root.canvasInputs.get(ids.title)?.visual.color).toBe("#ff0000");
    expect(root.domInputs.get(ids.title)?.visual.color).toBe("#ff0000");
    expect(notified).toEqual({
      panel: { canvas: 1, dom: 1 },
      title: { canvas: 1, dom: 1 },
      hint: { canvas: 0, dom: 0 },
      plain: { canvas: 0, dom: 0 },
      other: { canvas: 0, dom: 0 },
    });
    // Unrelated children keep their input records (same identity: not re-resolved).
    expect(root.canvasInputs.get(ids.hint)).toBe(unrelatedBefore.hint);
    expect(root.canvasInputs.get(ids.plain)).toBe(unrelatedBefore.plain);
    expect(root.canvasInputs.get(ids.other)).toBe(unrelatedBefore.other);
    expect(metrics).toMatchObject({
      changedIds: [panel],
      layoutInputVisits: 2,
      canvasInputUpdates: 2,
      domInputUpdates: 2,
      traversedWholeInputGraph: false,
    });

    // Reverting the condition removes the rule output again.
    root.dispatch("panel tone neutral", [
      {
        kind: "patchNodeProp",
        id: panel,
        key: "tone",
        write: { kind: "set", value: "neutral" },
      },
    ]);
    expect(root.canvasInputs.get(ids.title)?.visual.color).toBeUndefined();
    expect(notified.title).toEqual({ canvas: 2, dom: 2 });

    // A parent prop no rule reads re-resolves the parent only.
    root.dispatch("panel label", [
      {
        kind: "patchNodeProp",
        id: panel,
        key: "label",
        write: { kind: "set", value: "Panel" },
      },
    ]);
    expect(root.metrics).toMatchObject({
      layoutInputVisits: 1,
      canvasInputUpdates: 1,
      domInputUpdates: 1,
    });
    expect(notified.title).toEqual({ canvas: 2, dom: 2 });
  });
});
