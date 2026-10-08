import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogOperation } from "../../../../../../packages/shared/src/catalog/transactions/transaction";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { renderCatalogDom } from "../domBinding";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 3: an edit that lands after a DOM node read its record in render but before its
 * subscription is registered must still reach the DOM (no lost update between render and commit).
 */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

function scene(name: string, roots: NodeEntry[], nested: NodeEntry[]) {
  const projectId = "project:project:race" as const;
  const pageId = "project:page:main" as const;
  const entries: Record<string, CatalogEntry> = {
    [projectId]: {
      kind: "project",
      id: projectId,
      name: "race",
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
      children: roots.map((entry) => entry.id),
    },
  };
  for (const entry of [...roots, ...nested]) entries[entry.id] = entry;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 19,
    revision: 0,
    projectId,
    rootId: projectId,
    entries,
  };
  const root = new CatalogCompositionRoot(
    new CatalogRuntime(
      new CatalogGraph(document, createPencilFixtureLibrary()),
      new CatalogStorage(indexedDB, `adr248-dom-race-${name}`),
    ),
    new CountLayoutEngine(),
    { width: 800, height: 600 },
  );
  const inputId = (sourceId: string) =>
    [...root.domInputs.values()].find((input) => input.sourceId === sourceId)!
      .id;
  return { root, inputId };
}

/** Render `rootId`; when `trigger` renders for the first time, dispatch `ops` mid-render. */
async function renderWithEditBetweenReadAndSubscribe(
  root: CatalogCompositionRoot,
  rootId: string,
  trigger: string,
  ops: CatalogOperation[],
) {
  const renders: string[] = [];
  let dispatched = false;
  const host = document.createElement("div");
  document.body.append(host);
  const reactRoot = createRoot(host);
  await act(async () =>
    reactRoot.render(
      renderCatalogDom(root, rootId, {
        onNodeRender: (id) => {
          renders.push(id);
          // The node has read its record in this render; its subscription is not registered yet.
          if (id === trigger && !dispatched) {
            dispatched = true;
            root.dispatch("edit between render and subscribe", ops);
          }
        },
      }),
    ),
  );
  const count = (id: string) => renders.filter((item) => item === id).length;
  const element = (id: string) =>
    host.querySelector<HTMLElement>(`[data-catalog-id="${CSS.escape(id)}"]`)!;
  return {
    count,
    element,
    domNotifiesAtEdit: root.metrics.domInputUpdates,
    cleanup: () => {
      act(() => reactRoot.unmount());
      host.remove();
    },
  };
}

describe("ADR-248 Phase 3 DOM binding render→subscribe gap", () => {
  it("a Text edit between its render and subscription reaches the DOM", async () => {
    const a = node("a", "lib:definition:text", {
      props: { children: { kind: "set", value: "before" } },
    });
    const b = node("b", "lib:definition:text", {
      props: { children: { kind: "set", value: "sibling" } },
    });
    const frame = node("frame", "lib:definition:frame", {
      children: [a.id, b.id],
    });
    const { root, inputId } = scene("text", [frame], [a, b]);
    const view = await renderWithEditBetweenReadAndSubscribe(
      root,
      inputId(frame.id),
      inputId(a.id),
      [
        {
          kind: "patchNodeProp",
          id: a.id,
          key: "children",
          write: { kind: "set", value: "after" },
        },
      ],
    );
    // No subscriber existed when the edit landed.
    expect(view.domNotifiesAtEdit).toBe(0);
    expect(root.domInputs.get(inputId(a.id))?.props.children).toBe("after");
    expect(view.element(inputId(a.id)).textContent).toBe("after");
    // Only the edited node renders again; the sibling and the Frame render once.
    expect({
      a: view.count(inputId(a.id)),
      b: view.count(inputId(b.id)),
      frame: view.count(inputId(frame.id)),
    }).toEqual({ a: 2, b: 1, frame: 1 });
    view.cleanup();
  });

  it("a Slot edit between the child Text's render and subscription reaches both", async () => {
    const text = node("label", "lib:definition:text", {
      props: { children: { kind: "set", value: "slotted" } },
    });
    const other = node("other", "lib:definition:text", {
      props: { children: { kind: "set", value: "outside" } },
    });
    const slot = node("slot", "lib:definition:slot", {
      children: [text.id],
    });
    const frame = node("frame", "lib:definition:frame", {
      children: [slot.id, other.id],
    });
    const { root, inputId } = scene("slot", [frame], [slot, text, other]);
    const before = Number(
      root.domInputs.get(inputId(slot.id))?.visual.fontSize,
    );
    const view = await renderWithEditBetweenReadAndSubscribe(
      root,
      inputId(frame.id),
      inputId(text.id),
      [
        {
          kind: "patchNodeProp",
          id: slot.id,
          key: "size",
          write: { kind: "set", value: "sm" },
        },
      ],
    );
    const after = Number(root.domInputs.get(inputId(slot.id))?.visual.fontSize);
    expect(after).not.toBe(before);
    expect(view.domNotifiesAtEdit).toBe(0);
    // The Slot itself and its inheriting Text both show the new text metric.
    expect(view.element(inputId(slot.id)).style.fontSize).toBe(`${after}px`);
    expect(view.element(inputId(text.id)).style.fontSize).toBe(`${after}px`);
    expect({
      slot: view.count(inputId(slot.id)),
      text: view.count(inputId(text.id)),
      other: view.count(inputId(other.id)),
      frame: view.count(inputId(frame.id)),
    }).toEqual({ slot: 2, text: 2, other: 1, frame: 1 });
    view.cleanup();
  });
});
