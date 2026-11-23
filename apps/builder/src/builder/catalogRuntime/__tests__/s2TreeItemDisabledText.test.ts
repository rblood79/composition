import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { resolveToken, tokenToCSSVar, type TokenRef } from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
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
const DISABLED = "{color.disabled-content}" as TokenRef;

/** A Tree on a page; reads its first top-level item's label Text colors (0–255 rgb) and glyph color. */
async function treeFixture() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tree-disabled" as EntryId<"project">,
        name: "tree disabled",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `tree-disabled-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
      // (jsdom measures no text — a glyph-width measure so the labels lay out and draw)
      textMeasure: (text, font) => ({
        width: text.length * font.fontSize * 0.5,
        exactWidth: text.length * font.fontSize * 0.5,
        minWidth: font.fontSize * 2,
        height: font.fontSize * (font.lineHeight || 1.2),
      }),
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
      "Tree",
      {},
    )!,
  );
  const root = workspace.root;
  const of = (type: string, under?: string) =>
    [...root.canvasInputs.values()].filter(
      (r) =>
        root.typeOf(r) === type &&
        (under === undefined ||
          root.typeOf(root.canvasInputs.get(r.parentId!)!) === under),
    );
  // (a top-level item — a nested one rests collapsed, undrawn)
  const item = () => of("TreeItem", "Tree")[0]!;
  const inItem = (type: string) => {
    const out: string[] = [];
    const visit = (id: string) => {
      if (root.typeOf(root.canvasInputs.get(id as never)!) === type) out.push(id);
      for (const child of root.canvasInputs.get(id as never)?.children ?? [])
        if (root.typeOf(root.canvasInputs.get(child)!) !== "TreeItem") visit(child);
    };
    visit(item().id);
    return out;
  };
  const labels = () => {
    const out: number[][] = [];
    const walk = (d: SkiaNodeData) => {
      if (d.text?.color && d.visible !== false)
        out.push(
          Array.from(d.text.color as ArrayLike<number>)
            .slice(0, 3)
            .map((c) => Math.round(c * 255)),
        );
      for (const c of d.children ?? []) walk(c);
    };
    for (const id of inItem("Text")) walk(catalogCanvasNodeData(root, id as never));
    return out;
  };
  // (the chevron glyph's color — the item's text color, `catalogTreeChevronGlyphItem`)
  const glyph = () =>
    String(root.canvasInputs.get(inItem("Icon")[0] as never)?.derivedProps?.color);
  const write = (id: string, props: Record<string, boolean | string[]>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id as NodeId }],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
      }),
    );
  // (the row's selection Checkbox record — its derived disabled, RAC's context value)
  const checkboxDisabled = () =>
    inItem("Checkbox").map(
      (id) =>
        root.canvasInputs.get(id as never)?.derivedProps?.isDisabled === true,
    );
  return { item, of, labels, glyph, write, checkboxDisabled };
}

const rgb = (ref: TokenRef) => {
  const hex = String(resolveToken(ref, "light"));
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
};

describe("S2 TreeView — disabled 항목의 글자 = disabled-content (gray-400)", () => {
  it("Canvas: disabled TreeItem 의 라벨 · chevron 글리프가 disabled-content, 다시 켜면 휴지 색", async () => {
    const f = await treeFixture();
    const rest = f.labels();
    const restGlyph = f.glyph();
    expect(rest.length).toBe(1);
    expect(rest[0]).not.toEqual(rgb(DISABLED));
    f.write(f.item().sourceId, { isDisabled: true });
    expect(f.labels()).toEqual([rgb(DISABLED)]);
    expect(f.glyph().toLowerCase()).toBe(
      String(resolveToken(DISABLED, "light")).toLowerCase(),
    );
    f.write(f.item().sourceId, { isDisabled: false });
    expect(f.labels()).toEqual(rest);
    expect(f.glyph()).toBe(restGlyph);
  });

  // 부록 D.3 2단계 (2026-11-23) — the Tree's `disabledKeys` naming the item: the same paint, on the
  // edit of the Tree (its rows' label · chevron re-derived — live: Canvas 41 vs Publish 198 before).
  it("Canvas: Tree 의 disabledKeys 가 이름 붙인 항목 — 라벨 · chevron · 선택 Checkbox 가 disabled, 지우면 휴지", async () => {
    const f = await treeFixture();
    const rest = f.labels();
    const restGlyph = f.glyph();
    const tree = f.of("Tree")[0]!;
    const key = String(f.item().props.id);
    f.write(tree.sourceId, { selectionMode: "multiple" } as never);
    const restCheckbox = f.checkboxDisabled();
    f.write(tree.sourceId, { disabledKeys: [key] });
    expect(f.labels()).toEqual([rgb(DISABLED)]);
    expect(f.glyph().toLowerCase()).toBe(
      String(resolveToken(DISABLED, "light")).toLowerCase(),
    );
    expect(f.checkboxDisabled().length).toBeGreaterThan(0);
    expect(f.checkboxDisabled().every(Boolean)).toBe(true);
    f.write(tree.sourceId, { disabledKeys: [] });
    expect(f.labels()).toEqual(rest);
    expect(f.glyph()).toBe(restGlyph);
    expect(f.checkboxDisabled()).toEqual(restCheckbox);
  });

  it("DOM: Tree sheet — disabled 행 · 라벨 Text · chevron Icon 이 같은 토큰 변수 (color-mix 파생식 아님)", () => {
    const states = (
      COMPONENT_RULES_TABLE.Tree as unknown as {
        partStateStyles: Record<string, { color?: { isDisabled?: unknown } }>;
      }
    ).partStateStyles;
    for (const selector of [
      "& .react-aria-TreeItem%",
      // (the Text · Icon keep their own `--fg` — the row's color does not reach them)
      "& .react-aria-TreeItem% .react-aria-Text",
      '& .react-aria-TreeItem% .react-aria-Button[slot="chevron"] .react-aria-Icon',
    ])
      expect(states[selector]?.color?.isDisabled, selector).toBe(
        tokenToCSSVar(DISABLED),
      );
  });
});
