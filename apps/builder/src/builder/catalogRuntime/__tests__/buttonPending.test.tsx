// @vitest-environment jsdom
/**
 * S2 1.8 Button `isPending` (`Button.tsx` `usePendingState` · the pending ProgressCircle): a pending
 * button keeps its box, hides its label and icon, and shows an indeterminate circle at its centre —
 * the DOM after S2's one-second delay, the Canvas at once (`buttonPending.ts`). Before 2026-10-14 the
 * prop reached neither consumer: the DOM binding did not pass it, and no rule drew it (memory
 * `project-button-ispending-visual-deferred-after-adr248`).
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  CATALOG_BUTTON_PENDING_DELAY_MS,
  catalogButtonPendingIndicator,
} from "../../../../../../packages/shared/src/catalog/document/buttonPending";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BUTTON = "project:node:button" as NodeId;
const ICON = "project:node:icon" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:button-pending" as const,
        name: "Button pending",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `button-pending-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      // (ADR-276: the label is a Text child — measured like `mixedButtonText`.)
      textMeasure: (text, font, available) => {
        const width = (text.length * font.fontSize) / 2;
        const minWidth = Math.max(
          ...text.split(" ").map((word) => (word.length * font.fontSize) / 2),
        );
        return {
          width,
          exactWidth: width,
          minWidth,
          height:
            font.fontSize *
            font.lineHeight *
            (available !== undefined && available < width - 0.5 ? 2 : 1),
        };
      },
    },
  );
  const entry = (
    id: NodeId,
    type: string,
    nodeProps: Record<string, unknown>,
  ): NodeEntry =>
    ({
      kind: "node",
      id,
      definitionId: catalogPaletteDefinitionId(library, type),
      children: [],
      props: Object.fromEntries(
        Object.entries(nodeProps).map(([key, value]) => [key, set(value)]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [entry(BUTTON, "Button", props)],
      rootIds: [BUTTON],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BUTTON },
      entries: [entry(ICON, "Icon", { iconName: "check" })],
      rootIds: [ICON],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = (sourceId: NodeId) =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === sourceId)!;
  /** The Canvas node data of a record (`bindCatalogCanvas` → the Skia registry). */
  const painted = (sourceId: NodeId) => {
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const data = getSkiaNode(record(sourceId).id) as unknown as {
      visible: boolean;
      text?: { content: string; color: Float32Array };
      children?: Array<{
        x: number;
        y: number;
        width: number;
        arc?: {
          cx: number;
          cy: number;
          radius: number;
          sweepAngle: number;
          strokeWidth: number;
          strokeColor: Float32Array;
        };
      }>;
    };
    canvas.dispose();
    return data;
  };
  const box = (sourceId: NodeId) =>
    root.getGeometry([record(sourceId).id]).get(record(sourceId).id)!;
  const label = () => record("lib:template:component-button__label" as NodeId);
  return { workspace, root, record, painted, box, label };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
});
async function mount(workspace: CatalogWorkspace, id: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const reactRoot = createRoot(host);
  await act(async () => reactRoot.render(renderCatalogDom(workspace.root, id)));
  unmount = async () => act(async () => reactRoot.unmount());
  return host;
}
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

describe("S2 Button isPending", () => {
  it("Canvas: a pending button hides its label and draws the indeterminate circle at its centre", async () => {
    const { workspace, painted, record, box, label } = await open({
      label: "Save",
      size: "L",
      isPending: true,
    });
    const { diameter, strokeWidth, trackAlpha } =
      catalogButtonPendingIndicator("L");
    expect(diameter).toBe(20);
    const rect = box(BUTTON);
    const pending = painted(BUTTON);
    // No label text while pending — the box keeps the label's size (ADR-276: the label is the
    // Button's Text child; it draws no words while its button pends).
    expect(pending.text?.content).toBe("");
    expect(
      (painted(label().sourceId as NodeId) as unknown as { visible: boolean })
        .visible,
    ).toBe(false);
    expect(rect.width).toBeGreaterThan(diameter);
    const arcs = (pending.children ?? []).filter((child) => child.arc);
    expect(arcs.map((a) => [a.arc!.sweepAngle, a.arc!.strokeColor[3]])).toEqual(
      [
        [360, expect.closeTo(trackAlpha, 5)],
        [270, 1],
      ],
    );
    for (const a of arcs) {
      expect([a.x, a.y, a.width]).toEqual([
        (rect.width - diameter) / 2,
        (rect.height - diameter) / 2,
        diameter,
      ]);
      expect(a.arc).toMatchObject({
        cx: diameter / 2,
        cy: diameter / 2,
        radius: diameter / 2 - strokeWidth / 2,
        strokeWidth,
      });
      // (The label's color.)
      expect([...a.arc!.strokeColor.slice(0, 3)]).toEqual([
        ...pending.text!.color.slice(0, 3),
      ]);
    }
    // Its Icon child stays laid out but is not painted (`_pendingHidden`).
    expect(record(ICON).derivedProps?._pendingHidden).toBe(true);
    expect(painted(ICON).visible).toBe(false);
    // Off again: the label is back, no circle, the icon paints.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BUTTON }],
        props: { isPending: set(false) },
      }),
    );
    const rest = painted(BUTTON);
    expect(rest.text?.content).toBe("");
    const words = painted(label().sourceId as NodeId) as unknown as {
      visible: boolean;
      text?: { content: string };
    };
    expect(words.visible).toBe(true);
    expect(words.text?.content).toBe("Save");
    expect((rest.children ?? []).some((child) => child.arc)).toBe(false);
    expect(record(ICON).derivedProps?._pendingHidden).toBeUndefined();
    expect(painted(ICON).visible).toBe(true);
  });

  it("DOM: RAC marks the pending button; after S2's delay the content hides and the circle shows", async () => {
    const { workspace, record } = await open({
      label: "Save",
      size: "M",
      isPending: true,
    });
    const host = await mount(workspace, record(BUTTON).id);
    const button = host.querySelector("button")!;
    expect(button.getAttribute("data-pending")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const circle = () =>
      button.querySelector('[role="progressbar"]') as HTMLElement | null;
    const content = () =>
      button.querySelector("[data-pending-content]") as HTMLElement | null;
    // Before the delay: the label shows, the circle is there but not visible (S2 `visibility`).
    expect(content()?.style.visibility).not.toBe("hidden");
    expect(circle()?.getAttribute("aria-label")).toBe("Pending");
    expect((circle()!.parentElement as HTMLElement).style.visibility).toBe(
      "hidden",
    );
    await wait(CATALOG_BUTTON_PENDING_DELAY_MS + 100);
    expect(content()?.style.visibility).toBe("hidden");
    expect((circle()!.parentElement as HTMLElement).style.visibility).toBe(
      "visible",
    );
    // The circle's box is the button's size's (S2 size M → 18) and takes the button's text color.
    expect(circle()!.style.width).toBe("18px");
    const [track, indicator] = [...circle()!.querySelectorAll("circle")];
    expect(indicator.getAttribute("data-indeterminate-arc")).toBe("");
    expect(indicator.getAttribute("stroke")).toBe("currentColor");
    expect(track.getAttribute("stroke")).toContain("currentColor");
    expect(button.style.position).toBe("relative");
  });

  it("DOM: a button that is not pending renders no circle", async () => {
    const { workspace, record } = await open({ label: "Save" });
    const host = await mount(workspace, record(BUTTON).id);
    const button = host.querySelector("button")!;
    expect(button.getAttribute("data-pending")).toBeNull();
    expect(button.querySelector('[role="progressbar"]')).toBeNull();
    expect(button.querySelector("[data-pending-content]")).toBeNull();
  });
});
