import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogCanvasNodeData } from "../canvasBinding";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";

const BODY = "project:node:home-body" as NodeId;

async function fieldText(type: string, input: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:disabled-text" as EntryId<"project">,
        name: "disabled text",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `disabled-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => [],
        itemOfRecord: (id) => workspace.itemOfRecord(id),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      type,
      props,
    )!,
  );
  const root = workspace.root;
  const record = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === input,
  )!;
  const find = (d: SkiaNodeData): SkiaNodeData["text"] | undefined =>
    d.text ?? (d.children ?? []).map(find).find(Boolean);
  const text = find(catalogCanvasNodeData(root, record.id))!;
  return Array.from(text.color as ArrayLike<number>);
}

describe("disabled field 의 입력 글자 — Canvas 도 disabled-content 색", () => {
  for (const [type, input, value] of [
    ["TextField", "Input", "Hello"],
    ["TokenField", "TokenInput", "Hello"],
    ["DateField", "DateInput", "2026-11-23"],
  ] as const) {
    it(`${type}: 값 글자가 disabled 에서 휴지 색과 다르다`, async () => {
      const rest = await fieldText(type, input, { value });
      const off = await fieldText(type, input, { value, isDisabled: true });
      expect(off).not.toEqual(rest);
      // the Input rule's `isDisabled` branch — `{color.disabled-content}`, the DOM's `[data-disabled]`
      const hex = String(resolveToken("{color.disabled-content}" as TokenRef, "light"));
      const rgb = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      expect(off.slice(0, 3).map((c) => Math.round(c * 255))).toEqual(rgb);
    });
  }
});

describe("disabled DateSegment 글자 — DOM 도 같은 disabled-content (color-mix 파생식 아님)", () => {
  it("DateInput 의 조각 delegation `[data-disabled]` 색 = Input rule 의 disabled 글자 변수", async () => {
    const { COMPONENT_RULES_TABLE } = await import(
      "../../../../../../packages/shared/src/catalog/generated/componentRulesTable"
    );
    const { tokenToCSSVar } = await import("@composition/rendering");
    const delegation = (
      COMPONENT_RULES_TABLE.DateInput as unknown as {
        structure: {
          composition: {
            delegation: {
              childSelector: string;
              states?: Record<string, Record<string, string>>;
            }[];
          };
        };
      }
    ).structure.composition.delegation.find(
      (d) => d.childSelector === ".react-aria-DateSegment",
    )!;
    expect(delegation.states?.["[data-disabled]"]?.color).toBe(
      tokenToCSSVar("{color.disabled-content}" as TokenRef),
    );
  });
});
