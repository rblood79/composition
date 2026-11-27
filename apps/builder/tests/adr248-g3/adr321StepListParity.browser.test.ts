/**
 * ADR-321 G1 — StepList · Step, Canvas ↔ Preview DOM (HC3: 같은 작성 값에서 표식 · 선 · 글자 상자가
 * ±1 px). Each fixture is a hand-made StepList of Step origin instances (`component-step` — the
 * document shape the palette places) laid out by the product composition root and drawn by the
 * Preview's DOM renderer (`renderCatalogDom` — `ol > li`, the generated Step · StepList sheets) in the
 * same environment. The DOM is the independent arm: Chrome resolves the Step rule's selectors
 * (`calc` · `lh` · the `--icon-size` variables) on its own boxes; the Canvas arm is the engine's
 * rects plus the scene's shapes (`catalogCanvasNodeData` — what the Canvas draws, not a recomputation).
 *
 * Read per drawn node: the list's · a step's · a Text's box (engine rect vs `getBoundingClientRect`),
 * a Text's font size · weight · color, the step's visual (box · fill · border color · its number or
 * check) and its track (box · color; none on the last step).
 *
 * Fixtures (ADR Gates 의 입력 차원): 방향 둘 · 크기 넷 · 강조 · 단계 수 2 · 5 · 9 · 긴 라벨 줄바꿈 · 설명
 * 유무 · 비활성 (목록 · 단계) · 시작 값 없음, and the incremental arm (the list's keys · orientation ·
 * size written after the build — a missed dependent shows as a scene difference).
 *
 * A second gate reads Chrome alone against values written out by hand from the rule (`EXPECTED`) —
 * two arms that agree on a wrong formula would pass the comparison.
 *
 * Conditions: Chrome (`channel: chrome`, headless), DPR 1, viewport 1440×900, light theme,
 * `visibilityState` visible, Pretendard file in both legs, en-US. Gate: every box ≤ 1 CSS px, every
 * paint value equal. Report: `test-results/adr321-steplist-parity.json`.
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
const REPORT = "test-results/adr321-steplist-parity.json";
const set = <T>(value: T) => ({ kind: "set" as const, value });
const LIST = "project:node:list";
const BODY = "project:node:body";
const report: unknown[] = [];
let code: CatalogLibrary;

type StepSpec = {
  label: string;
  description?: string;
  isDisabled?: boolean;
};
type Fixture = {
  key: string;
  width: number;
  list: Record<string, unknown>;
  /** Authored box values of the list (its DOM box is RAC Group — the `ol` inside takes them). */
  box?: Record<string, unknown>;
  steps: StepSpec[];
  /** Writes executed after the build (the incremental arm) — the list's props. */
  after?: Record<string, unknown>;
};

const LABELS = [
  "Account",
  "Shipping",
  "Payment",
  "Review",
  "Done",
  "Survey",
  "Invite",
  "Upgrade",
  "Share",
];
const steps = (
  count: number,
  extra: (i: number) => Partial<StepSpec> = () => ({}),
) =>
  Array.from({ length: count }, (_, i) => ({ label: LABELS[i]!, ...extra(i) }));
const LONG = [
  "Tell us about your organization and its members",
  "Shipping",
  "Choose a payment method and a billing address",
  "Review",
  "Done",
];
const start = (current: number, last: number) => ({
  defaultSelectedKey: `s${current}`,
  ...(last > 0 ? { defaultLastCompletedStep: `s${last}` } : {}),
});

const AUTHORED_BOX = {
  gap: 12,
  paddingTop: 10,
  paddingRight: 10,
  paddingBottom: 10,
  paddingLeft: 10,
  height: "120px",
};

const FIXTURES: Fixture[] = [
  // 방향 × 크기 (단계 5 — 완료 2 · 현재 · 남음 2)
  ...(["S", "M", "L", "XL"] as const).flatMap((size) => [
    {
      key: `horizontal-${size}-5`,
      width: 720,
      list: { size, ...start(3, 2) },
      steps: steps(5),
    },
    {
      key: `vertical-${size}-5`,
      width: 240,
      list: { size, orientation: "vertical", ...start(3, 2) },
      steps: steps(5),
    },
  ]),
  // 단계 수 2 · 9
  { key: "horizontal-M-2", width: 320, list: start(2, 1), steps: steps(2) },
  { key: "horizontal-M-9", width: 1080, list: start(5, 4), steps: steps(9) },
  {
    key: "vertical-M-9",
    width: 240,
    list: { orientation: "vertical", ...start(5, 4) },
    steps: steps(9),
  },
  // 강조
  {
    key: "horizontal-M-emphasized",
    width: 720,
    list: { isEmphasized: true, ...start(3, 2) },
    steps: steps(5),
  },
  {
    key: "vertical-L-emphasized",
    width: 240,
    list: {
      size: "L",
      orientation: "vertical",
      isEmphasized: true,
      ...start(3, 2),
    },
    steps: steps(5),
  },
  // 긴 라벨 줄바꿈 (단계마다 줄 수가 다르다 — 표식이 한 줄에 서야 한다)
  {
    key: "horizontal-M-long-labels",
    width: 560,
    list: start(3, 2),
    steps: LONG.map((label) => ({ label })),
  },
  {
    key: "vertical-M-long-labels",
    width: 180,
    list: { orientation: "vertical", ...start(3, 2) },
    steps: LONG.map((label) => ({ label })),
  },
  // 설명 유 · 무 섞임
  {
    key: "horizontal-M-descriptions",
    width: 720,
    list: start(2, 1),
    steps: steps(4, (i) =>
      i % 2 === 0 ? { description: "A short line about this step" } : {},
    ),
  },
  {
    key: "vertical-XL-descriptions",
    width: 280,
    list: { size: "XL", orientation: "vertical", ...start(2, 1) },
    steps: steps(4, (i) =>
      i !== 1 ? { description: "A short line about this step" } : {},
    ),
  },
  // 비활성 — 목록 전체 · 단계 하나 · disabledKeys
  {
    key: "horizontal-M-list-disabled",
    width: 720,
    list: { isDisabled: true, isEmphasized: true, ...start(3, 2) },
    steps: steps(5),
  },
  {
    key: "horizontal-M-step-disabled",
    width: 720,
    list: { disabledKeys: ["s4"], ...start(3, 2) },
    steps: steps(5, (i) => (i === 0 ? { isDisabled: true } : {})),
  },
  // 시작 값 없음 (첫 단계가 현재)
  { key: "horizontal-M-no-start", width: 480, list: {}, steps: steps(3) },
  // 목록에 작성한 상자 값 (gap · padding · 높이) — DOM 의 목록 상자는 RAC Group 이고 단계는 그 안 `ol` 의
  // 자식이다. 작성값이 단계 배치에 그대로 닿아야 한다.
  {
    key: "horizontal-M-authored-box",
    width: 720,
    list: start(3, 2),
    box: AUTHORED_BOX,
    steps: steps(5),
  },
  {
    key: "vertical-M-authored-box",
    width: 240,
    list: { orientation: "vertical", ...start(3, 2) },
    box: { ...AUTHORED_BOX, height: "400px" },
    steps: steps(5),
  },
  // 증분 — 놓은 뒤 목록의 값만 바꾼다
  {
    key: "incremental-keys",
    width: 720,
    list: start(2, 1),
    steps: steps(5),
    after: start(4, 3),
  },
  {
    key: "incremental-orientation",
    width: 320,
    list: start(3, 2),
    steps: steps(4),
    after: { orientation: "vertical" },
  },
  {
    key: "incremental-size-emphasis",
    width: 720,
    list: start(3, 2),
    steps: steps(5),
    after: { size: "XL", isEmphasized: true },
  },
];

function documentFor(fixture: Fixture): CatalogDocument {
  const projectId = "project:project:adr321-g1";
  const pageId = "project:page:adr321-g1";
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
  const stepIds = fixture.steps.map((step, index) =>
    node(`project:node:s${index + 1}`, "lib:definition:origin-component-step", {
      id: `s${index + 1}`,
      label: step.label,
      ...(step.description ? { description: step.description } : {}),
      ...(step.isDisabled ? { isDisabled: true } : {}),
    }),
  );
  node(LIST, "lib:definition:type-StepList", fixture.list, stepIds, {
    width: `${fixture.width}px`,
    ...fixture.box,
  });
  node(BODY, "lib:definition:type-body", {}, [LIST]);
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 81,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "adr321",
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
  visual?: Rect & { fill: string; border: string; glyph: string };
  track?: Rect & { fill: string };
};

/** What the Canvas scene draws in a Step's box (`catalogCanvasNodeData` children): visual · track. */
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
  const visual = painted.find(
    (shape) => shape.width === shape.height && shape.box?.borderRadius > 0,
  );
  const track = painted.find((shape) => shape !== visual);
  const text = shapes.find((shape) => shape.type === "text");
  const icon = shapes.find((shape) => shape.iconPath || shape.type === "icon");
  const rect = (shape: Rect): Rect => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  });
  return {
    ...(visual
      ? {
          visual: {
            ...rect(visual),
            fill: floatRgba(visual.box?.fillColor),
            border: floatRgba(visual.box?.strokeColor),
            glyph: text ? String(text.text?.content) : icon ? "check" : "",
          },
        }
      : {}),
    ...(track
      ? { track: { ...rect(track), fill: floatRgba(track.box?.fillColor) } }
      : {}),
  };
}

/** The same reading of the DOM step: its `span.step-visual` · `span.step-track`, in the step's box. */
function domChrome(step: HTMLElement): Chrome {
  const origin = step.getBoundingClientRect();
  const within = (element: Element): Rect => {
    const box = element.getBoundingClientRect();
    return {
      x: box.x - origin.x,
      y: box.y - origin.y,
      width: box.width,
      height: box.height,
    };
  };
  const visual = step.querySelector<HTMLElement>(
    ":scope > .step-link > .step-visual",
  );
  const track = step.querySelector<HTMLElement>(":scope > .step-track");
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
    ...(visual
      ? {
          visual: {
            ...within(visual),
            ...paint(visual),
            glyph: visual.querySelector("svg")
              ? "check"
              : (visual.textContent ?? ""),
          },
        }
      : {}),
    ...(track ? { track: { ...within(track), fill: paint(track).fill } } : {}),
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
    new CatalogStorage(indexedDB, `adr321-g1-${fixture.key}`),
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
  // The scene arm: an incremental arm's Canvas scene is bound before the change and patched after
  // it; it must equal a fresh bind (a missed dependent keeps the old state · place).
  const scene = fixture.after
    ? bindCatalogCanvas(root, [sceneRoot])
    : undefined;
  if (fixture.after)
    root.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        props: Object.fromEntries(
          Object.entries(fixture.after).map(([key, value]) => [
            key,
            set(value),
          ]),
        ),
      } as never),
    );
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
      if (root.typeOf(at) === "StepList") return true;
    return false;
  };
  const differences: unknown[] = [];
  const rows: unknown[] = [];
  let stepCount = 0;
  let textCount = 0;
  for (const [id, record] of records) {
    if (!inList(id)) continue;
    const type = root.typeOf(record);
    const name = `${type}:${id.split(":").slice(-2).join(":").slice(-28)}`;
    const element = elementOf(id);
    const canvas = absolute.get(id);
    // (A Step's description Text is there only while it has text — `presentWhen`: hidden on the
    //  Canvas and absent from the DOM. Shown on one side only is a difference.)
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
      };
      const canvasText = {
        fontSize: data.text?.fontSize as number | undefined,
        fontWeight: (data.text?.fontWeight ?? 400) as number,
        color: floatRgba(data.text?.color),
      };
      row.text = { dom: domText, canvas: canvasText };
      if (JSON.stringify(domText) !== JSON.stringify(canvasText))
        differences.push({ name, text: { dom: domText, canvas: canvasText } });
    }
    if (type === "Step") {
      stepCount += 1;
      const domStep = domChrome(element);
      const canvasStep = canvasChrome(root, id);
      row.chrome = { dom: domStep, canvas: canvasStep };
      for (const part of ["visual", "track"] as const) {
        const a = domStep[part];
        const b = canvasStep[part];
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
    stepCount,
    textCount,
  };
}

/**
 * Chrome alone against the rule's text (written out by hand): step boxes in the list's box, the
 * visual and the track in the step's box. Half a pixel.
 */
const EXPECTED: Record<
  string,
  {
    steps: Record<number, Partial<Rect>>;
    visual: Record<number, Rect>;
    track: Record<number, Rect | null>;
  }
> = {
  // 720 ÷ 5 = 144 per step. M: label line 18 + (gap 6 + visual 16) = 40 high. Visual at the bottom
  // left; track 4 after it, ends 4 before the step's end: 144 − 16 − 8 = 120, on the visual's middle.
  "horizontal-M-5": {
    steps: {
      0: { x: 0, y: 0, width: 144, height: 40 },
      2: { x: 288, width: 144, height: 40 },
      4: { x: 576, width: 144, height: 40 },
    },
    visual: { 0: { x: 0, y: 24, width: 16, height: 16 } },
    track: { 0: { x: 20, y: 31, width: 120, height: 2 }, 4: null },
  },
  // XL: label line 22 + (6 + 32) = 60 high; track on the visual's middle (28 + 15).
  "horizontal-XL-5": {
    steps: { 1: { x: 144, y: 0, width: 144, height: 60 } },
    visual: { 1: { x: 0, y: 28, width: 32, height: 32 } },
    track: { 1: { x: 36, y: 43, width: 104, height: 2 }, 4: null },
  },
  // Vertical M: each step is its minimum 40 high (visual 16 + 24), full width; the visual sits 1
  // down (line 18 − 16, halved); the track 4 under it to 3 above the step's end.
  "vertical-M-5": {
    steps: {
      0: { x: 0, y: 0, width: 240, height: 40 },
      3: { x: 0, y: 120, width: 240, height: 40 },
    },
    visual: { 0: { x: 0, y: 1, width: 16, height: 16 } },
    track: { 0: { x: 7, y: 21, width: 2, height: 16 }, 4: null },
  },
  // Vertical S: the 8 dot sits 4 down (line 16 − 8, halved); minimum 32.
  "vertical-S-5": {
    steps: { 1: { x: 0, y: 32, width: 240, height: 32 } },
    visual: { 1: { x: 0, y: 4, width: 8, height: 8 } },
    track: { 1: { x: 3, y: 16, width: 2, height: 16 }, 4: null },
  },
  // Authored on the list: padding 10 · gap 12 · height 120. Content 700 wide — less four gaps = 652,
  // ÷ 5 = 130.4 a step, 142.4 apart; the steps sit at the content's bottom (100 − 40 = 60 down).
  "horizontal-M-authored-box": {
    steps: {
      0: { x: 10, y: 70, width: 130.4, height: 40 },
      2: { x: 294.8, y: 70, width: 130.4, height: 40 },
      4: { x: 579.6, y: 70, width: 130.4, height: 40 },
    },
    visual: { 0: { x: 0, y: 24, width: 16, height: 16 } },
    // (The track ends 4 before the step's end: 130.4 − 16 − 8.)
    track: { 0: { x: 20, y: 31, width: 106.4, height: 2 }, 4: null },
  },
  // Vertical: content 220 wide; each step its minimum 40, 52 apart from the padding's 10.
  "vertical-M-authored-box": {
    steps: {
      0: { x: 10, y: 10, width: 220, height: 40 },
      1: { x: 10, y: 62, width: 220, height: 40 },
      4: { x: 10, y: 218, width: 220, height: 40 },
    },
    visual: { 1: { x: 0, y: 1, width: 16, height: 16 } },
    track: { 1: { x: 7, y: 21, width: 2, height: 16 }, 4: null },
  },
  // Vertical XL: the text sits 5 down (visual 32 − line 22, halved); minimum 56.
  "vertical-XL-descriptions": {
    // (Step 0 holds a description line of 16 at the step's line ratio 22 / 18: 5 + 22 + 19.6 + 8 =
    //  54.6 — under its minimum 56.)
    steps: { 1: { x: 0, y: 56, width: 280, height: 56 } },
    visual: { 1: { x: 0, y: 0, width: 32, height: 32 } },
    track: { 1: { x: 15, y: 36, width: 2, height: 16 }, 3: null },
  },
};

describe("ADR-321 G1 — StepList Canvas ↔ Preview DOM", () => {
  for (const fixture of FIXTURES)
    it(fixture.key, async () => {
      const result = await compare(fixture);
      report.push(result);
      // (Vacuity guard: every step and at least its label were read on both sides.)
      expect(result.stepCount).toBe(fixture.steps.length);
      expect(result.textCount).toBeGreaterThanOrEqual(fixture.steps.length);
      expect(result.differences).toEqual([]);
      expect(result.sceneDifferences).toEqual([]);
      if (fixture.after) expect(result.sceneStatus).toBe("patched");
      const expected = EXPECTED[fixture.key];
      if (!expected) return;
      // biome-ignore lint/suspicious/noExplicitAny: report rows read back
      const rows = result.rows as any[];
      const listBox = rows.find((row) => row.name.startsWith("StepList")).dom;
      const stepRows = rows.filter((row) => row.name.startsWith("Step:"));
      const near = (got: number, want: number, what: string) =>
        expect(
          Math.abs(got - want),
          `${fixture.key} ${what}`,
        ).toBeLessThanOrEqual(0.5);
      for (const [index, want] of Object.entries(expected.steps)) {
        const got = stepRows[Number(index)].dom as Rect;
        for (const [key, value] of Object.entries(want))
          near(
            got[key as keyof Rect] -
              (key === "x" ? listBox.x : key === "y" ? listBox.y : 0),
            value as number,
            `step ${index} ${key}`,
          );
      }
      for (const [index, want] of Object.entries(expected.visual)) {
        const got = stepRows[Number(index)].chrome.dom.visual as Rect;
        for (const key of ["x", "y", "width", "height"] as const)
          near(got[key], want[key], `visual ${index} ${key}`);
      }
      for (const [index, want] of Object.entries(expected.track)) {
        const got = stepRows[Number(index)].chrome.dom.track as
          Rect | undefined;
        if (want === null) {
          expect(got, `${fixture.key} track ${index}`).toBeUndefined();
          continue;
        }
        for (const key of ["x", "y", "width", "height"] as const)
          near(got![key], want[key], `track ${index} ${key}`);
      }
    });
});
