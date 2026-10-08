import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import type {
  CatalogDocument,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspace } from "../workspace";
import { catalogStyleView, catalogStyleWritesOf } from "../styleFields";
import { catalogTextMeasure } from "../textMeasure";
import { CatalogStorage } from "../storage";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-6-31: the Styles panel's Text behavior presets write `overflowWrap` and
 * `textOverflow` as typed visual fields (사용자 승인 2026-10-01). `overflow-wrap` is inherited
 * (a text leaf takes its ancestor's), `text-overflow` is the box's own; the Canvas paragraph and
 * the DOM style get the same values, and the layout measure wraps a long word at the box width.
 */
// jsdom has no Canvas 2D (widths are 0): record what the measure's fallback wrap leg receives.
const wrapCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock("../../workspace/canvas/layout/engines/utils", async (original) => {
  const actual =
    await original<
      typeof import("../../workspace/canvas/layout/engines/utils")
    >();
  return {
    ...actual,
    measureTextWithWhiteSpace: (
      ...args: Parameters<typeof actual.measureTextWithWhiteSpace>
    ) => {
      wrapCalls.push(args);
      return actual.measureTextWithWhiteSpace(...args);
    },
  };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const set = <T,>(value: T) => ({ kind: "set" as const, value });
const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

async function scene() {
  const projectId = "project:project:text-behavior" as const;
  const frame = node("frame", "lib:definition:frame", {
    children: ["project:node:inherits", "project:node:owns"],
    visual: { overflowWrap: set("break-word") },
    sizing: { width: set(400) },
  });
  const inherits = node("inherits", "lib:definition:text", {
    props: { children: set("hello") },
  });
  const owns = node("owns", "lib:definition:text", {
    props: { children: set("world") },
    visual: {
      whiteSpace: set("nowrap"),
      textOverflow: set("ellipsis"),
      overflow: set("hidden"),
    },
    sizing: { width: set(40) },
  });
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 19,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "text-behavior",
        pageIds: ["project:page:main"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:main": {
        kind: "page",
        id: "project:page:main",
        name: "Main",
        route: "/",
        children: [frame.id],
      },
      [frame.id]: frame,
      [inherits.id]: inherits,
      [owns.id]: owns,
    },
  };
  const graph = new CatalogGraph(document, createPencilFixtureLibrary());
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, "adr248-phase4e-text-behavior"),
  );
  const root = new CatalogCompositionRoot(runtime, await nodeLayoutEngine(), {
    width: 1440,
    height: 900,
  });
  const inputId = (sourceId: string) =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === sourceId)!
      .id;
  return {
    root,
    frameId: inputId(frame.id),
    inheritsId: inputId(inherits.id),
    ownsId: inputId(owns.id),
    frameSource: frame.id,
  };
}

describe("ADR-248 Phase 4e-6-31 text behavior", () => {
  it("maps the presets' CSS keys to typed fields and reads them back", () => {
    // The Truncate preset (an empty value clears the field).
    const writes = catalogStyleWritesOf({
      whiteSpace: "nowrap",
      wordBreak: "",
      overflowWrap: "",
      textOverflow: "ellipsis",
      overflow: "hidden",
    });
    expect(writes.visual).toMatchObject({
      overflowWrap: { kind: "remove" },
      textOverflow: set("ellipsis"),
    });
    expect(
      catalogStyleView({
        visual: { overflowWrap: "break-word", textOverflow: "ellipsis" },
        layout: {},
        sizing: {},
      }),
    ).toMatchObject({ overflowWrap: "break-word", textOverflow: "ellipsis" });
  });

  it("paints inherited overflow-wrap and own text-overflow the same on Canvas and DOM", async () => {
    const { root, frameId, inheritsId, ownsId } = await scene();
    expect(root.canvasInputs.get(inheritsId)?.inheritedText).toEqual({
      overflowWrap: "break-word",
    });
    // text-overflow is not inherited.
    expect(root.canvasInputs.get(ownsId)?.inheritedText).toEqual({
      overflowWrap: "break-word",
    });
    const canvas = bindCatalogCanvas(root, [frameId]);
    const host = document.createElement("div");
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, frameId)));
    const domOf = (id: string) =>
      host.querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!.style;

    expect(getSkiaNode(inheritsId)!.text).toMatchObject({
      overflowWrap: "break-word",
    });
    expect(getSkiaNode(inheritsId)!.text!.textOverflow).toBeUndefined();
    expect(domOf(inheritsId).overflowWrap).toBe("break-word");
    expect(domOf(inheritsId).textOverflow).toBe("");

    expect(getSkiaNode(ownsId)!.text).toMatchObject({
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      clipText: true,
    });
    expect(domOf(ownsId)).toMatchObject({
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden",
    });
    // The container itself carries no text style inline.
    expect(domOf(frameId).overflowWrap).toBe("");
    canvas.dispose();
    await act(async () => reactRoot.unmount());
  });

  it("the layout measure wraps with the text's overflow-wrap and word-break", () => {
    // The CanvasKit paragraph leg (live) wraps a long word at the box width instead of at
    // min-content; the Canvas 2D fallback leg takes both keys.
    const font = { fontSize: 16, fontWeight: 400, lineHeight: 1.5 };
    wrapCalls.length = 0;
    catalogTextMeasure("abc", { ...font, overflowWrap: "anywhere" }, 40);
    catalogTextMeasure("abc", { ...font, wordBreak: "break-word" }, 40);
    catalogTextMeasure("abc", { ...font, wordBreak: "keep-all" }, 40);
    expect(wrapCalls.map((args) => [args[6], args[7]])).toEqual([
      [undefined, "anywhere"],
      ["break-word", "break-word"],
      ["keep-all", undefined],
    ]);
  });

  it("the layout wraps a long word at the box width under break-word and drops a stale wrap", async () => {
    // A 10px-per-character measure: words break at spaces, and inside a word only when the font
    // may break words.
    const measure: CatalogTextMeasure = (text, font, maxWidth) => {
      const line = font.fontSize * font.lineHeight;
      const words = text.split(" ");
      if (maxWidth === undefined)
        return {
          width: text.length * 10,
          exactWidth: text.length * 10,
          minWidth: Math.max(...words.map((word) => word.length)) * 10,
          height: line,
        };
      const perLine = Math.max(1, Math.floor(maxWidth / 10));
      const breaks = font.overflowWrap === "break-word";
      let lines = 1;
      let used = 0;
      for (const word of words) {
        const need = used ? used + 1 + word.length : word.length;
        if (need <= perLine) used = need;
        else if (breaks && word.length > perLine) {
          lines += used ? 1 : 0;
          lines += Math.ceil(word.length / perLine) - 1;
          used = word.length % perLine || perLine;
        } else if (used) {
          lines += 1;
          used = word.length;
        } else used = word.length;
      }
      return { width: maxWidth, height: lines * line };
    };
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:wrap" as const,
          name: "Wrap",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-phase4e-wrap-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
        textMeasure: measure,
      },
    );
    const text = (id: string, value: string): NodeEntry => ({
      kind: "node",
      id: `project:node:${id}`,
      definitionId: "lib:definition:text",
      children: [],
      props: { children: set(value) },
      visual: { fontSize: set(10), lineHeight: set(2) },
      sizing: { width: set(90) },
      descendantOverrides: [],
    });
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          text("long", "abcdefghijklmnopqrst"),
          text("sentence", "aaaa bbbb cccc dddd"),
        ],
        rootIds: ["project:node:long", "project:node:sentence"],
        newId: workspace.newId,
      }),
    );
    const record = (id: string) =>
      workspace.root.recordsOfSource(`project:node:${id}`)[0];
    const height = (id: string) =>
      workspace.root.getLayoutInput(record(id))?.contentHeight;
    const apply = (id: string, styles: Record<string, string>) =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: `project:node:${id}` }],
          ...catalogStyleWritesOf(styles),
        } as Parameters<typeof setFields>[0]),
      );

    // A lone word wider than the box overflows on one line …
    expect(workspace.root.textWraps(record("long"))).toBe(false);
    expect(height("long")).toBe(20);
    // … and breaks at the box width (9 characters a line → 3 lines) under break-word.
    apply("long", { overflowWrap: "break-word" });
    expect(workspace.root.textWraps(record("long"))).toBe(true);
    expect(height("long")).toBe(60);

    // A wrapped sentence that becomes single-line (No Wrap / Truncate) is one line box again.
    expect(height("sentence")).toBe(40);
    apply("sentence", {
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      overflow: "hidden",
    });
    expect(workspace.root.textWraps(record("sentence"))).toBe(false);
    expect(height("sentence")).toBe(20);
  });
});
