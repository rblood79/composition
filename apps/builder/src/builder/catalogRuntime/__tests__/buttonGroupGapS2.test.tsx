// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 ButtonGroup gap (`ButtonGroup.tsx` `buttongroup` — S 8 · M · L · XL 12; XS, not in S2, as S):
 * the size's gap on the Canvas (`manualBoxRules.ts` — the size's conditional visual) and in the DOM
 * (the `buttongroup` renderer, the same table) — an authored gap wins on both (2026-11-18 — before, the origin
 * template's fixed 8 drew every size at 8).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:group" as NodeId;

async function place() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:gap" as EntryId<"project">,
        name: "Gap",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `gap-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, "ButtonGroup"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as unknown as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const group = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === ROOT)!;
  const canvasGap = () => {
    const [a, b] = group().children;
    const rects = root.getGeometry([a!, b!]);
    return rects.get(b!)!.x - (rects.get(a!)!.x + rects.get(a!)!.width);
  };
  const domGap = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id = [...root.domInputs.values()].find(
      (r) => r.sourceId === ROOT,
    )!.id;
    await act(async () => reactRoot.render(renderCatalogDom(root, id)));
    const el = host.querySelector<HTMLElement>('[role="group"]')!;
    const gap = el.style.columnGap;
    await act(async () => reactRoot.unmount());
    host.remove();
    return gap;
  };
  const set = (input: Record<string, unknown>) =>
    workspace.execute(
      setFields({ targets: [{ kind: "node", id: ROOT }], ...input }),
    );
  return { canvasGap, domGap, set };
}

describe("S2 ButtonGroup gap (2026-11-18)", () => {
  it("M 12 · S 8 · XS 8 · XL 12 on both; an authored gap wins", async () => {
    const { canvasGap, domGap, set } = await place();
    expect([canvasGap(), await domGap()]).toEqual([12, "12px"]);
    for (const [size, gap] of [
      ["S", 8],
      ["XS", 8],
      ["XL", 12],
    ] as const) {
      set({ props: { size: { kind: "set", value: size } } });
      expect([size, canvasGap(), await domGap()]).toEqual([
        size,
        gap,
        `${gap}px`,
      ]);
    }
    set({ visual: { gap: { kind: "set", value: 20 } } });
    expect([canvasGap(), await domGap()]).toEqual([20, "20px"]);
  });
});
