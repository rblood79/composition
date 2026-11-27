/**
 * ADR-320 G2 — a connected filter bar, Canvas ↔ Preview DOM (±1 CSS px): the chips of its start tree
 * (a condition each — field text · comparison · value · menu · remove buttons; a group's chip without
 * comparison · value; `exists` without a value) and its three buttons, at S · M · L. The bar is put in
 * through the product commands (a bound Table, 「Add filter bar」's command, the start tree written)
 * and laid out by the product composition root; the DOM arm is the Preview's renderer
 * (`renderCatalogDom` — RAC Toolbar · Group, the generated FilterBar · FilterChip sheets) in the same
 * Chrome. The palette's unconnected bar (one sample chip) is the palette harness's (`FilterBar@*`).
 *
 * A second gate reads Chrome alone against values written out by hand (`EXPECTED` — the chip box
 * heights per size: the bar's control height, the rule's formula) — two arms agreeing on a wrong
 * formula would pass the comparison.
 *
 * Conditions: Chrome (headless), DPR 1, viewport 1440×900, light theme, Pretendard in both legs, en-US.
 * Report: `test-results/adr320-filterbar-parity.json`.
 */
import { createElement } from "react";
import { I18nProvider } from "react-aria-components";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import {
  catalogDomRendersNode,
  renderCatalogDom,
} from "@/builder/catalogRuntime/domBinding";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands, page as browserPage } from "vitest/browser";
import { createThemesCollection, getActiveTheme } from "@composition/shared";
import { DEFAULT_BASE_TYPOGRAPHY } from "@/builder/fonts/customFonts";
import { resolveThemeSnapshot } from "@/utils/theme/resolveThemeSnapshot";
import { catalogThemeVarsCss } from "../../../../packages/shared/src/catalog/runtime/themeVarsCss";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { catalogBindingRef } from "@/builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "@/builder/catalogRuntime/dataBindingCommand";
import { catalogBuilderBoundRows } from "@/builder/catalogRuntime/catalogDataRead";
import { catalogAddFilterBarCommand } from "@/builder/catalogRuntime/filterBarAuthoring";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { installThemeMaps } from "../../../../packages/shared/src/catalog/runtime/themeMaps";
import {
  insertNodes,
  setFields,
} from "../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../packages/shared/src/catalog/commands/data";
import {
  catalogSubpartDomSelectors,
  catalogSubpartDomUnion,
} from "../../../../packages/shared/src/catalog/document/rulePartRules";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../packages/shared/src/catalog/document/types";

type Rect = { x: number; y: number; width: number; height: number };
const PAGE = { width: 1440, height: 900 };
const LOCALE = "en-US";
const REPORT = "test-results/adr320-filterbar-parity.json";
const round = (n: number) => Math.round(n * 100) / 100;
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
let code: CatalogLibrary;
const report: unknown[] = [];

const cond = (
  id: string,
  field: string,
  op: string,
  value?: unknown,
  extra = {},
) => ({
  id,
  fields: [[`data:field:f-${field}`]],
  op,
  ...(value === undefined ? {} : { value }),
  ...extra,
});
const TREES: Record<string, unknown> = {
  three: {
    id: "filter-scope",
    op: "and",
    items: [
      cond("c1", "name", "contains", "Bo"),
      cond("c2", "status", "gte", 2),
      {
        id: "g1",
        op: "or",
        items: [
          cond("c3", "type", "equals", "A"),
          cond("c4", "type", "equals", "B"),
        ],
      },
    ],
  },
  valueless: {
    id: "filter-scope",
    op: "and",
    items: [
      cond("c1", "name", "exists"),
      cond("c2", "type", "oneOf", ["Alpha", "Beta", "Gamma", "Delta"]),
      cond("c3", "status", "between", [1, 4], { enabled: false }),
    ],
  },
};
const CASES = (["S", "M", "L"] as const).flatMap((size) =>
  Object.keys(TREES).map((tree) => ({ key: `${tree}@${size}`, size, tree })),
);
/** Chrome alone: the chip boxes' height (the bar's control height — S 24 · M 32 · L 40). */
const EXPECTED_CHIP_HEIGHT = { S: 24, M: 32, L: 40 } as const;

beforeAll(async () => {
  await browserPage.viewport(PAGE.width, PAGE.height);
  const face = document.createElement("style");
  face.textContent = `@font-face { font-family: "Pretendard"; src: url("/fonts/PretendardVariable.ttf") format("truetype"); font-weight: 45 920; font-display: block; }`;
  document.head.append(face);
  await Promise.all(
    [400, 500, 600, 700].map((weight) =>
      document.fonts.load(`${weight} 16px "Pretendard"`),
    ),
  );
  await document.fonts.ready;
  const css = document.createElement("style");
  css.textContent = bundleCss;
  document.head.append(css);
  injectPreviewBaseStyles(document);
  const theme = resolveThemeSnapshot(
    getActiveTheme({ themes: createThemesCollection() })!,
    { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
  );
  installThemeMaps(theme);
  const vars = document.createElement("style");
  vars.textContent = catalogThemeVarsCss(theme);
  document.head.append(vars);
  await initEngineWasm();
  await initCanvasKit();
  await loadBuiltinFontsToSkia();
  code = await buildCodeCatalogLibrary();
});

afterAll(async () => {
  await commands.writeFile(
    REPORT,
    `${JSON.stringify({ cases: report }, null, 1)}\n`,
  );
});

async function build(size: string, tree: unknown) {
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:adr320-parity" as EntryId<"project">,
      name: "ADR-320 parity",
    }),
    code,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr320-parity-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      viewport: PAGE,
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
      locale: LOCALE,
      root: {
        rowSample: true,
        rows: (binding, kind, ownerId, _path, slices) =>
          catalogBuilderBoundRows(graph, binding, kind, ownerId, slices),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: "data:collection:users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string", label: "Name" },
            { id: "f-type", key: "type", type: "string", label: "Type" },
            { id: "f-status", key: "status", type: "number", label: "Status" },
          ],
          mockData: [{ id: "p1", name: "Bora", type: "B", status: 2 }],
          useMockData: true,
        } as never,
      ],
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: TABLE,
          definitionId: catalogPaletteDefinitionId(code, "Table"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TABLE],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: TABLE }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  const { command, created } = catalogAddFilterBarCommand(
    { listId: TABLE },
    workspace.newId,
  );
  workspace.execute(command);
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: created.barId }],
      props: {
        size: { kind: "set", value: size },
        defaultQuery: { kind: "set", value: tree },
        // (Placed where the page starts — absolute, as the palette harness.)
      } as never,
    }),
  );
  return { workspace, barId: created.barId };
}

async function measure(key: string, size: string, treeKey: string) {
  const { workspace, barId } = await build(size, TREES[treeKey]);
  const root = workspace.root;
  const rootInput = [...root.canvasInputs.values()].find(
    (input) => input.sourceId === barId,
  )!;
  const relative = root.getGeometry(root.canvasInputs.keys());
  const absolute = new Map<string, Rect>();
  const place = (id: string, parentX: number, parentY: number) => {
    const rect = relative.get(id);
    if (!rect) return;
    const x = parentX + rect.x;
    const y = parentY + rect.y;
    absolute.set(id, { x, y, width: rect.width, height: rect.height });
    for (const child of root.canvasInputs.get(id)?.children ?? [])
      place(child, x, y);
  };
  // (The bar's own place on the page is the body's flow — both arms measured from the bar.)
  place(rootInput.id, 0, 0);
  const barRect = absolute.get(rootInput.id)!;
  for (const [id, rect] of absolute)
    absolute.set(id, { ...rect, x: rect.x - barRect.x, y: rect.y - barRect.y });
  const host = document.createElement("div");
  // (The bar fills its container — the DOM arm gets the Canvas body's width, the same room.)
  host.style.cssText = `position:absolute;left:0;top:0;width:${barRect.width}px;height:${PAGE.height}px;overflow:hidden`;
  document.body.append(host);
  const reactRoot = createRoot(host);
  flushSync(() =>
    reactRoot.render(
      createElement(I18nProvider, {
        locale: LOCALE,
        children: renderCatalogDom(root, rootInput.id),
      }),
    ),
  );
  // (ADR-320 Phase 3 — the bar's DOM is the chip line's chunk: drawn once it loads.)
  const wanted = [...root.canvasInputs.values()].filter(
    (record) => root.typeOf(record) === "FilterChip",
  ).length;
  for (
    let tries = 0;
    tries < 300 &&
    (!host.querySelector(`[data-catalog-id="${CSS.escape(rootInput.id)}"]`) ||
      host.querySelectorAll(".react-aria-FilterChip").length < wanted);
    tries += 1
  )
    await new Promise((resolve) => setTimeout(resolve, 16));
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  const barElement = host.querySelector(
    `[data-catalog-id="${CSS.escape(rootInput.id)}"]`,
  )!;
  const origin = barElement.getBoundingClientRect();
  const ownedSeen = new Map<string, number>();
  const unionOf = new Map<string, Element[]>();
  const locate = (id: string): Element | null => {
    const node = root.canvasInputs.get(id)!;
    let owner = root.canvasInputs.get(node.parentId);
    while (owner && !catalogDomRendersNode(root, owner.id))
      owner = root.canvasInputs.get(owner.parentId);
    const ownerElement = owner
      ? host.querySelector(`[data-catalog-id="${CSS.escape(owner.id)}"]`)
      : null;
    if (!owner || !ownerElement) return null;
    const childType = root.typeOf(node);
    const seenKey = `${owner.id}|${childType}`;
    const index = ownedSeen.get(seenKey) ?? 0;
    ownedSeen.set(seenKey, index + 1);
    const candidates = [
      ...ownerElement.querySelectorAll(
        catalogSubpartDomSelectors(root.typeOf(owner), childType).join(", "),
      ),
    ].filter((candidate) => !candidate.closest("[hidden]"));
    if (catalogSubpartDomUnion(root.typeOf(owner), childType)) {
      unionOf.set(id, candidates);
      return candidates[0] ?? null;
    }
    return candidates[index] ?? null;
  };
  const boxOf = (id: string, element: Element) => {
    const parts = unionOf.get(id);
    if (!parts?.length) return element.getBoundingClientRect();
    const rects = parts.map((part) => part.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    return {
      x: left,
      y: top,
      width: Math.max(...rects.map((rect) => rect.right)) - left,
      height: Math.max(...rects.map((rect) => rect.bottom)) - top,
    };
  };
  const underHidden = (id: string): boolean => {
    for (
      let cursor = root.canvasInputs.get(id);
      cursor;
      cursor = root.canvasInputs.get(cursor.parentId)
    )
      if (cursor.hidden) return true;
    return false;
  };
  const nodes: unknown[] = [];
  let worst = 0;
  let subject: Element | null = null;
  for (const [id, rect] of absolute) {
    if (underHidden(id)) continue;
    let element = catalogDomRendersNode(root, id)
      ? host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`)
      : locate(id);
    if (element && id === rootInput.id)
      while (
        element.parentElement &&
        element.parentElement !== host &&
        getComputedStyle(element.parentElement).display !== "contents"
      )
        element = element.parentElement;
    const type = root.typeOf(root.canvasInputs.get(id)!);
    const canvas = {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
    };
    if (!element || getComputedStyle(element).display === "contents") {
      nodes.push({ id: id.split("::").pop(), type, canvas, dom: null });
      continue;
    }
    if (id === rootInput.id) subject = element;
    const box = boxOf(id, element);
    const dom = {
      x: round(box.x - origin.x),
      y: round(box.y - origin.y),
      width: round(box.width),
      height: round(box.height),
    };
    const delta = Math.max(
      Math.abs(dom.x - canvas.x),
      Math.abs(dom.y - canvas.y),
      Math.abs(dom.width - canvas.width),
      Math.abs(dom.height - canvas.height),
    );
    worst = Math.max(worst, delta);
    nodes.push({
      id: id.split("::").pop(),
      type,
      canvas,
      dom,
      delta: round(delta),
    });
  }
  const chips = [...host.querySelectorAll(".react-aria-FilterChip")].map(
    (chip) => round(chip.getBoundingClientRect().height),
  );
  reactRoot.unmount();
  host.remove();
  return {
    key,
    maxDelta: round(worst),
    symmetric: worst <= 1,
    chips,
    nodes,
  };
}

describe("ADR-320 G2 — a connected filter bar, Canvas ↔ DOM", () => {
  for (const { key, size, tree } of CASES)
    it(key, async () => {
      const result = await measure(key, size, tree);
      report.push(result);
      const off = (
        result.nodes as { delta?: number; type: string; id?: string }[]
      ).filter((node) => (node.delta ?? 0) > 1);
      expect(off, JSON.stringify(off)).toEqual([]);
      // (Every drawn node has a DOM box to compare — a vacuous run fails here.)
      expect(result.nodes.length).toBeGreaterThan(10);
      expect(result.chips).toEqual(Array(3).fill(EXPECTED_CHIP_HEIGHT[size]));
    });
});
