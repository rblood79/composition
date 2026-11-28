/**
 * ADR-323 G2 — Timeline · TimelineItem, Canvas ↔ Preview DOM (HC4: 같은 작성 값에서 표식 · 선 · 글자
 * 상자가 ±1 px). Each fixture is a hand-made Timeline of TimelineItem origin instances
 * (`component-timelineitem` — the document shape the palette places) laid out by the product
 * composition root and drawn by the Preview's DOM renderer (`renderCatalogDom` — `ol > li`, the
 * generated Timeline · TimelineItem sheets) in the same environment. The DOM is the independent arm:
 * Chrome lays out the `ol` · `li` boxes and the absolute marker · connector `span`s on its own; the
 * Canvas arm is the engine's rects plus the scene's shapes (`catalogCanvasNodeData`).
 *
 * Read per drawn node: the list's · an item's · a Text's box (engine rect vs `getBoundingClientRect`),
 * a Text's font size · weight · color, the item's marker (box · fill · border color) and connector
 * (box · color; none on the last item).
 *
 * Fixtures (G2 의 입력 차원): 방향 둘 × 배치 셋 · 크기 셋 · 상태 셋 · 날짜 · 설명 유무 · 긴 제목 줄바꿈 ·
 * 목록에 작성한 상자 값 · 항목 수 2 · 6, and the incremental arm (the list's orientation · position ·
 * an item's status written after the build — a missed dependent shows as a scene difference).
 *
 * A second gate reads Chrome alone against values written out by hand from the rule (`EXPECTED`).
 *
 * Conditions: Chrome (`channel: chrome`, headless), DPR 1, viewport 1440×900, light theme,
 * `visibilityState` visible, Pretendard file in both legs, en-US. Gate: every box ≤ 1 CSS px, every
 * paint value equal. Report: `test-results/adr323-timeline-parity.json`.
 */
import { createElement } from "react";
import { I18nProvider } from "react-aria-components";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import {
  borderWidth,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius,
  typography,
} from "@composition/rendering";
import { createThemesCollection, getActiveTheme } from "@composition/shared";
import { DEFAULT_BASE_TYPOGRAPHY } from "@/builder/fonts/customFonts";
import { resolveThemeSnapshot } from "@/utils/theme/resolveThemeSnapshot";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import {
  bindCatalogCanvas,
  catalogCanvasNodeData,
} from "@/builder/catalogRuntime/canvasBinding";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { setFields } from "../../../../packages/shared/src/catalog/commands";
import type {
  CatalogDocument,
  CatalogLibrary,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";

type Rect = { x: number; y: number; width: number; height: number };
const PAGE = { width: 1440, height: 900 };
const LOCALE = "en-US";
const REPORT = "test-results/adr323-timeline-parity.json";
const set = <T>(value: T) => ({ kind: "set" as const, value });
const LIST = "project:node:list";
const BODY = "project:node:body";
const report: unknown[] = [];
let code: CatalogLibrary;

type ItemSpec = {
  label: string;
  date?: string;
  description?: string;
  status?: string;
};
type Fixture = {
  key: string;
  width: number;
  list: Record<string, unknown>;
  box?: Record<string, unknown>;
  items: ItemSpec[];
  /** Writes after the build (the incremental arm): the list's props, or one item's (`item`). */
  after?: Record<string, unknown>;
  afterItem?: { index: number; props: Record<string, unknown> };
};

const HISTORY: ItemSpec[] = [
  { label: "Order placed", date: "2026-11-24", status: "completed" },
  { label: "Shipped", date: "2026-11-26", status: "current" },
  { label: "Delivered", status: "upcoming" },
];
const SIX: ItemSpec[] = [
  { label: "Created", date: "2026-11-01" },
  { label: "Reviewed", date: "2026-11-03", description: "Two approvals" },
  { label: "Merged", date: "2026-11-04" },
  { label: "Deployed", date: "2026-11-05", status: "current" },
  { label: "Verified", status: "upcoming" },
  { label: "Closed", status: "upcoming", description: "After a week" },
];
const LONG: ItemSpec[] = [
  {
    label: "A request that was received from the customer support desk",
    date: "2026-11-20",
  },
  { label: "Assigned", date: "2026-11-21", status: "current" },
  {
    label: "Resolved and confirmed with the customer by phone",
    status: "upcoming",
    description: "Waiting for the customer to answer the survey email",
  },
];
const AUTHORED_BOX = {
  paddingTop: 10,
  paddingRight: 10,
  paddingBottom: 10,
  paddingLeft: 10,
};

const FIXTURES: Fixture[] = [
  // 방향 둘 × 배치 셋 (M)
  ...(["end", "start", "alternate"] as const).flatMap((position) => [
    {
      key: `vertical-M-${position}`,
      width: 400,
      list: { position },
      items: HISTORY,
    },
    {
      key: `horizontal-M-${position}`,
      width: 600,
      list: { orientation: "horizontal", position },
      items: HISTORY,
    },
  ]),
  // 크기
  ...(["S", "L"] as const).flatMap((size) => [
    { key: `vertical-${size}-end`, width: 300, list: { size }, items: SIX },
    {
      key: `horizontal-${size}-end`,
      width: 900,
      list: { size, orientation: "horizontal" },
      items: SIX,
    },
  ]),
  // 항목 수 2 · 6, 설명 섞임
  {
    key: "vertical-M-alternate-6",
    width: 480,
    list: { position: "alternate" },
    items: SIX,
  },
  {
    key: "horizontal-M-start-2",
    width: 360,
    list: { orientation: "horizontal", position: "start" },
    items: HISTORY.slice(0, 2),
  },
  // 긴 제목 줄바꿈
  { key: "vertical-M-long", width: 220, list: {}, items: LONG },
  {
    key: "vertical-M-alternate-long",
    width: 360,
    list: { position: "alternate" },
    items: LONG,
  },
  {
    key: "horizontal-M-long",
    width: 480,
    list: { orientation: "horizontal" },
    items: LONG,
  },
  // 목록에 작성한 상자 값
  {
    key: "vertical-M-authored-box",
    width: 400,
    list: {},
    box: { ...AUTHORED_BOX, gap: 8 },
    items: HISTORY,
  },
  {
    key: "horizontal-M-authored-box",
    width: 600,
    list: { orientation: "horizontal" },
    box: { ...AUTHORED_BOX, height: "140px" },
    items: HISTORY,
  },
  // 증분 — 놓은 뒤 목록 · 항목의 값만 바꾼다
  {
    key: "incremental-position",
    width: 400,
    list: {},
    items: HISTORY,
    after: { position: "alternate" },
  },
  {
    key: "incremental-orientation",
    width: 600,
    list: {},
    items: HISTORY,
    after: { orientation: "horizontal", size: "L" },
  },
  {
    key: "incremental-status",
    width: 400,
    list: {},
    items: HISTORY,
    afterItem: { index: 2, props: { status: "current" } },
  },
];

const itemId = (index: number) => `project:node:t${index + 1}`;

function documentFor(fixture: Fixture): CatalogDocument {
  const projectId = "project:project:adr323-g2";
  const pageId = "project:page:adr323-g2";
  const entries: Record<string, unknown> = {};
  const node = (
    id: string,
    definitionId: string,
    props: Record<string, unknown>,
    children: string[] = [],
    visual: Record<string, unknown> = {},
  ) => {
    entries[id] = {
      kind: "node",
      id,
      definitionId,
      children,
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, set(value)]),
      ),
      visual: Object.fromEntries(
        Object.entries(visual).map(([key, value]) => [key, set(value)]),
      ),
      sizing: {},
      descendantOverrides: [],
    } as NodeEntry;
    return id;
  };
  const ids = fixture.items.map((item, index) =>
    node(itemId(index), "lib:definition:origin-component-timelineitem", {
      id: `t${index + 1}`,
      label: item.label,
      ...(item.date ? { date: item.date } : {}),
      ...(item.description ? { description: item.description } : {}),
      ...(item.status ? { status: item.status } : {}),
    }),
  );
  node(LIST, "lib:definition:type-Timeline", fixture.list, ids, {
    width: `${fixture.width}px`,
    ...fixture.box,
  });
  node(BODY, "lib:definition:type-body", {}, [LIST]);
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 89,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "adr323",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Home",
        route: "/",
        children: [BODY],
      },
      ...entries,
    },
  } as unknown as CatalogDocument;
}

// ── colors: both sides through one canvas parser (hex · rgb · oklch → rgba) ──
const probe = document.createElement("canvas").getContext("2d")!;
function rgba(value: unknown): string {
  probe.fillStyle = "#010203";
  probe.fillStyle = String(value);
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  probe.clearRect(0, 0, 1, 1);
  return `${r},${g},${b},${a}`;
}
const floatRgba = (color: ArrayLike<number> | undefined): string =>
  color && Number(color[3]) > 0
    ? Array.from(color)
        .map((value) => Math.round(value * 255))
        .join(",")
    : "none";

beforeAll(async () => {
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
  Object.assign(lightColors, theme.colors.light);
  Object.assign(darkColors, theme.colors.dark);
  Object.assign(typography, theme.typography);
  Object.assign(radius, theme.radius);
  Object.assign(borderWidth, theme.border);
  Object.assign(lightShadows, theme.shadows.light);
  Object.assign(darkShadows, theme.shadows.dark);
  const vars = document.createElement("style");
  vars.textContent = `:root {\n${theme.cssVars
    .filter((entry) => !entry.isDark)
    .map((entry) => `  ${entry.name}: ${entry.value};`)
    .join("\n")}\n}`;
  document.head.append(vars);
  await initEngineWasm();
  await initCanvasKit();
  await loadBuiltinFontsToSkia();
  code = await buildCodeCatalogLibrary();
});

afterAll(async () => {
  await commands.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
});

type Chrome = {
  marker?: Rect & { fill: string; border: string };
  connector?: Rect & { fill: string };
};

/** What the Canvas scene draws in an item's box (`catalogCanvasNodeData` children): marker · connector. */
function canvasChrome(root: CatalogCompositionRoot, id: string): Chrome {
  // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
  const data = catalogCanvasNodeData(root, id) as any;
  // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
  const shapes: any[] = data.children ?? [];
  const painted = shapes.filter(
    (shape) =>
      shape.type === "box" &&
      (floatRgba(shape.box?.fillColor) !== "none" ||
        floatRgba(shape.box?.strokeColor) !== "none"),
  );
  const marker = painted.find(
    (shape) => shape.width === shape.height && shape.box?.borderRadius > 0,
  );
  const connector = painted.find((shape) => shape !== marker);
  const rect = (shape: Rect): Rect => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  });
  return {
    ...(marker
      ? {
          marker: {
            ...rect(marker),
            fill: floatRgba(marker.box?.fillColor),
            border: floatRgba(marker.box?.strokeColor),
          },
        }
      : {}),
    ...(connector
      ? {
          connector: {
            ...rect(connector),
            fill: floatRgba(connector.box?.fillColor),
          },
        }
      : {}),
  };
}

/** The same reading of the DOM item: its `span.timeline-marker` · `span.timeline-connector`. */
function domChrome(item: HTMLElement): Chrome {
  const origin = item.getBoundingClientRect();
  const within = (element: Element): Rect => {
    const box = element.getBoundingClientRect();
    return {
      x: box.x - origin.x,
      y: box.y - origin.y,
      width: box.width,
      height: box.height,
    };
  };
  const marker = item.querySelector<HTMLElement>(":scope > .timeline-marker");
  const connector = item.querySelector<HTMLElement>(
    ":scope > .timeline-connector",
  );
  const paint = (element: HTMLElement) => {
    const style = getComputedStyle(element);
    const fill = rgba(style.backgroundColor);
    return {
      fill: fill.endsWith(",0") ? "none" : fill,
      border:
        Number.parseFloat(style.borderTopWidth) > 0
          ? rgba(style.borderTopColor)
          : "none",
    };
  };
  return {
    ...(marker ? { marker: { ...within(marker), ...paint(marker) } } : {}),
    ...(connector
      ? { connector: { ...within(connector), fill: paint(connector).fill } }
      : {}),
  };
}

const apart = (a: Rect, b: Rect): number =>
  Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );

async function compare(fixture: Fixture) {
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentFor(fixture), code),
    new CatalogStorage(indexedDB, `adr323-g2-${fixture.key}`),
  );
  const root = new CatalogCompositionRoot(
    runtime,
    createLayoutEngine(),
    PAGE,
    undefined,
    undefined,
    catalogTextMeasure,
    LOCALE,
  );
  const sceneRoot = [...root.canvasInputs.values()].find(
    (input) => input.parentId === "catalog:root",
  )!.id;
  const incremental = !!(fixture.after || fixture.afterItem);
  const scene = incremental ? bindCatalogCanvas(root, [sceneRoot]) : undefined;
  const write = (id: string, props: Record<string, unknown>) =>
    root.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      } as never),
    );
  if (fixture.after) write(LIST, fixture.after);
  if (fixture.afterItem)
    write(itemId(fixture.afterItem.index), fixture.afterItem.props);
  let sceneDifferences: string[] = [];
  let sceneStatus: string | undefined;
  if (scene) {
    sceneStatus = String(
      (scene.update() as unknown as { status?: string }).status,
    );
    const snapshot = () =>
      new Map(
        [...root.canvasInputs.keys()].map((id) => [
          id,
          JSON.stringify(getSkiaNode(id), (_, value) =>
            ArrayBuffer.isView(value)
              ? Array.from(value as Float32Array)
              : value,
          ),
        ]),
      );
    const patched = snapshot();
    const fresh = bindCatalogCanvas(root, [sceneRoot]);
    const rebuilt = snapshot();
    sceneDifferences = [...patched]
      .filter(([id, data]) => rebuilt.get(id) !== data)
      .map(([id]) => id.split(":").pop()!);
    fresh.dispose();
    scene.dispose();
  }

  const records = root.canvasInputs;
  const rootInput = [...records.values()].find(
    (input) => input.parentId === "catalog:root",
  )!;
  const relative = root.getGeometry(records.keys());
  const absolute = new Map<string, Rect>();
  const place = (id: string, parentX: number, parentY: number) => {
    const rect = relative.get(id);
    if (!rect) return;
    const x = parentX + rect.x;
    const y = parentY + rect.y;
    absolute.set(id, { x, y, width: rect.width, height: rect.height });
    for (const child of records.get(id)?.children ?? []) place(child, x, y);
  };
  place(rootInput.id, 0, 0);

  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden`;
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
  await new Promise((resolve) => setTimeout(resolve, 100));
  const origin = host.getBoundingClientRect();
  const elementOf = (id: string): HTMLElement | null =>
    host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
  const inList = (id: string): boolean => {
    for (let at = records.get(id); at; at = records.get(at.parentId))
      if (root.typeOf(at) === "Timeline") return true;
    return false;
  };
  const differences: unknown[] = [];
  const rows: unknown[] = [];
  let itemCount = 0;
  let textCount = 0;
  for (const [id, record] of records) {
    if (!inList(id)) continue;
    const type = root.typeOf(record);
    const name = `${type}:${id.split(":").slice(-2).join(":").slice(-28)}`;
    const element = elementOf(id);
    const canvas = absolute.get(id);
    // (An item's date · description Text is there only while it has text — `presentWhen`.)
    const canvasShown = catalogCanvasNodeData(root, id).visible !== false;
    const domShown =
      !!element &&
      getComputedStyle(element).display !== "none" &&
      element.getClientRects().length > 0;
    if (canvasShown !== domShown) {
      differences.push({ name, shown: { dom: domShown, canvas: canvasShown } });
      continue;
    }
    if (!domShown || !element || !canvas) continue;
    const box = element.getBoundingClientRect();
    const dom = {
      x: box.x - origin.x,
      y: box.y - origin.y,
      width: box.width,
      height: box.height,
    };
    const row: Record<string, unknown> = { name, dom, canvas };
    if (apart(dom, canvas) > 1)
      differences.push({ name, box: { dom, canvas } });
    if (type === "Text") {
      textCount += 1;
      const style = getComputedStyle(element);
      // biome-ignore lint/suspicious/noExplicitAny: SkiaNodeData read for the harness
      const data = catalogCanvasNodeData(root, id) as any;
      const domText = {
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
        color: rgba(style.color),
        tag: element.tagName.toLowerCase(),
      };
      const canvasText = {
        fontSize: data.text?.fontSize as number | undefined,
        fontWeight: (data.text?.fontWeight ?? 400) as number,
        color: floatRgba(data.text?.color),
        tag: domText.tag,
      };
      row.text = { dom: domText, canvas: canvasText };
      if (JSON.stringify(domText) !== JSON.stringify(canvasText))
        differences.push({ name, text: { dom: domText, canvas: canvasText } });
    }
    if (type === "TimelineItem") {
      itemCount += 1;
      const domItem = domChrome(element);
      const canvasItem = canvasChrome(root, id);
      row.chrome = { dom: domItem, canvas: canvasItem };
      for (const part of ["marker", "connector"] as const) {
        const a = domItem[part];
        const b = canvasItem[part];
        if (!a !== !b) {
          differences.push({ name, [part]: { dom: !!a, canvas: !!b } });
          continue;
        }
        if (!a || !b) continue;
        const { x, y, width, height, ...paintA } = a;
        const { x: bx, y: by, width: bw, height: bh, ...paintB } = b;
        if (
          apart(
            { x, y, width, height },
            { x: bx, y: by, width: bw, height: bh },
          ) > 1 ||
          JSON.stringify(paintA) !== JSON.stringify(paintB)
        )
          differences.push({ name, [part]: { dom: a, canvas: b } });
      }
    }
    rows.push(row);
  }
  reactRoot.unmount();
  host.remove();
  return {
    key: fixture.key,
    differences,
    rows,
    sceneDifferences,
    sceneStatus,
    itemCount,
    textCount,
  };
}

/**
 * Chrome alone against the rule's text (written out by hand): item boxes in the list's box, the
 * marker and the connector in the item's box. Half a pixel. M: title 14 / 18, date 12 at the same
 * line ratio (18 ÷ 14 — the item's `line-height` is relative: 12 × 18 / 14 = 15.43), text gap 2,
 * marker 12 (top (18 − 12) ÷ 2 = 3), marker gap 12, spacing 16, connector 2 · 4 from the markers.
 */
const DATE_LINE = (12 * 18) / 14;
const DATED = 18 + 2 + DATE_LINE + 16; // 51.43 — a vertical item with a date
const EXPECTED: Record<
  string,
  {
    items: Record<number, Partial<Rect>>;
    marker: Record<number, Rect>;
    connector: Record<number, Rect | null>;
  }
> = {
  // Items 0 · 1 dated, item 2 (no date) 18 + 16 = 34. The connector from 3 + 12 + 4 = 19 to the next
  // marker (next top + 3) − 4: DATED − 19 − 1.
  "vertical-M-end": {
    items: {
      0: { x: 0, y: 0, width: 400, height: DATED },
      1: { x: 0, y: DATED, width: 400, height: DATED },
      2: { x: 0, y: DATED * 2, width: 400, height: 34 },
    },
    marker: { 0: { x: 0, y: 3, width: 12, height: 12 } },
    connector: { 0: { x: 5, y: 19, width: 2, height: DATED - 20 }, 2: null },
  },
  "vertical-M-start": {
    items: { 1: { x: 0, y: DATED, width: 400, height: DATED } },
    marker: { 1: { x: 388, y: 3, width: 12, height: 12 } },
    connector: { 1: { x: 393, y: 19, width: 2, height: DATED - 20 }, 2: null },
  },
  // Half the list each: the first on the right (after the line), the second on the left.
  "vertical-M-alternate": {
    items: {
      0: { x: 200, y: 0, width: 200, height: DATED },
      1: { x: 0, y: DATED, width: 200, height: DATED },
    },
    marker: {
      0: { x: -6, y: 3, width: 12, height: 12 },
      1: { x: 194, y: 3, width: 12, height: 12 },
    },
    connector: {
      0: { x: -1, y: 19, width: 2, height: DATED - 20 },
      1: { x: 199, y: 19, width: 2, height: DATED - 20 },
      2: null,
    },
  },
  // 600 ÷ 3 = 200 an item; 12 + 12 + 18 + 2 + 15.43 = 59.43 (the last 42). The connector 4 after the
  // marker to 4 before the item's end: 200 − 16 − 4 = 180, on the marker's middle.
  "horizontal-M-end": {
    items: {
      0: { x: 0, y: 0, width: 200, height: 24 + 20 + DATE_LINE },
      2: { x: 400, y: 0, width: 200, height: 42 },
    },
    marker: { 0: { x: 0, y: 0, width: 12, height: 12 } },
    connector: { 0: { x: 16, y: 5, width: 180, height: 2 }, 2: null },
  },
  // Before the line: the markers at the items' bottoms, on one line (the list aligns their ends).
  "horizontal-M-start": {
    items: {
      0: { x: 0, y: 0, width: 200, height: 44 + DATE_LINE },
      2: { x: 400, y: 2 + DATE_LINE, width: 200, height: 42 },
    },
    marker: {
      0: { x: 0, y: 32 + DATE_LINE, width: 12, height: 12 },
      2: { x: 0, y: 30, width: 12, height: 12 },
    },
    connector: {
      0: { x: 16, y: 37 + DATE_LINE, width: 180, height: 2 },
      2: null,
    },
  },
  // (Horizontal draws `alternate` as `end`.)
  "horizontal-M-alternate": {
    items: { 1: { x: 200, y: 0, width: 200, height: 44 + DATE_LINE } },
    marker: { 1: { x: 0, y: 0, width: 12, height: 12 } },
    connector: { 1: { x: 16, y: 5, width: 180, height: 2 } },
  },
};

describe("ADR-323 G2 — Timeline Canvas ↔ Preview DOM", () => {
  for (const fixture of FIXTURES)
    it(fixture.key, async () => {
      const result = await compare(fixture);
      report.push(result);
      // (Vacuity guard: every item and at least its title were read on both sides.)
      expect(result.itemCount).toBe(fixture.items.length);
      expect(result.textCount).toBeGreaterThanOrEqual(fixture.items.length);
      expect(result.differences).toEqual([]);
      expect(result.sceneDifferences).toEqual([]);
      if (fixture.after || fixture.afterItem)
        expect(result.sceneStatus).toBe("patched");
      const expected = EXPECTED[fixture.key];
      if (!expected) return;
      // biome-ignore lint/suspicious/noExplicitAny: report rows read back
      const rows = result.rows as any[];
      const listBox = rows.find((row) => row.name.startsWith("Timeline:")).dom;
      const itemRows = rows.filter((row) =>
        row.name.startsWith("TimelineItem:"),
      );
      const near = (got: number, want: number, what: string) =>
        expect(
          Math.abs(got - want),
          `${fixture.key} ${what}`,
        ).toBeLessThanOrEqual(0.5);
      for (const [index, want] of Object.entries(expected.items)) {
        const got = itemRows[Number(index)].dom as Rect;
        for (const [key, value] of Object.entries(want))
          near(
            got[key as keyof Rect] -
              (key === "x" ? listBox.x : key === "y" ? listBox.y : 0),
            value as number,
            `item ${index} ${key}`,
          );
      }
      for (const [index, want] of Object.entries(expected.marker)) {
        const got = itemRows[Number(index)].chrome.dom.marker as Rect;
        for (const key of ["x", "y", "width", "height"] as const)
          near(got[key], want[key], `marker ${index} ${key}`);
      }
      for (const [index, want] of Object.entries(expected.connector)) {
        const got = itemRows[Number(index)].chrome.dom.connector as
          Rect | undefined;
        if (want === null) {
          expect(got, `${fixture.key} connector ${index}`).toBeUndefined();
          continue;
        }
        for (const key of ["x", "y", "width", "height"] as const)
          near(got![key], want[key], `connector ${index} ${key}`);
      }
    });
});
