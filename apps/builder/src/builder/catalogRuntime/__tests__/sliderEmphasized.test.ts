// @vitest-environment jsdom
/**
 * S2 1.8.0 Slider `isEmphasized` (2026-10-10, 조사 문서 목록 D): the filled track is neutral
 * (S2 `gray-700`), accent when emphasized (S2 `accent-900`) — as our Checkbox · Switch selected
 * paint (neutral · accent). The thumb follows the same pair (our thumb is a filled dot). DOM: the
 * Slider's `data-emphasized`, its SliderFill's `data-variant` (the SliderFill sheet); Canvas: the
 * SliderFill · SliderThumb rules' `emphasized` variant (derived from the Slider).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

const OWNER = "project:node:slider" as NodeId;
const STYLES = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated",
);

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:slider-emphasized" as const,
        name: "Slider emphasized",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `slider-emphasized-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "Slider");
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
  const slider = records.find((item) => item.sourceId === OWNER)!;
  const part = (type: string) =>
    records.find((item) => root.typeOf(item) === type)!;
  const html = renderToStaticMarkup(renderCatalogDom(root, slider.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  type Painted = {
    box?: { fillColor?: Record<string, number> };
    children?: Painted[];
  };
  /** The color the Canvas fills the part with (the thumb's dot is its first shape). */
  const paint = (type: string) => {
    const node = getSkiaNode(part(type).id) as unknown as Painted;
    const color = (
      type === "SliderThumb" ? node.children![0]! : node
    ).box!.fillColor!;
    return [color[0], color[1], color[2]].map((value) =>
      Math.round(value * 255),
    );
  };
  const painted = { fill: paint("SliderFill"), thumb: paint("SliderThumb") };
  canvas.dispose();
  return { definitionId, html, painted };
}

const isNeutral = ([r, g, b]: number[]) =>
  Math.max(r, g, b) - Math.min(r, g, b) <= 8;

describe("S2 Slider isEmphasized", () => {
  it("the Design panel offers Emphasized", async () => {
    const { definitionId } = await open({});
    expect(
      catalogSemanticContracts(definitionId, "Slider").isEmphasized,
    ).toMatchObject({ kind: "boolean" });
  });

  it("default: neutral fill and thumb on the Canvas · no emphasis in the DOM", async () => {
    const { html, painted } = await open({});
    expect(html).not.toContain("data-emphasized");
    expect(html).not.toContain('data-variant="emphasized"');
    expect(isNeutral(painted.fill)).toBe(true);
    expect(painted.thumb).toEqual(painted.fill);
  });

  it("emphasized: accent fill and thumb on the Canvas · the DOM's emphasis attributes", async () => {
    const plain = await open({});
    const { html, painted } = await open({ isEmphasized: true });
    expect(html).toContain('data-emphasized="true"');
    expect(html).toMatch(
      /class="react-aria-SliderFill"[^>]*data-variant="emphasized"|data-variant="emphasized"[^>]*class="react-aria-SliderFill"/,
    );
    expect(isNeutral(painted.fill)).toBe(false);
    expect(painted.fill).not.toEqual(plain.painted.fill);
    expect(painted.thumb).toEqual(painted.fill);
  });

  it("the sheets paint the same pair: neutral (--fg) · accent", () => {
    const fill = readFileSync(`${STYLES}/SliderFill.css`, "utf8");
    expect(fill).toMatch(
      /\.react-aria-SliderFill \{[^}]*background: var\(--fg\)/,
    );
    expect(fill).toMatch(
      /\.react-aria-SliderFill\[data-variant="emphasized"\] \{[^}]*background: var\(--accent\)/,
    );
    const slider = readFileSync(`${STYLES}/Slider.css`, "utf8");
    expect(slider).toMatch(
      /\.react-aria-SliderThumb \{[^}]*background: var\(--fg\)/,
    );
    expect(slider).toMatch(
      /\[data-emphasized\] \.react-aria-SliderThumb \{[^}]*background: var\(--accent\)/,
    );
  });
});
