// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「IllustratedMessage 제목 · 설명 노드 전환」 → 「레퍼런스에 맞게」 → 「(a) 로
 * 진행해, orientation 도 같이 넣어」): the S2 IllustratedMessage (`@react-spectrum/s2/src/
 * IllustratedMessage.tsx`) is `IllustratedMessage > Illustration + Heading + Content` — no padding,
 * no box. Vertical: centred, illustration → heading 12 (L 8), heading → content 4, max width 380.
 * Horizontal: the illustration left of the heading and content (gap 12), max width 528. The
 * illustration is M (96) for S · M and L (160) for L; the heading `title` 16 · `title-xl` 20 ·
 * `title-2xl` 22 (the Heading's 16 · 20 · 24); the content `body-xs` 12 · `body-sm` 14 · 14.
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;

async function open(props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:im" as EntryId<"project">,
        name: "IllustratedMessage",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `im-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(
            library,
            "IllustratedMessage",
          ),
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
  const records = [...root.canvasInputs.values()];
  const message = records.find((r) => root.typeOf(r) === "IllustratedMessage")!;
  const child = (type: string) =>
    records.find((r) => r.parentId === message.id && root.typeOf(r) === type)!;
  const rect = (id: string) => root.getGeometry([id]).get(id)!;
  return { root, message, child, rect };
}

describe("IllustratedMessage — the S2 node tree", () => {
  it("is IllustratedMessage > Illustration + Heading + Description (the origin's title · description)", async () => {
    const { root, message } = await open();
    const records = [...root.canvasInputs.values()];
    const kids = records.filter((r) => r.parentId === message.id);
    expect(kids.map((r) => root.typeOf(r))).toEqual([
      "Illustration",
      "Heading",
      "Description",
    ]);
    expect(kids.map((r) => r.props.children ?? r.props.iconName)).toEqual([
      "image",
      "No results",
      "Try another search term.",
    ]);
  });

  it.each([
    ["sm", 96, 16, 12, 12],
    ["md", 96, 20, 14, 12],
    ["lg", 160, 24, 14, 8],
  ])(
    "vertical %s: illustration %i · heading %ipx · content %ipx, centred, gaps %i / 4",
    async (size, picture, heading, content, gap) => {
      const { message, child, rect } = await open({ size });
      const illustration = rect(child("Illustration").id);
      const title = rect(child("Heading").id);
      const description = rect(child("Description").id);
      const box = rect(message.id);
      expect([illustration.width, illustration.height]).toEqual([
        picture,
        picture,
      ]);
      expect(child("Heading").visual.fontSize).toBe(heading);
      expect(child("Description").visual.fontSize).toBe(content);
      // No padding: the picture is at the top; every part is centred; max width 380.
      expect(illustration.y).toBe(box.y);
      expect(box.width).toBe(380);
      for (const part of [illustration, title, description])
        expect(
          Math.abs(part.x + part.width / 2 - (box.x + box.width / 2)),
        ).toBeLessThanOrEqual(1);
      expect(title.y - (illustration.y + illustration.height)).toBe(gap);
      expect(description.y - (title.y + title.height)).toBe(4);
    },
  );

  it("horizontal: the illustration left of the heading and content (gap 12), max width 528", async () => {
    const { message, child, rect } = await open({ orientation: "horizontal" });
    const box = rect(message.id);
    const illustration = rect(child("Illustration").id);
    const title = rect(child("Heading").id);
    const description = rect(child("Description").id);
    expect(box.width).toBe(528);
    // The picture spans both `1fr` rows: (96 − 4) / 2 each — the box is the picture's height.
    expect([box.height, illustration.y]).toEqual([96, box.y]);
    expect(illustration.x).toBe(box.x);
    expect(title.x).toBeGreaterThanOrEqual(
      illustration.x + illustration.width + 12,
    );
    expect(description.x).toBe(title.x);
    expect(description.y - (title.y + title.height)).toBe(4);
    // The heading sits on the middle line (S2: heading `alignSelf: end`, content `start`).
    expect(title.y + title.height + 2).toBeCloseTo(
      illustration.y + illustration.height / 2,
      0,
    );
  });

  it.each(["vertical", "horizontal"])(
    "Canvas %s: paints the picture glyph and the centred / start-aligned text",
    async (orientation) => {
      const { root, child } = await open({ orientation });
      const binding = bindCatalogCanvas(root, root.pageRootRecords());
      const picture = getSkiaNode(child("Illustration").id);
      const heading = getSkiaNode(child("Heading").id);
      const description = getSkiaNode(child("Description").id);
      binding.dispose();
      expect(picture).toBeDefined();
      const align = orientation === "vertical" ? "center" : undefined;
      expect(heading?.text?.align).toBe(align);
      expect(description?.text?.align).toBe(align);
    },
  );

  it("Preview: the S2 parts in order — svg, heading, description — under the rule's box", async () => {
    const { root, message } = await open({ orientation: "horizontal" });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id = [...root.domInputs.values()].find(
      (r) => r.sourceId === message.sourceId,
    )!.id;
    await act(async () => reactRoot.render(renderCatalogDom(root, id)));
    const el = host.querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!;
    expect(el.className).toBe("react-aria-IllustratedMessage");
    expect(el.dataset.size).toBe("md");
    expect(el.dataset.orientation).toBe("horizontal");
    const [picture, heading, description] = [...el.children] as HTMLElement[];
    expect(picture.classList.contains("react-aria-Illustration")).toBe(true);
    expect(picture.querySelector("svg")?.getAttribute("width")).toBe("96");
    expect(heading.textContent).toBe("No results");
    expect(heading.style.textAlign).toBe("start");
    expect(description.getAttribute("slot")).toBe("description");
    expect(description.textContent).toBe("Try another search term.");
    await act(async () => reactRoot.unmount());
    host.remove();
  });
});
