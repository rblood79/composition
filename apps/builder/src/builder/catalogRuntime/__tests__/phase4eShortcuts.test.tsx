import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { useCatalogGlobalShortcuts } from "../../main/useCatalogGlobalShortcuts";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogShortcutLabelKey, runCatalogShortcut } from "../shortcuts";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import {
  resolveEditingSemanticsImpactConfirmation,
  subscribeEditingSemanticsImpactConfirmation,
} from "../../utils/editingSemanticsImpactConfirmation";

/**
 * ADR-248 Phase 4e-5 shortcuts: the document shortcuts run the workspace's commands (the Canvas
 * menu's plans — a refused one does nothing), one history step each; arrows reorder one element,
 * Tab moves the selection among siblings, ⌘A selects the current level; the global hook runs them
 * from the keyboard (⌘Z anywhere, Delete with the Canvas focused, not in a text field).
 */
const PROJECT = "project:project:keys" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:k${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Keys" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-keys-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("list", "lib:definition:type-frame", [id("a"), id("b"), id("c")]),
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
        node("c", "lib:definition:text"),
      ],
      rootIds: [id("list")],
      newId: allocator(),
    }),
  );
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  const children = (name: string | NodeId) => {
    const entry = workspace.runtime.graph.getEntry(
      name.startsWith("project:") ? (name as NodeId) : id(name),
    );
    return entry?.kind === "node" ? entry.children : [];
  };
  const selected = () =>
    workspace.session
      .getSnapshot()
      .selection.map((item) =>
        item.target.kind === "node" ? item.target.id : "",
      );
  const steps = () => workspace.runtime.historyDepth.undo;
  return { workspace, record, children, selected, steps };
}


/** Answer the component confirmation dialog (detach · dissolve ask first); returns the asked kinds. */
function answerComponentConfirm(answer: boolean) {
  const asked: string[] = [];
  const stop = subscribeEditingSemanticsImpactConfirmation((request) => {
    if (!request) return;
    asked.push(request.kind ?? "origin-impact");
    queueMicrotask(() => resolveEditingSemanticsImpactConfirmation(answer));
  });
  return { asked, stop };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ADR-248 Phase 4e-5 shortcuts", () => {
  it("copy · paste after the selection · cut · duplicate · delete: one step each, the new nodes selected", async () => {
    const { workspace, record, children, selected, steps } = await open();
    workspace.selectRecords([record("a")]);
    const before = steps();
    expect(runCatalogShortcut(workspace, "copy")).toBe(true);
    expect(steps()).toBe(before);
    expect(runCatalogShortcut(workspace, "paste")).toBe(true);
    expect(steps()).toBe(before + 1);
    const pasted = children("list")[1]!;
    expect(children("list")).toEqual([id("a"), pasted, id("b"), id("c")]);
    expect(selected()).toEqual([pasted]);

    workspace.selectRecords([record("c")]);
    expect(runCatalogShortcut(workspace, "cut")).toBe(true);
    expect(steps()).toBe(before + 2);
    expect(children("list")).toEqual([id("a"), pasted, id("b")]);

    workspace.selectRecords([record("b")]);
    expect(runCatalogShortcut(workspace, "duplicate")).toBe(true);
    expect(children("list")).toHaveLength(4);
    expect(selected()).toEqual([children("list")[3]]);

    expect(runCatalogShortcut(workspace, "delete")).toBe(true);
    expect(children("list")).toEqual([id("a"), pasted, id("b")]);
    expect(runCatalogShortcut(workspace, "undo")).toBe(true);
    expect(children("list")).toHaveLength(4);
    expect(runCatalogShortcut(workspace, "redo")).toBe(true);
    expect(children("list")).toHaveLength(3);
  });

  it("paste without a selection goes into the page body; nothing copied or selected = no step", async () => {
    const { workspace, record, children, steps } = await open();
    workspace.session.clearSelection();
    const before = steps();
    expect(runCatalogShortcut(workspace, "paste")).toBe(false);
    expect(runCatalogShortcut(workspace, "copy")).toBe(false);
    expect(runCatalogShortcut(workspace, "delete")).toBe(false);
    expect(runCatalogShortcut(workspace, "arrowDown")).toBe(false);
    expect(steps()).toBe(before);
    workspace.selectRecords([record("c")]);
    runCatalogShortcut(workspace, "copy");
    workspace.session.clearSelection();
    expect(runCatalogShortcut(workspace, "paste")).toBe(true);
    expect(children(BODY)).toHaveLength(2);
  });

  it("group · ungroup · z-order", async () => {
    const { workspace, record, children, selected } = await open();
    workspace.selectRecords([record("a"), record("b")]);
    expect(runCatalogShortcut(workspace, "group")).toBe(true);
    const [group] = children("list");
    expect(children(group!)).toEqual([id("a"), id("b")]);
    expect(runCatalogShortcut(workspace, "ungroup")).toBe(true);
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);
    expect(selected()).toEqual([id("a"), id("b")]);

    workspace.selectRecords([record("a")]);
    expect(runCatalogShortcut(workspace, "bringToFront")).toBe(true);
    expect(children("list")).toEqual([id("b"), id("c"), id("a")]);
    expect(runCatalogShortcut(workspace, "bringForward")).toBe(false);
    expect(runCatalogShortcut(workspace, "sendToBack")).toBe(true);
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);
  });

  it("arrows reorder one element a step (not past the ends); Tab wraps among siblings; ⌘A selects the level", async () => {
    const { workspace, record, children, selected } = await open();
    workspace.selectRecords([record("b")]);
    expect(runCatalogShortcut(workspace, "arrowDown")).toBe(true);
    expect(children("list")).toEqual([id("a"), id("c"), id("b")]);
    expect(runCatalogShortcut(workspace, "arrowRight")).toBe(false);
    expect(runCatalogShortcut(workspace, "arrowUp")).toBe(true);
    expect(runCatalogShortcut(workspace, "arrowLeft")).toBe(true);
    expect(children("list")).toEqual([id("b"), id("a"), id("c")]);
    expect(runCatalogShortcut(workspace, "arrowUp")).toBe(false);

    workspace.selectRecords([record("c")]);
    expect(runCatalogShortcut(workspace, "nextElement")).toBe(true);
    expect(selected()).toEqual([id("b")]);
    expect(runCatalogShortcut(workspace, "prevElement")).toBe(true);
    expect(selected()).toEqual([id("c")]);

    expect(runCatalogShortcut(workspace, "selectAll")).toBe(true);
    expect(selected()).toEqual([id("list")]);
    workspace.session.enterContext(id("list"));
    expect(runCatalogShortcut(workspace, "selectAll")).toBe(true);
    expect(selected()).toEqual([id("b"), id("a"), id("c")]);
  });

  it("detach: a library instance becomes owned nodes (one step); a plain node is refused without an error", async () => {
    const { workspace, record, children, steps } = await open();
    const errors: unknown[] = [];
    workspace.selectRecords([record("a")]);
    const before = steps();
    expect(
      runCatalogShortcut(workspace, "detachInstance", (e) => errors.push(e)),
    ).toBe(false);
    expect(steps()).toBe(before);
    expect(errors).toEqual([]);
    const library = workspace.runtime.graph.library;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("menu", catalogPaletteDefinitionId(library, "ListBox"))],
        rootIds: [id("menu")],
        newId: allocator(),
      }),
    );
    workspace.selectRecords([record("menu")]);
    const dialog = answerComponentConfirm(true);
    expect(
      runCatalogShortcut(workspace, "detachInstance", (e) => errors.push(e)),
    ).toBe(true);
    await settle();
    dialog.stop();
    expect(dialog.asked).toEqual(["detach-instance"]);
    expect(errors).toEqual([]);
    expect(children("menu").length).toBeGreaterThan(0);
  });

  it("⌘⌥K creates a component from one element and dissolves it again (the menu label follows)", async () => {
    const { workspace, record, steps } = await open();
    const errors: unknown[] = [];
    const definitions = () => {
      const project = workspace.runtime.graph.getEntry(
        workspace.runtime.graph.projectId,
      );
      return project?.kind === "project" ? project.definitionIds.length : -1;
    };
    workspace.selectRecords([record("a"), record("b")]);
    expect(catalogShortcutLabelKey(workspace, "toggleComponentOrigin")).toBe(
      undefined,
    );
    expect(
      runCatalogShortcut(workspace, "toggleComponentOrigin", (e) =>
        errors.push(e),
      ),
    ).toBe(false);

    workspace.selectRecords([record("a")]);
    expect(catalogShortcutLabelKey(workspace, "toggleComponentOrigin")).toBe(
      "componentAction.createComponent",
    );
    const before = steps();
    const count = definitions();
    expect(
      runCatalogShortcut(workspace, "toggleComponentOrigin", (e) =>
        errors.push(e),
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(steps()).toBe(before + 1);
    expect(definitions()).toBe(count + 1);

    // The element is now the component's origin instance: the same key dissolves it.
    workspace.selectRecords([workspace.session.getSnapshot().selection[0]!.identity]);
    expect(catalogShortcutLabelKey(workspace, "toggleComponentOrigin")).toBe(
      "componentAction.detachComponent",
    );
    // The dissolve asks first (the instance count) — the old origin toggle.
    const dialog = answerComponentConfirm(true);
    expect(
      runCatalogShortcut(workspace, "toggleComponentOrigin", (e) =>
        errors.push(e),
      ),
    ).toBe(true);
    await settle();
    dialog.stop();
    expect(dialog.asked).toEqual(["origin-impact"]);
    expect(errors).toEqual([]);
    expect(definitions()).toBe(count);
  });

  it("the global hook: ⌘Z undoes from anywhere; Delete needs the Canvas focus and skips a text field", async () => {
    const { workspace, record, children } = await open();
    const cmd = navigator.platform.includes("Mac")
      ? { metaKey: true }
      : { ctrlKey: true };
    function Host() {
      useCatalogGlobalShortcuts(workspace, (error) => {
        throw error;
      });
      return (
        <>
          <div
            data-canvas-container="true"
            tabIndex={-1}
            data-testid="canvas"
          />
          <input data-testid="field" />
        </>
      );
    }
    const view = render(<Host />);
    workspace.selectRecords([record("b")]);
    const canvas = view.getByTestId("canvas");
    act(() => canvas.focus());
    fireEvent.focusIn(canvas);
    fireEvent.keyDown(canvas, { key: "Backspace", code: "Backspace" });
    expect(children("list")).toEqual([id("a"), id("c")]);

    const field = view.getByTestId("field");
    act(() => field.focus());
    fireEvent.focusIn(field);
    workspace.selectRecords([record("a")]);
    fireEvent.keyDown(field, { key: "Backspace", code: "Backspace" });
    expect(children("list")).toEqual([id("a"), id("c")]);

    act(() => canvas.focus());
    fireEvent.focusIn(canvas);
    fireEvent.keyDown(canvas, { key: "z", code: "KeyZ", ...cmd });
    expect(children("list")).toEqual([id("a"), id("b"), id("c")]);
    view.unmount();
  });

  it("⌘C / ⌘V with focus in the Properties panel copy and paste the selection (a text field keeps the browser's own)", async () => {
    const { workspace, record, children } = await open();
    const cmd = navigator.platform.includes("Mac")
      ? { metaKey: true }
      : { ctrlKey: true };
    function Host() {
      useCatalogGlobalShortcuts(workspace, (error) => {
        throw error;
      });
      return (
        <div data-panel-id="properties">
          <button data-testid="control">control</button>
          <input data-testid="field" />
        </div>
      );
    }
    const view = render(<Host />);
    workspace.selectRecords([record("b")]);
    const control = view.getByTestId("control");
    act(() => control.focus());
    fireEvent.focusIn(control);
    fireEvent.keyDown(control, { key: "c", code: "KeyC", ...cmd });
    fireEvent.keyDown(control, { key: "v", code: "KeyV", ...cmd });
    expect(children("list")).toHaveLength(4);

    const field = view.getByTestId("field");
    act(() => field.focus());
    fireEvent.focusIn(field);
    fireEvent.keyDown(field, { key: "v", code: "KeyV", ...cmd });
    expect(children("list")).toHaveLength(4);
    view.unmount();
  });

  it("align / distribute: the placed elements of the selection (the old rule), one step; flow elements and too few do nothing", async () => {
    const { workspace } = await open();
    const placed = (name: string, x: number, y: number, width: number) => ({
      ...node(name, "lib:definition:type-frame"),
      placement: { kind: "absolute" as const, x, y },
      sizing: {
        width: { kind: "set" as const, value: width },
        height: { kind: "set" as const, value: 20 },
      },
    });
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          placed("p1", 10, 10, 40),
          placed("p2", 100, 50, 60),
          placed("p3", 300, 90, 20),
        ],
        rootIds: [id("p1"), id("p2"), id("p3")],
        newId: allocator(),
      }),
    );
    const at = (name: string) => {
      const entry = workspace.runtime.graph.getEntry(id(name));
      return entry?.kind === "node" && entry.placement?.kind === "absolute"
        ? [entry.placement.x, entry.placement.y]
        : undefined;
    };
    const select = (...names: string[]) =>
      workspace.selectRecords(
        names.map((name) => workspace.root.recordsOfSource(id(name))[0]),
      );
    const steps = () => workspace.runtime.historyDepth.undo;
    // Shift arrows nudge pages only: on an element they do nothing.
    select("a");
    expect(runCatalogShortcut(workspace, "arrowDownShift")).toBe(false);
    // One placed element (a flow element beside it): nothing to align.
    select("p1", "a");
    expect(runCatalogShortcut(workspace, "alignLeft")).toBe(false);
    const before = steps();
    select("p1", "p2", "a");
    expect(runCatalogShortcut(workspace, "alignLeft")).toBe(true);
    expect(steps()).toBe(before + 1);
    expect(at("p2")).toEqual([10, 50]);
    expect(at("p1")).toEqual([10, 10]);
    // Already aligned: nothing moves, no step.
    expect(runCatalogShortcut(workspace, "alignLeft")).toBe(false);
    expect(steps()).toBe(before + 1);
    workspace.undo();
    select("p1", "p2", "p3");
    expect(runCatalogShortcut(workspace, "alignRight")).toBe(true);
    expect([
      at("p1")![0]! + 40,
      at("p2")![0]! + 60,
      at("p3")![0]! + 20,
    ]).toEqual([320, 320, 320]);
    expect(runCatalogShortcut(workspace, "alignVCenter")).toBe(true);
    expect(at("p1")![1]).toBe(at("p3")![1]);
    workspace.undo();
    workspace.undo();
    // Distribute: equal gaps between the three (ends fixed); two are too few.
    expect(runCatalogShortcut(workspace, "distributeH")).toBe(true);
    const [x1, x2, x3] = [at("p1")![0]!, at("p2")![0]!, at("p3")![0]!];
    expect([x1, x3]).toEqual([10, 300]);
    expect(x2 - (x1 + 40)).toBe(x3 - (x2 + 60));
    select("p1", "p2");
    expect(runCatalogShortcut(workspace, "distributeH")).toBe(false);
  });
});
