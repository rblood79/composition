/**
 * ADR-295 G1 · G2 하니스 — 팔레트 전수 × size 를 기본 테마로 놓고 Canvas (product composition root
 * 레이아웃) 와 격리 RAC DOM (`renderCatalogDom`, Preview 경로) 의 노드 상자를 잰다. 값 변경 전후
 * (G1) 를 같은 파일 · 같은 조건으로 재고, 두 leg 의 대칭 (G2) 도 같은 실행이 기록한다.
 *
 * - 대상: `getPaletteItems()` 전수 (creationVariants 포함) × rule `sizes` 키 (없으면 기본 한 벌).
 * - 측정 조건: DPR 1 · viewport 1440×900 (config) · Pretendard · bundle CSS · Preview reset · en-US.
 * - 테마: `resolveThemeSnapshot` (기본 테마) → `installThemeMaps` (앞 설치 키를 지운다) + `:root` 변수.
 * - 기록: `test-results/adr295-palette-<arm>.json` (노드별 Canvas · DOM 상자) · DOM 스크린샷
 *   `test-results/adr295-palette-<arm>/<key>.png`. arm 은 `VITE_ADR295_ARM` (기본 `current`) —
 *   값 변경 전 arm 은 그 커밋의 별도 worktree 에서 같은 파일로 뜬다 (breakdown §6.0).
 * - 판정: 이 단계는 측정이다 (G1 = before/after 기록 · 사용자 confirm). 1 CSS px 를 넘는 대칭 차이는
 *   보고에 남기고, G2 (Phase 2) 가 이 목록을 게이트로 바꾼다.
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
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { loadBuiltinFontsToSkia } from "@/builder/fonts/loadCustomFontsToSkia";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import {
  catalogCreationProps,
  catalogCreationStyle,
  catalogPaletteDefinitionId,
} from "@/builder/catalogRuntime/paletteInsert";
import { getPaletteItems } from "@/builder/panels/components/paletteItems";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { COMPONENT_RULES_TABLE } from "../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { installThemeMaps } from "../../../../packages/shared/src/catalog/runtime/themeMaps";
import {
  catalogSubpartDomSelectors,
  catalogSubpartDomUnion,
} from "../../../../packages/shared/src/catalog/document/rulePartRules";
import type {
  CatalogDocument,
  CatalogLibrary,
  DefinitionId,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";

type Rect = { x: number; y: number; width: number; height: number };
const PAGE = { width: 1440, height: 900 };
const LOCALE = "en-US";
const ARM =
  (import.meta.env.VITE_ADR295_ARM as string | undefined) ?? "current";
const REPORT = `test-results/adr295-palette-${ARM}.json`;
const SHOTS = `test-results/adr295-palette-${ARM}`;
const round = (n: number) => Math.round(n * 100) / 100;

let code: CatalogLibrary;
const report: unknown[] = [];

/** 팔레트 항목 × size — key 는 arm 사이에서 같아야 before/after 를 짝짓는다. */
const CASES = getPaletteItems().flatMap((item) => {
  const type = item.componentType ?? item.type;
  const sizes = Object.keys(
    (COMPONENT_RULES_TABLE as Record<string, { sizes?: object }>)[type]
      ?.sizes ?? {},
  );
  const props = { ...(item.initialProps ?? {}) } as Record<string, unknown>;
  if (sizes.length < 2) return [{ key: item.type, type, props }];
  return sizes.map((size) => ({
    key: `${item.type}@${size}`,
    type,
    props: { ...props, size },
  }));
});

/** 팔레트 삽입과 같은 값 — `catalogCreationProps` (초기 props · 기본값과 다른 것만) · `catalogCreationStyle`. */
function documentFor(
  definitionId: DefinitionId,
  type: string,
  initialProps: Record<string, unknown>,
): CatalogDocument {
  const projectId = "project:project:adr295" as const;
  const pageId = "project:page:main" as const;
  const style = catalogCreationStyle(initialProps);
  const node: NodeEntry = {
    kind: "node",
    id: "project:node:subject" as NodeEntry["id"],
    definitionId,
    children: [],
    props: catalogCreationProps(
      code,
      definitionId as never,
      type,
      initialProps,
    ) as NodeEntry["props"],
    visual: style.visual,
    sizing: style.sizing,
    layout: {
      ...(style.layout ?? {}),
      position: { kind: "set", value: "absolute" },
      insetLeft: { kind: "set", value: "30px" },
      insetTop: { kind: "set", value: "30px" },
    },
    descendantOverrides: [],
  };
  return {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: code.contractVersion ?? 52,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "adr295",
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
        name: "Main",
        route: "/",
        children: [node.id],
      },
      [node.id]: node,
    },
  };
}

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
  await commands.writeFile(
    REPORT,
    `${JSON.stringify({ arm: ARM, cases: report }, null, 1)}\n`,
  );
});

async function measure(
  key: string,
  type: string,
  initial: Record<string, unknown>,
) {
  let props = initial;
  const definitionId = catalogPaletteDefinitionId(code, type) as DefinitionId;
  // rule 에 sizes 가 있어도 문서가 `size` 를 받지 않는 type (Text · Image · Slot …) 은 기본 size 한 벌만
  //   잰다 (나머지 size 키는 같은 결과). 판정은 문서 검증 그대로 — origin 정의의 accepts 로는 못 가른다.
  let graph: CatalogGraph;
  try {
    graph = new CatalogGraph(documentFor(definitionId, type, props), code);
  } catch (error) {
    if (!("size" in props) || !String(error).includes("subject.size"))
      throw error;
    const fallback =
      (COMPONENT_RULES_TABLE as Record<string, { defaultSize?: string }>)[type]
        ?.defaultSize ?? "M";
    if (props.size !== fallback)
      return { key, type, skipped: "size-not-accepted" };
    props = { ...props };
    delete props.size;
    graph = new CatalogGraph(documentFor(definitionId, type, props), code);
  }
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr295-${key}`),
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
  const rootInput = [...root.canvasInputs.values()].find(
    (input) => input.parentId === "catalog:root",
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
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  const origin = host.getBoundingClientRect();
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
  // 보이지 않는 상자 (닫힌 overlay · 빈 Text) 는 찍지 않는다 — 실패는 기록만.
  let shot: string | null = null;
  const subjectRect = subject?.getBoundingClientRect();
  if (subject && subjectRect && subjectRect.width > 0 && subjectRect.height > 0)
    try {
      // `save: false` 면 base64 문자열을 그대로 돌려준다 (객체가 아니다).
      const png: unknown = await browserPage
        .elementLocator(subject)
        .screenshot({ base64: true, save: false, timeout: 3000 });
      const data =
        typeof png === "string" ? png : (png as { base64: string }).base64;
      if (!data || data.length < 100) throw new Error("SCREENSHOT_EMPTY");
      shot = `${SHOTS}/${key.replace(/[^\w@.-]/g, "_")}.png`;
      await commands.writeFile(shot, data, "base64");
    } catch {
      shot = null;
    }
  reactRoot.unmount();
  host.remove();
  return {
    key,
    type,
    props,
    maxDelta: round(worst),
    symmetric: worst <= 1,
    shot,
    nodes,
  };
}

describe(`ADR-295 palette × size — Canvas ↔ DOM (${ARM})`, () => {
  it("covers the whole palette", () => {
    expect(CASES.length).toBeGreaterThan(60);
  });
  for (const { key, type, props } of CASES)
    it(key, async () => {
      // 측정 단계 — 문서가 거부되는 조합 (size 를 받지 않는 type 등) 은 이유와 함께 기록한다.
      //   두 arm 이 같은 거부를 내면 짝이 맞고, 한 arm 만 거부하면 before/after 표에 드러난다.
      try {
        const result = await measure(key, type, props);
        report.push(result);
        if ("nodes" in result && result.nodes)
          expect(result.nodes.length).toBeGreaterThan(0);
      } catch (error) {
        report.push({ key, type, props, error: String(error) });
      }
    });
});
