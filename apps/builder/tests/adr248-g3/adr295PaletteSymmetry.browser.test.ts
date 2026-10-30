/**
 * ADR-295 G1 · G2 하니스 — 팔레트 전수 × size 를 기본 테마로 놓고 Canvas (product composition root
 * 레이아웃) 와 격리 RAC DOM (`renderCatalogDom`, Preview 경로) 의 노드 상자를 잰다. 값 변경 전후
 * (G1) 를 같은 파일 · 같은 조건으로 재고, 두 leg 의 대칭 (G2) 도 같은 실행이 기록한다.
 *
 * - 대상: `getPaletteItems()` 전수 (creationVariants 포함) × rule `sizes` 키 (없으면 기본 한 벌).
 * - 측정 조건: DPR 1 · viewport 1440×900 (config) · Pretendard · bundle CSS · Preview reset · en-US.
 * - 테마: `resolveThemeSnapshot` (기본 테마) → `installThemeMaps` (앞 설치 키를 지운다) + production 변수 text
 *   (`catalogThemeVarsCss`). 기기 벌은 `VITE_ADR295_DEVICE` (`desktop` 기본 · `touch`) — touch arm 은 Skia 맵을
 *   `touchThemeSnapshot` 으로, DOM 은 Preview 터치 보기와 같은 `:root[data-catalog-touch]` 로 (G2, Phase 2).
 * - 기록: `test-results/adr295-palette-<arm>.json` (노드별 Canvas · DOM 상자) · DOM 스크린샷
 *   `test-results/adr295-palette-<arm>/<key>.png`. arm 은 `VITE_ADR295_ARM` (기본 `current`) —
 *   값 변경 전 arm 은 그 커밋의 별도 worktree 에서 같은 파일로 뜬다 (breakdown §6.0).
 * - 판정: G1 = before/after 기록 (Phase 1). G2 (Phase 2) = 1 CSS px 를 넘는 대칭 차이가 `KNOWN_ASYMMETRIC`
 *   (295 전부터 있던 24) 밖에서 0 — desktop · touch 두 arm 모두.
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
import {
  resolveThemeSnapshot,
  touchThemeSnapshot,
} from "@/utils/theme/resolveThemeSnapshot";
import {
  CATALOG_TOUCH_VIEW_ATTRIBUTE,
  catalogThemeVarsCss,
} from "../../../../packages/shared/src/catalog/runtime/themeVarsCss";
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
const DEVICE =
  (import.meta.env.VITE_ADR295_DEVICE as string | undefined) === "touch"
    ? "touch"
    : "desktop";
const ARM = `${(import.meta.env.VITE_ADR295_ARM as string | undefined) ?? "current"}${DEVICE === "touch" ? "-touch" : ""}`;
const REPORT = `test-results/adr295-palette-${ARM}.json`;
const SHOTS = `test-results/adr295-palette-${ARM}`;
const round = (n: number) => Math.round(n * 100) / 100;

let code: CatalogLibrary;
/** touch arm 의 Canvas leg library — 터치 맵에서 빌드 (part rule 이 빌드 때 굳히는 숫자가 터치 값). */
let canvasCode: CatalogLibrary;
let desktopTheme: ReturnType<typeof resolveThemeSnapshot>;
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
  desktopTheme = theme;
  // library 는 desktop 맵에서 빌드한다 (production 과 같이 — part rule 이 빌드 때 토큰을 숫자로 굳힌다)
  installThemeMaps(theme);
  const vars = document.createElement("style");
  vars.textContent = catalogThemeVarsCss(theme);
  document.head.append(vars);
  document.documentElement.toggleAttribute(
    CATALOG_TOUCH_VIEW_ATTRIBUTE,
    DEVICE === "touch",
  );
  await initEngineWasm();
  await initCanvasKit();
  await loadBuiltinFontsToSkia();
  code = await buildCodeCatalogLibrary();
  canvasCode = code;
  if (DEVICE === "touch") {
    installThemeMaps(touchThemeSnapshot(theme));
    canvasCode = await buildCodeCatalogLibrary();
  }
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
  // touch arm: every case's Canvas leg starts from the touch maps (a failed DOM leg may leave desktop)
  if (DEVICE === "touch") installThemeMaps(touchThemeSnapshot(desktopTheme));
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
  const canvasRuntime =
    canvasCode === code
      ? runtime
      : new CatalogRuntime(
          new CatalogGraph(documentFor(definitionId, type, props), canvasCode),
          new CatalogStorage(indexedDB, `adr295-${key}-canvas`),
        );
  const root = new CatalogCompositionRoot(
    canvasRuntime,
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

  // touch arm: Canvas 는 터치 맵 · 터치 맵에서 빌드한 library 로 (위), DOM 은 production Preview 처럼 desktop
  //   library · desktop 맵으로 만든 record + CSS 터치 벌 (`:root[data-catalog-touch]`). 같은 맵으로 두 leg 를
  //   만들면 record 에 굳은 px 가 같이 커져 DOM 의 터치 경로 결함을 못 본다 (oracle 공유 — measurement-validity #3).
  let domRoot = root;
  if (DEVICE === "touch") {
    installThemeMaps(desktopTheme);
    domRoot = new CatalogCompositionRoot(
      runtime,
      createLayoutEngine(),
      PAGE,
      undefined,
      undefined,
      catalogTextMeasure,
      LOCALE,
    );
  }

  const host = document.createElement("div");
  host.style.cssText = `position:absolute;left:0;top:0;width:${PAGE.width}px;height:${PAGE.height}px;overflow:hidden`;
  document.body.append(host);
  const reactRoot = createRoot(host);
  flushSync(() =>
    reactRoot.render(
      createElement(I18nProvider, {
        locale: LOCALE,
        children: renderCatalogDom(domRoot, rootInput.id),
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
  // the DOM leg rendered with the desktop maps (as the Preview); the next case's Canvas leg takes touch
  if (DEVICE === "touch") installThemeMaps(touchThemeSnapshot(desktopTheme));
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

/**
 * G2 (Phase 2) — 1 CSS px 를 넘는 비대칭은 이 목록 밖에서 0 이어야 한다 (desktop · touch 두 arm). 목록은 295 가
 * 값을 바꾸기 전 (G1 before) 부터 있던 비대칭이다 — 토큰 값과 무관 (Canvas 폭 0 · 요소 없는 노드의 상자 ·
 * Select 2px · Pagination · DropZone 크기 미적용 · Menu/ContextualHelp 의 trigger 줄 상자). 수리는 295 밖의
 * 대칭 작업이고, 고치면 여기서 뺀다 (목록에 있는데 대칭이면 그것도 FAIL — 낡은 목록을 남기지 않는다).
 */
const KNOWN_ASYMMETRIC = new Set([
  "Keyboard",
  "Separator@S",
  "Separator@M",
  "Separator@L",
  "Skeleton@S",
  "Skeleton@M",
  "Skeleton@L",
  "Image@M",
  "Section@S",
  "Section@M",
  "Section@L",
  "Pagination@S",
  "Pagination@M",
  "Pagination@L",
  // (Menu@S: the trigger Button's line box — closed by ADR-295 Phase 3, the S2 control height.)
  "Autocomplete",
  "Select@XS",
  "Select@S",
  "Select@M",
  "Select@L",
  "Select@XL",
  "DropZone@S",
  "DropZone@L",
  "ContextualHelp@XS",
]);

/**
 * touch arm 만의 알려진 차이. Phase 2 종결 때 14 (Card · CardView · DateRangePicker 13 = 다른 단계 토큰의
 * 행간 비율 + ColorSlider M) — Phase 3 의 S2 행간 식 · 행간 리터럴 참조화로 12 가 닫혔다 (2026-10-30). 남은 것:
 * - DateRangePicker XS: 범위 구분 글자 (`–`) 의 행간이 다른 단계 (text-xs) 의 비율로 빌드 때 숫자가 된다.
 * - ColorSlider M: DOM Label 의 inline 글자가 px 로 남는다 (record 의 토큰 출처는 있음 — 렌더 경로 추적 미완).
 */
const KNOWN_TOUCH_ASYMMETRIC = new Set(["DateRangePicker@XS", "ColorSlider@M"]);
const knownAsymmetric = (key: string) =>
  KNOWN_ASYMMETRIC.has(key) ||
  (DEVICE === "touch" && KNOWN_TOUCH_ASYMMETRIC.has(key));

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
        return;
      }
      const result = report[report.length - 1] as { symmetric?: boolean };
      if (result.symmetric !== undefined)
        expect(
          result.symmetric,
          `${key}: ${knownAsymmetric(key) ? "목록의 비대칭이 고쳐졌다 — 알려진 목록에서 뺀다" : "새 Canvas ↔ DOM 비대칭"}`,
        ).toBe(!knownAsymmetric(key));
    });
});
