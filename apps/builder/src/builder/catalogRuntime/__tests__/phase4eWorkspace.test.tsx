import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_DEFINITIONS } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import type {
  CatalogLibrary,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { documentOf } from "../../../../../../packages/shared/src/catalog/commands/__tests__/fixture";
import type { CatalogPosition } from "../../../../../../packages/shared/src/catalog/resolution/positions";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import {
  CatalogWorkspaceProvider,
  useCatalogRows,
  useCatalogSaveStatus,
  useCatalogSession,
} from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";

/**
 * ADR-248 Phase 4e-1 workspace host: one project's runtime, composition root, session, read model
 * and autosave. A drawn record maps back to the Layers row an edit addresses; a command's result
 * becomes the selection at its drawn position; React hooks re-render on their own read only.
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
    `project:${kind}:w${++next}` as EntryId<K>;
};

let library: CatalogLibrary | undefined;
async function open(nodes: NodeEntry[], roots: string[]) {
  library ??= await buildCodeCatalogLibrary();
  const queued: (() => void)[] = [];
  return new CatalogWorkspace(
    new CatalogGraph(documentOf(nodes, roots), library),
    new CatalogStorage(indexedDB, `adr248-phase4e-ws-${Math.random()}`),
    {
      engine: new CountLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: (run) => queued.push(run),
    },
  );
}

describe("ADR-248 Phase 4e-1 workspace host", () => {
  it("every drawn element record maps back to its Layers row (all code library origins)", async () => {
    const origins = REUSABLE_ORIGIN_DEFINITIONS.map((definition, index) =>
      node(`origin${index}`, definition.id),
    );
    const workspace = await open(
      origins,
      origins.map((_, index) => `origin${index}`),
    );
    const rows = new Map<string, CatalogPosition>();
    const walk = (position: CatalogPosition) => {
      if (position.disabled) return;
      rows.set(position.identity, position);
      workspace.readModel.childRows(position).forEach(walk);
    };
    workspace.readModel.pageRows(PAGE).forEach(walk);
    let checked = 0;
    for (const [recordId, record] of workspace.root.domInputs) {
      if (
        !record.sourceId.startsWith("project:node:") &&
        !record.sourceId.startsWith("lib:template:")
      )
        continue;
      const position = workspace.positionOfRecord(recordId);
      expect(position?.identity).toBe(recordId);
      expect(position?.target).toEqual(rows.get(recordId)?.target);
      checked++;
    }
    expect(checked).toBe(rows.size);
    expect(checked).toBeGreaterThan(origins.length * 2);
  });

  it("a command's result is selected at its drawn position; picking a template record selects its descendant target; undo drops it", async () => {
    const workspace = await open(
      [
        node("frame", "lib:definition:type-frame", { children: [id("a")] }),
        text("a", "A"),
        node("list", "lib:definition:origin-component-listbox"),
      ],
      ["frame", "list"],
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("frame") },
        entries: [text("b", "B")],
        rootIds: [id("b")],
        newId: allocator(),
      }),
    );
    const [inserted] = workspace.session.getSnapshot().selection;
    expect(inserted.target).toEqual({ kind: "node", id: id("b") });
    expect(workspace.root.domInputs.get(inserted.identity)?.sourceId).toBe(
      id("b"),
    );
    // Pick a label inside the ListBox instance: its descendant target edits that position.
    const label = [...workspace.root.domInputs.values()].find((record) =>
      record.sourceId.endsWith("item-default__label"),
    )!;
    workspace.selectRecords([label.id]);
    const [picked] = workspace.session.getSnapshot().selection;
    expect(picked.target.kind).toBe("descendant");
    workspace.execute(
      setFields({
        targets: [picked.target],
        props: { children: { kind: "set", value: "Mail" } },
      }),
    );
    expect(workspace.root.domInputs.get(label.id)?.props.children).toBe("Mail");
    workspace.undo();
    workspace.undo();
    expect(workspace.session.getSnapshot().selection).toEqual([picked]);
    workspace.selectRecords([inserted.identity]);
    expect(workspace.session.getSnapshot().selection).toEqual([]);
    // A target that exists but is not drawn at that identity is not selectable.
    workspace.session.select([
      { target: { kind: "node", id: id("a") }, identity: "::not-drawn" },
    ]);
    expect(workspace.session.getSnapshot().selection).toEqual([]);
  });

  it("hooks re-render on their own read: a leaf edit re-renders the selection-free row list 0 times", async () => {
    const workspace = await open([text("a", "A"), text("b", "B")], ["a", "b"]);
    const renders = { rows: 0, selection: 0, status: 0 };
    function Rows() {
      renders.rows++;
      return <>{useCatalogRows({ pageId: PAGE }).length}</>;
    }
    function Selection() {
      renders.selection++;
      return <>{useCatalogSession((state) => state.selection).length}</>;
    }
    function Status() {
      renders.status++;
      return <>{useCatalogSaveStatus().state}</>;
    }
    const view = render(
      <CatalogWorkspaceProvider workspace={workspace}>
        <Rows />|<Selection />|<Status />
      </CatalogWorkspaceProvider>,
    );
    expect(view.container.textContent).toBe("2|0|saved");
    const before = { ...renders };
    act(() => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("a") }],
          props: { children: { kind: "set", value: "A1" } },
        }),
      );
    });
    expect(renders.rows).toBe(before.rows);
    expect(renders.selection).toBe(before.selection);
    expect(view.container.textContent).toBe("2|0|unsaved");
    act(() => {
      workspace.execute(
        insertNodes({
          parent: { kind: "page", id: PAGE },
          entries: [text("c", "C")],
          rootIds: [id("c")],
          newId: allocator(),
        }),
      );
    });
    expect(view.container.textContent).toBe("3|1|unsaved");
  });
});
