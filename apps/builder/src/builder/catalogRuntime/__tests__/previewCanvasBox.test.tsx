// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
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
 * 2026-10-09 (사용자 「의심된 Preview class · data-size 누락 먼저 확인하고 수정」): the suspected
 * missing classes changed nothing (those types' generated sheets are not in the Preview — the
 * renderers inline their box), but the same live comparison found two boxes the Canvas and the
 * Preview drew differently: an IllustratedMessage's height (Canvas 48 — its padding only; Preview
 * 240) and a StatusLight's width (Canvas fit 75; Preview the parent's 1920 — `display: flex`).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

async function open(type: string, props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:box" as EntryId<"project">,
        name: "Box",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `box-${Math.random()}`),
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
          // (A type outside the palette — the Illustration — by its type definition.)
          definitionId:
            type === "Illustration"
              ? catalogTypeDefinitionId(type)
              : catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.canvasInputs.values()].find(
    (r) => r.sourceId === ROOT,
  )!;
  return { root, record };
}

describe("Canvas box = Preview box", () => {
  it("StatusLight: the Preview box is inline (the rule's `inline-flex` — fit, as the Canvas)", async () => {
    const { root, record } = await open("StatusLight");
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id = [...root.domInputs.values()].find(
      (r) => r.sourceId === ROOT,
    )!.id;
    await act(async () => reactRoot.render(renderCatalogDom(root, id)));
    const el = host.querySelector<HTMLElement>(
      `[data-catalog-id="${id}"]`,
    )!;
    expect(el.style.display).toBe("inline-flex");
    expect(root.getGeometry([record.id]).get(record.id)!.width).toBeLessThan(
      200,
    );
    await act(async () => reactRoot.unmount());
    host.remove();
  });

  // 2026-10-09 (사용자 「IllustratedMessage 제목 · 설명 노드 전환」 → 「(a) 로 진행」): the S2
  // Illustration — S 48 · M 96 · L 160 (`@react-spectrum/s2/src/Icon.tsx` `illustrationStyles`).
  it.each([
    ["S", 48],
    ["M", 96],
    ["L", 160],
  ])(
    "Illustration %s: the Canvas glyph box = the Preview svg (%ipx)",
    async (size, px) => {
      const { root, record } = await open("Illustration", { size });
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
      const host = document.body.appendChild(document.createElement("div"));
      const reactRoot = createRoot(host);
      const id = [...root.domInputs.values()].find(
        (r) => r.sourceId === ROOT,
      )!.id;
      await act(async () => reactRoot.render(renderCatalogDom(root, id)));
      const svg = host.querySelector("svg")!;
      expect(svg.getAttribute("width")).toBe(String(px));
      // (Its box, not the Icon sheet's 24px `.react-aria-Icon` height.)
      expect(
        host.querySelector<HTMLElement>(".react-aria-Illustration")?.style
          .height,
      ).toBe(`${px}px`);
      const geometry = root.getGeometry([record.id]).get(record.id)!;
      expect([geometry.width, geometry.height]).toEqual([px, px]);
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  );
});
