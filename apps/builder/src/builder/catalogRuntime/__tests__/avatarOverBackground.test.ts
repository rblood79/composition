// @vitest-environment jsdom
/**
 * S2 1.8.0 Avatar `isOverBackground` (2026-10-10, 조사 문서 목록 D): a solid outline in the
 * background color around the circle (1px; S2 2px over 64px) — the DOM's `outline`, the Canvas
 * `avatar` primitive's ring outside the circle. The AvatarGroup origin's avatars have it (S2
 * `AvatarGroup` gives its avatars `isOverBackground`).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:avatar" as NodeId;

type Painted = {
  width?: number;
  box?: {
    fillColor?: Record<string, number>;
    strokeColor?: Record<string, number>;
    strokeWidth?: number;
  };
  children?: Painted[];
};

async function open(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:avatar-over" as const,
        name: "Avatar over background",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `avatar-over-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, type);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId,
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
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = [...root.domInputs.values()];
  const owner = records.find((item) => item.sourceId === OWNER)!;
  const avatars = records.filter((item) => root.typeOf(item) === "Avatar");
  const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  /** The ring the Canvas strokes around each avatar (a stroked child shape), if any. */
  const rings = avatars.map((avatar) => {
    const node = getSkiaNode(avatar.id) as unknown as Painted;
    const ring = (node.children ?? []).find(
      (child) => (child.box?.strokeWidth ?? 0) > 0,
    );
    return ring
      ? {
          width: ring.box!.strokeWidth!,
          color: [0, 1, 2].map((index) =>
            Math.round(ring.box!.strokeColor![index]! * 255),
          ),
          outer: ring.width,
          diameter: node.width,
        }
      : undefined;
  });
  canvas.dispose();
  return { definitionId, html, rings };
}

describe("S2 Avatar isOverBackground", () => {
  it("the Design panel offers Over Background", async () => {
    const { definitionId } = await open("Avatar", {});
    expect(
      catalogSemanticContracts(definitionId, "Avatar").isOverBackground,
    ).toMatchObject({ kind: "boolean" });
  });

  it("off: no outline on either side", async () => {
    const { html, rings } = await open("Avatar", {});
    expect(html).not.toContain("outline");
    expect(rings).toEqual([undefined]);
  });

  it("on: the DOM's 1px background outline · the Canvas ring outside the circle", async () => {
    const { html, rings } = await open("Avatar", { isOverBackground: true });
    expect(html).toContain("outline:1px solid var(--bg)");
    const [ring] = rings;
    expect(ring).toBeDefined();
    expect(ring!.width).toBe(1);
    // (the page background — white in the light theme)
    expect(ring!.color).toEqual([255, 255, 255]);
    // (outside the circle: its stroke's middle is half a pixel past the edge)
    expect(ring!.outer).toBe(ring!.diameter! + 1);
  });

  it("the AvatarGroup's avatars are over background (S2 AvatarGroup)", async () => {
    const { html, rings } = await open("AvatarGroup", {});
    expect(html.match(/outline:1px solid var\(--bg\)/g)?.length).toBe(3);
    expect(rings.every((ring) => ring?.width === 1)).toBe(true);
  });
});
