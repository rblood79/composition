// @vitest-environment jsdom
/**
 * S2 1.8.0 Meter `staticColor` (2026-10-10, 조사 문서 목록 D): over a color background the fill is
 * white · black (S2 `fillStyles` `isStaticColor` — the variant is not read) and the track a wash
 * of it — the ProgressBar's scheme (S2 Meter and ProgressBar share it). DOM: the root's
 * `data-static-color` and the manual sheet's `--fill-color` · `--track-color`; Canvas: the track ·
 * fill take the Meter's `staticColor` (`presence.ts`) and `resolveCatalogPaint` paints it.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogPaint } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:meter" as NodeId;
const SHEET = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/ProgressBar.css",
);

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:meter-static" as const,
        name: "Meter static color",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `meter-static-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(library, "Meter");
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
  const records = [...root.canvasInputs.values()];
  const owner = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const tag =
    /<div[^>]*class="react-aria-Meter"[^>]*>/.exec(
      renderToStaticMarkup(renderCatalogDom(root, owner.id)),
    )?.[0] ?? "";
  /** The Canvas paint of the Meter's track · fill (their rule, with the derived owner values). */
  const paint = (type: "MeterTrack" | "MeterFill") => {
    const record = records.find((item) => root.typeOf(item) === type)!;
    const rule = (
      COMPONENT_RULES_TABLE as Record<
        string,
        { variants: Record<string, unknown>; defaultVariant: string }
      >
    )[type]!;
    return {
      derived: record.derivedProps?.staticColor,
      ...resolveCatalogPaint({
        variant: rule.variants[
          String(record.derivedProps?.variant ?? rule.defaultVariant)
        ] as never,
        size: undefined as never,
        props: { ...record.props, ...record.derivedProps } as never,
      } as never),
    };
  };
  return { definitionId, tag, paint };
}

describe("S2 Meter staticColor", () => {
  it("the Design panel offers Static Color (auto · white · black)", async () => {
    const { definitionId } = await open({});
    const contract = catalogSemanticContracts(definitionId, "Meter")
      .staticColor as { kind: string; options?: Array<{ value: string }> };
    expect(contract).toMatchObject({ kind: "enum" });
    expect(contract.options?.map((option) => option.value)).toEqual([
      "auto",
      "white",
      "black",
    ]);
  });

  it("auto: no static attribute · the variant fill", async () => {
    const { tag, paint } = await open({});
    expect(tag).not.toContain("data-static-color");
    expect(paint("MeterFill").backgroundColor).not.toBe("#ffffff");
  });

  for (const [color, hex] of [
    ["white", "#ffffff"],
    ["black", "#000000"],
  ] as const)
    it(`${color}: the fill in the static color · the track a 25% wash of it — both consumers`, async () => {
      const { tag, paint } = await open({
        staticColor: color,
        variant: "positive",
      });
      expect(tag).toContain(`data-static-color="${color}"`);
      const fill = paint("MeterFill");
      expect(fill.derived).toBe(color);
      expect(fill.backgroundColor).toBe(hex);
      const track = paint("MeterTrack");
      expect(track.backgroundColor).toBe(hex);
      expect(track.backgroundAlpha).toBeCloseTo(0.25);
    });

  it("the sheet gives a static Meter the same fill · track (over its variant)", () => {
    const sheet = readFileSync(SHEET, "utf8");
    for (const [color, fill, track] of [
      ["white", "var\\(--color-white, #fff\\)", "rgb\\(255 255 255 \\/ 0\\.25\\)"],
      ["black", "var\\(--color-black, #000\\)", "rgb\\(0 0 0 \\/ 0\\.25\\)"],
    ]) {
      expect(sheet).toMatch(
        new RegExp(
          `\\.react-aria-Meter\\[data-static-color="${color}"\\] \\{\\s*--fill-color: ${fill};`,
        ),
      );
      expect(sheet).toMatch(
        new RegExp(
          `\\.react-aria-Meter\\[data-static-color="${color}"\\] \\.bar \\{\\s*background: ${track};`,
        ),
      );
    }
  });
});
