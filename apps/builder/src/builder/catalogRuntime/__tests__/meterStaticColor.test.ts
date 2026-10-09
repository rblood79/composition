// @vitest-environment jsdom
/**
 * S2 1.8.0 Meter · ProgressBar `staticColor` (2026-10-10, 조사 문서 목록 D · 사용자 「Static Color 일
 * 때 S2와 동일하게」): over a color background S2 paints both bars with one scheme (`bar-utils.ts`
 * `track` · `fillStyles` · `fieldLabel`) — the track `transparent-overlay-300` (the static color at
 * 0.17), the fill `transparent-overlay-900` (0.94 — the variant is not read), the label and the value
 * text `transparent-overlay-1000` (the static color). DOM: the root's `data-static-color` and the
 * manual `ProgressBar.css`; Canvas: the parts take the owner's `staticColor` (`presence.ts`) and the
 * rules' `staticAlpha` (`resolveCatalogPaint`).
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

const OWNER = "project:node:bar" as NodeId;
const SHEET = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/ProgressBar.css",
);
const PARTS = {
  Meter: { track: "MeterTrack", fill: "MeterFill", value: "MeterValue" },
  ProgressBar: {
    track: "ProgressBarTrack",
    fill: "ProgressBarFill",
    value: "ProgressBarValue",
  },
} as const;

type Painted = {
  box?: { fillColor?: Record<string, number> };
  text?: { color?: Record<string, number> };
  children?: Painted[];
};
const rgba = (color: Record<string, number> | undefined) =>
  color
    ? [
        ...[color[0], color[1], color[2]].map((value) =>
          Math.round(value! * 255),
        ),
        Math.round(color[3]! * 100) / 100,
      ]
    : undefined;
/** The first text color painted in a node's subtree. */
const textColor = (node: Painted | undefined): number[] | undefined => {
  if (!node) return undefined;
  if (node.text?.color) return rgba(node.text.color);
  for (const child of node.children ?? []) {
    const found = textColor(child);
    if (found) return found;
  }
  return undefined;
};

async function open(type: keyof typeof PARTS, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:bar-static" as const,
        name: "Bar static color",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `bar-static-${Math.random()}`),
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
            Object.entries({ label: "Storage", ...props }).map(
              ([key, value]) => [key, { kind: "set", value }],
            ),
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
  const records = [...root.canvasInputs.values()];
  const owner = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const tag =
    new RegExp(`<div[^>]*class="react-aria-${type}"[^>]*>`).exec(
      renderToStaticMarkup(renderCatalogDom(root, owner.id)),
    )?.[0] ?? "";
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const node = (partType: string) =>
    getSkiaNode(
      records.find((item) => root.typeOf(item) === partType)!.id,
    ) as unknown as Painted;
  const shown = {
    tag,
    track: rgba(node(PARTS[type].track).box?.fillColor),
    fill: rgba(node(PARTS[type].fill).box?.fillColor),
    label: textColor(node("Label")),
    value: textColor(node(PARTS[type].value)),
  };
  canvas.dispose();
  return { definitionId, ...shown };
}

for (const type of ["Meter", "ProgressBar"] as const)
  describe(`S2 ${type} staticColor`, () => {
    it("the Design panel offers Static Color (auto · white · black)", async () => {
      const { definitionId } = await open(type, {});
      const contract = catalogSemanticContracts(definitionId, type)
        .staticColor as { kind: string; options?: Array<{ value: string }> };
      expect(contract).toMatchObject({ kind: "enum" });
      expect(contract.options?.map((option) => option.value)).toEqual([
        "auto",
        "white",
        "black",
      ]);
    });

    it("auto: no static attribute · the variant fill · the theme text", async () => {
      const shown = await open(type, {});
      expect(shown.tag).not.toContain("data-static-color");
      expect(shown.fill?.slice(0, 3)).not.toEqual([255, 255, 255]);
      expect(shown.label?.slice(0, 3)).not.toEqual([255, 255, 255]);
    });

    for (const [color, rgb] of [
      ["white", [255, 255, 255]],
      ["black", [0, 0, 0]],
    ] as const)
      it(`${color}: S2's track 17% · fill 94% · label and value in the static color`, async () => {
        const shown = await open(type, {
          staticColor: color,
          showValueLabel: true,
          ...(type === "Meter" ? { variant: "positive" } : {}),
        });
        expect(shown.tag).toContain(`data-static-color="${color}"`);
        expect(shown.track).toEqual([...rgb, 0.17]);
        expect(shown.fill).toEqual([...rgb, 0.94]);
        expect(shown.label).toEqual([...rgb, 1]);
        expect(shown.value).toEqual([...rgb, 1]);
      });
  });

describe("the sheet", () => {
  it("gives a static Meter · ProgressBar S2's track · fill · text", () => {
    const sheet = readFileSync(SHEET, "utf8");
    for (const [color, rgb] of [
      ["white", "255 255 255"],
      ["black", "0 0 0"],
    ]) {
      const at = (alpha: string) =>
        `rgb\\(${rgb} \\/ ${alpha.replace(".", "\\.")}\\)`;
      for (const type of ["ProgressBar", "Meter"])
        expect(sheet).toMatch(
          new RegExp(
            `\\.react-aria-${type}\\[data-static-color="${color}"\\] \\{\\s*--fill-color: ${at("0.94")};`,
          ),
        );
      expect(sheet).toMatch(
        new RegExp(
          `\\.react-aria-ProgressBar\\[data-static-color="${color}"\\] \\{[^}]*--track-color: ${at("0.17")};`,
        ),
      );
      expect(sheet).toMatch(
        new RegExp(
          `\\.react-aria-Meter\\[data-static-color="${color}"\\] \\.bar \\{\\s*background: ${at("0.17")};`,
        ),
      );
      for (const type of ["ProgressBar", "Meter"])
        expect(sheet).toMatch(
          new RegExp(
            `\\.react-aria-${type}\\[data-static-color="${color}"\\] :is\\(\\.react-aria-Label, \\.value\\) \\{\\s*color: rgb\\(${rgb}\\);`,
          ),
        );
    }
  });
});
