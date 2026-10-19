import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * The text re-wrap (`rewrap`) breaks lines at the width the engine laid the content out in: the
 * used border — each side, device-pixel snapped (Blink `ComputeBordersInternal` reads the snapped
 * side widths) — not the authored uniform `borderWidth`. Before (2026-10-19, Chromium re-audit
 * A-NEW-2) a side width was ignored and a hairline was taken at 0.5 where the engine laid out 1.
 */
const set = <T>(value: T) => ({ kind: "set" as const, value });
const BODY = "project:node:home-body" as NodeEntry["id"];

/** 10px per character; words break at spaces. */
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
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const need = used ? used + 1 + word.length : word.length;
    if (need <= perLine) used = need;
    else if (used) {
      lines += 1;
      used = word.length;
    } else used = word.length;
  }
  return { width: maxWidth, height: lines * line };
};

async function textHeight(
  visual: Record<string, unknown>,
  width: number,
  devicePixelRatio?: number,
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:rewrap-border" as const,
        name: "Rewrap",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `rewrap-border-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
      textMeasure: measure,
      ...(devicePixelRatio ? { root: { devicePixelRatio } } : {}),
    },
  );
  const id = "project:node:t" as NodeEntry["id"];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(
            workspace.runtime.graph.library,
            "Text",
          ) as NodeEntry["definitionId"],
          children: [],
          props: { children: set("aaaa bbbb") },
          visual: Object.fromEntries(
            Object.entries({ fontSize: 10, ...visual }).map(([key, value]) => [
              key,
              set(value),
            ]),
          ),
          sizing: { width: set(width) },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const record = [...workspace.root.canvasInputs.values()].find(
    (r) => r.sourceId === id,
  )!;
  return workspace.root.getGeometry([record.id]).get(record.id)!.height;
}

describe("text re-wrap width = the engine's used border", () => {
  it("a side border narrows the wrap width", async () => {
    const plain = await textHeight({}, 100);
    const sided = await textHeight(
      { borderLeftWidth: 20, borderColor: "#000000", borderStyle: "solid" },
      100,
    );
    // 90 wide fits 100 · not 80: one line → two.
    expect(sided).toBeGreaterThan(plain);
  });

  it("a hairline wraps at its device-pixel width (DPR 1: 1px a side)", async () => {
    const hairline = {
      borderWidth: 0.5,
      borderColor: "#000000",
      borderStyle: "solid",
    };
    // 91 wide, the 90 text (line 15): DPR 1 lays the content out in 89 → two lines + 1 + 1;
    // DPR 2 keeps 0.5 a side → content 90, one line + 0.5 + 0.5.
    expect(await textHeight(hairline, 91, 1)).toBe(32);
    expect(await textHeight(hairline, 91, 2)).toBe(16);
  });
});
