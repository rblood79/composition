import { resolveToken } from "@composition/rendering";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react";
import { PropertyUnitInput } from "../../components/property/PropertyUnitInput";
import { PropertySelectionContext } from "../../components/property/propertySelection";
import { SPACING_PRESET_OPTIONS } from "../../components/property/propertyUnitPresets";
import { useOptimizedStyleActions } from "../../panels/styles/hooks/useOptimizedStyleActions";
import { StylesHostContext } from "../../panels/styles/stylesHost";
import type { ReactNode } from "react";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";

/**
 * ADR-298: token scrub previews reach the real consumer without a transaction;
 * cancellation restores authored values and release records one undoable token write.
 */
afterEach(cleanup);

const BODY = "project:node:home-body" as NodeId;
const BOX = "project:node:box" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:styles" as EntryId<"project">,
        name: "Styles",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-styles-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const box: NodeEntry = {
    kind: "node",
    id: BOX,
    definitionId: "lib:definition:type-frame",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [box],
      rootIds: [BOX],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(BOX)[0];
  workspace.selectRecords([record]);
  return {
    workspace,
    graph: workspace.runtime.graph,
    record,
    host: createCatalogStylesHost(workspace),
  };
}

describe("ADR-298 token scrub preview", () => {
  it.each([
    ["borderRadius", "var(--radius-lg)", "visual", "radius", 10],
    ["paddingTop", "var(--spacing-md)", "visual", "paddingTop", 12],
    ["columnGap", "var(--spacing-md)", "layout", "columnGap", "12px"],
  ] as const)(
    "%s updates the consumer before release",
    async (property, value, layer, field, expected) => {
      const { workspace, graph, record, host } = await open();
      host.updateStyle(property, "4px");
      const revision = graph.revision;
      host.previewStyle(property, "16px");
      expect(workspace.root.domInputs.get(record)![layer][field]).toBe(
        layer === "layout" ? "16px" : 16,
      );
      host.previewStyle(property, value);
      expect(graph.revision).toBe(revision);
      expect(workspace.root.domInputs.get(record)![layer][field]).toBe(
        expected,
      );
    },
  );

  it.each(["cancel", "return", "lostcapture"])(
    "token scrub %s restores the document value",
    async (end) => {
      const { workspace, graph, record, host } = await open();
      const original = "var(--spacing-md)";
      host.updateStyle("paddingTop", original);
      const revision = graph.revision;
      const onChange = vi.fn((v: string) => host.updateStyle("paddingTop", v));
      const selection = {
        useSelectedId: () => BOX,
        readSelectedId: () => BOX,
      };
      const view = render(
        <PropertySelectionContext.Provider value={selection}>
          <PropertyUnitInput
            label="Padding"
            value={original}
            presets={SPACING_PRESET_OPTIONS}
            onChange={onChange}
            onDragCancel={() => host.cancelPreview?.()}
            onDrag={(v) => host.previewStyle("paddingTop", v)}
          />
        </PropertySelectionContext.Provider>,
      );
      const legend = view.container.querySelector("legend")!;
      fireEvent.pointerDown(legend, {
        button: 0,
        clientX: 100,
        pointerId: 1,
      });
      fireEvent.pointerMove(legend, {
        clientX: 104,
        pointerId: 1,
        altKey: true,
      });
      expect(workspace.root.domInputs.get(record)!.visual.paddingTop).toBe(16);
      if (end === "cancel") fireEvent.pointerCancel(legend, { pointerId: 1 });
      else if (end === "lostcapture")
        fireEvent.lostPointerCapture(legend, { pointerId: 1 });
      else {
        fireEvent.pointerMove(legend, { clientX: 100, pointerId: 1 });
        fireEvent.pointerUp(legend, { clientX: 100, pointerId: 1 });
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(graph.revision).toBe(revision);
      expect(workspace.root.domInputs.get(record)!.visual.paddingTop).toBe(12);
      expect(workspace.root.previewing(record)).toBe(false);
    },
  );

  it("a step scrub on a token field walks from the token's step", async () => {
    // (The field shows the step name 「M」 — the scrub starts from its resolved px, not from 0.)
    const onDrag = vi.fn();
    const view = render(
      <PropertySelectionContext.Provider
        value={{ useSelectedId: () => BOX, readSelectedId: () => BOX }}
      >
        <PropertyUnitInput
          label="Padding"
          value="var(--spacing-md)"
          presets={SPACING_PRESET_OPTIONS}
          onChange={() => {}}
          onDrag={onDrag}
        />
      </PropertySelectionContext.Provider>,
    );
    const legend = view.container.querySelector("legend")!;
    fireEvent.pointerDown(legend, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(legend, { clientX: 108, pointerId: 1 });
    expect(onDrag).toHaveBeenLastCalledWith("var(--spacing-lg)");
    fireEvent.pointerMove(legend, { clientX: 92, pointerId: 1 });
    expect(onDrag).toHaveBeenLastCalledWith("var(--spacing-sm)");
  });

  it("commits one token edit and Undo restores the starting value", async () => {
    const { workspace, graph, record, host } = await open();
    host.updateStyle("paddingTop", "4px");
    const revision = graph.revision;
    host.previewStyle("paddingTop", "var(--spacing-md)");
    expect(graph.revision).toBe(revision);
    expect(workspace.root.domInputs.get(record)!.visual.paddingTop).toBe(12);
    host.updateStyle("paddingTop", "var(--spacing-md)");
    expect(graph.revision).toBe(revision + 1);
    expect((graph.getEntry(BOX) as NodeEntry).visual.paddingTop).toEqual({
      kind: "set",
      value: { kind: "token", tokenId: "lib:token:spacing_md" },
    });
    expect(workspace.root.previewing(record)).toBe(false);
    workspace.undo();
    expect(workspace.root.domInputs.get(record)!.visual.paddingTop).toBe(4);
  });

  it("cancel prevents a pending RAF from reviving the preview", async () => {
    const { workspace, record, host } = await open();
    const frames = new Map<number, FrameRequestCallback>();
    let serial = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.set(++serial, cb);
      return serial;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const flush = () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((cb) => cb(0));
    };
    try {
      host.updateStyle("paddingTop", "var(--spacing-md)");
      const hook = renderHook(() => useOptimizedStyleActions(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StylesHostContext.Provider value={host}>
            {children}
          </StylesHostContext.Provider>
        ),
      });
      act(() => {
        hook.result.current.updateStylePreview("paddingTop", "16px");
        flush();
      });
      expect(workspace.root.domInputs.get(record)!.visual.paddingTop).toBe(16);
      act(() => {
        hook.result.current.updateStylePreview(
          "paddingTop",
          "var(--spacing-lg)",
        );
        hook.result.current.cancelStylePreview();
        flush();
      });
      expect(workspace.root.domInputs.get(record)!.visual.paddingTop).toBe(12);
      expect(workspace.root.previewing(record)).toBe(false);
      hook.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("typography preview and commit agree on auto and explicit line ratios", async () => {
    const { workspace, record, host } = await open();
    const visual = () => workspace.root.domInputs.get(record)!.visual;
    host.previewStyle("fontSize", "var(--text-heading-md)");
    const preview = visual();
    expect(preview.fontSize).toBe(22);
    expect(preview.lineHeight).toBeCloseTo(26 / 22);
    host.updateStyle("fontSize", "var(--text-heading-md)");
    expect(visual().lineHeight).toBe(preview.lineHeight);
    host.previewStyle("lineHeight", "var(--text-heading-lg--line-height)");
    const line = visual().lineHeight;
    const linePx = Number(
      resolveToken("{typography.text-heading-lg--line-height}"),
    );
    expect(line).toBe(linePx / 22);
    host.updateStyle("lineHeight", "var(--text-heading-lg--line-height)");
    expect(visual().lineHeight).toBe(line);
    host.previewStyle("fontSize", "var(--text-heading-xl)");
    const next = visual().lineHeight;
    host.updateStyle("fontSize", "var(--text-heading-xl)");
    expect(visual().lineHeight).toBe(next);
  });
});
