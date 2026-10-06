import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
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
import { renderCatalogDom } from "../domBinding";
import { CatalogStorage } from "../storage";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4a-3c: authored typography — a text leaf's own keys, else its nearest ancestor's
 * (CSS inherited properties) — reaches the Canvas paragraph and the DOM style as the same values,
 * and an ancestor edit re-derives only its subtree's text.
 */
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
  const projectId = "project:project:typography" as const;
  const frame = node("frame", "lib:definition:frame", {
    children: ["project:node:inherits", "project:node:owns"],
    visual: {
      fontFamily: set("Inter"),
      letterSpacing: set(1),
      textTransform: set("uppercase"),
    },
    sizing: { width: set(400) },
  });
  const inherits = node("inherits", "lib:definition:text", {
    props: { children: set("hello") },
  });
  const owns = node("owns", "lib:definition:text", {
    props: { children: set("world") },
    visual: { fontFamily: set("Menlo"), textAlign: set("center") },
    metadata: { htmlId: "greeting" },
  });
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 4,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "typography",
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
    new CatalogStorage(indexedDB, "adr248-phase4-typography"),
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

describe("ADR-248 Phase 4a-3c typography", () => {
  it("paints own and inherited typography identically on Canvas and DOM, and follows an ancestor edit", async () => {
    const { root, frameId, inheritsId, ownsId, frameSource } = await scene();
    expect(root.canvasInputs.get(inheritsId)?.inheritedText).toEqual({
      fontFamily: "Inter",
      letterSpacing: 1,
      textTransform: "uppercase",
    });
    const canvas = bindCatalogCanvas(root, [frameId]);
    const host = document.createElement("div");
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, frameId)));
    const domOf = (id: string) =>
      host.querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!.style;

    const inherited = getSkiaNode(inheritsId)!.text!;
    expect(inherited.content).toBe("HELLO");
    expect(inherited.fontFamilies).toEqual(["Inter", "Pretendard"]);
    expect(inherited.letterSpacing).toBe(1);
    expect(domOf(inheritsId)).toMatchObject({
      fontFamily: "Inter",
      letterSpacing: "1px",
      textTransform: "uppercase",
    });

    // Own values win over the inherited ones; other keys still inherit.
    const own = getSkiaNode(ownsId)!.text!;
    expect(own.fontFamilies).toEqual(["Menlo", "Pretendard"]);
    expect(own.align).toBe("center");
    expect(own.content).toBe("WORLD");
    expect(domOf(ownsId)).toMatchObject({
      fontFamily: "Menlo",
      textAlign: "center",
      textTransform: "uppercase",
    });
    // The author's DOM id (`metadata.htmlId`) is the element's id.
    expect(host.querySelector(`[data-catalog-id="${ownsId}"]`)!.id).toBe(
      "greeting",
    );
    // The container itself carries no typography inline (no second, cascaded source).
    expect(domOf(frameId).fontFamily).toBe("");

    await act(async () => {
      root.dispatch("letter spacing", [
        {
          kind: "patchNodeVisual",
          id: frameSource as NodeEntry["id"],
          key: "letterSpacing",
          write: set(2),
        },
      ]);
    });
    const update = canvas.update();
    expect(update.status).toBe("patched");
    expect(getSkiaNode(inheritsId)!.text!.letterSpacing).toBe(2);
    expect(domOf(inheritsId).letterSpacing).toBe("2px");
    expect(getSkiaNode(ownsId)!.text!.letterSpacing).toBe(2);
    canvas.dispose();
    await act(async () => reactRoot.unmount());
  });
});
