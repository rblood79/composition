/**
 * Phase 0: Full-Tree WASM Layout (Batch Build)
 *
 * 레벨별 독립 Taffy 호출을 단일 WASM 호출로 통합.
 * DFS post-order로 전체 트리를 배치 배열로 변환 후
 * build_tree_batch() 1회 → compute_layout() 1회 → get_layouts_batch() 1회.
 *
 * @see ADR-005 Phase 0
 * @since 2026-02-28
 */

import type { CanvasLayoutNode } from "../layoutNode";
import { getFrameElementMirrorId } from "../../../../../adapters/canonical/frameMirror";
import type { ComputedLayout } from "./LayoutEngine";
import type { TaffyStyle } from "../../wasm-bindings/taffyLayout";
import { isRustWasmReady } from "../../wasm-bindings/rustWasm";
import { PersistentTaffyTree } from "./persistentTaffyTree";
import type { PersistentBatchNode } from "./persistentTaffyTree";
import {
  enrichWithIntrinsicSize,
  setTagGroupAllowsRemovingContext,
  applyCommonTaffyStyle,
  applyFlexItemProperties,
  parseMargin,
  parsePadding,
  parseBorder,
  calculateContentHeight,
  parseBoxModel,
  parseCSSPropWithContext,
  measureTextWidth,
} from "./utils";
import { resolveStyle, getRootComputedStyle } from "./cssResolver";
import type { ComputedStyle } from "./cssResolver";
import {
  toTaffyDisplay,
  blockifyDisplay,
  getElementDisplay,
  needsBlockChildFullWidth,
} from "./taffyDisplayAdapter";
import { elementToTaffyBlockStyle } from "./TaffyBlockEngine";
import { elementToTaffyStyle } from "./TaffyFlexEngine";
import { parseGridTemplate } from "./TaffyGridEngine";
import {
  applyImplicitStyles,
  resolveContainerStylesFallback,
} from "./implicitStyles";
import { resolvePropagatedProps } from "../../../../utils/propagationEngine";
import {
  getPropagationRules,
  getParentTagsForChild,
} from "../../../../utils/propagationRegistry";
import { extractSpecTextStyle } from "../../utils/specTextStyle";
import {
  InlineAlertSpec,
  fontFamily as specFontFamily,
} from "@composition/specs";
import { getNecessityIndicatorSuffix } from "@composition/shared/components";
import { useScrollState } from "../../../../stores/scrollState";

// ─── 모듈 수준 상수 ──────────────────────────────────────────────────

/** ADR-048: Label이 childPath인 부모 태그 Set (lazy, 1회 빌드) */
let labelDelegationParents: Set<string> | undefined;
function getLabelDelegationParents(): Set<string> | undefined {
  if (labelDelegationParents === undefined) {
    labelDelegationParents = getParentTagsForChild("Label") ?? undefined;
  }
  return labelDelegationParents;
}

/** flex/grid container 판별 집합 (CSS Blockification 적용 기준) */
const FLEX_GRID_DISPLAYS = new Set([
  "flex",
  "inline-flex",
  "grid",
  "inline-grid",
]);

/** traversePostOrder 최대 재귀 깊이 (ADR-006 P0-4) */
const MAX_TREE_DEPTH = 100;

/** Label DFS injection: size → fontSize/lineHeight 매핑 (LabelSpec 단일 소스) */
const LABEL_SIZE_STYLE: Record<
  string,
  { fontSize: number; lineHeight: string }
> = {
  xs: { fontSize: 10, lineHeight: "16px" },
  sm: { fontSize: 12, lineHeight: "16px" },
  md: { fontSize: 14, lineHeight: "20px" },
  lg: { fontSize: 16, lineHeight: "24px" },
  xl: { fontSize: 18, lineHeight: "28px" },
};

/** Label DFS injection: size delegation 대상 부모 태그 */
const LABEL_DELEGATION_PARENT_TAGS = new Set([
  "Switch",
  "Checkbox",
  "Radio",
  "CheckboxGroup",
  "RadioGroup",
  "TagGroup",
  "Select",
  "ComboBox",
  "SearchField",
  "TextField",
  "TextArea",
  "NumberField",
  "DateField",
  "TimeField",
  "ColorField",
  "Slider",
  "ProgressBar",
  "Meter",
  "DatePicker",
  "DateRangePicker",
]);

/** Label DFS injection: size 없이 상위로 통과하는 구조적 래퍼 태그 */
const LABEL_WRAPPER_TAGS = new Set([
  "Checkbox",
  "Radio",
  "CheckboxItems",
  "RadioItems",
]);

// ─── NaN/Infinity sanitize 유틸 (ADR-006 P0-2) ───────────────────────

const sanitizeStats = { count: 0 };
function sanitizeLayoutValue(v: number, fallback: number = 0): number {
  if (Number.isFinite(v)) return v;
  sanitizeStats.count++;
  return fallback;
}

// ─── 페이지별 PersistentTaffyTree ──────────────────────────────────

/**
 * 페이지별 Persistent Taffy 트리 맵.
 *
 * 멀티페이지 캔버스에서 각 페이지의 ElementsLayer가 독립적으로
 * calculateFullTreeLayout()을 호출하므로, 싱글톤 트리는
 * 마지막 페이지의 rootHandle만 남아 다른 페이지 레이아웃이 깨진다.
 *
 * pageId별로 별도의 PersistentTaffyTree를 유지하여 해결한다.
 */
const persistentTrees = new Map<string, PersistentTaffyTree>();

/**
 * Persistent 트리 리셋.
 *
 * 전체 트리 재구축이 필요한 경우 호출한다.
 * 특정 pageId를 전달하면 해당 페이지만, 생략하면 모든 페이지를 리셋한다.
 */
export function resetPersistentTree(pageId?: string): void {
  if (pageId) {
    const tree = persistentTrees.get(pageId);
    if (tree) {
      tree.reset();
      persistentTrees.delete(pageId);
    }
    // stale 레이아웃 제거
    publishLayoutMap(null, pageId);
    publishSyntheticElementsMap(null, pageId);
  } else {
    for (const tree of persistentTrees.values()) {
      tree.reset();
    }
    persistentTrees.clear();
    // 모든 페이지의 stale 레이아웃 제거
    for (const key of [..._perPageLayoutMaps.keys()]) {
      publishLayoutMap(null, key);
    }
    clearSyntheticElements();
  }
}

// ─── 공유 Layout Map (Phase 3: SkiaOverlay에서 접근) ────────────────
// Multi-page: 페이지별 저장 → 머지 읽기 패턴
// 각 페이지의 ElementsLayer가 독립적으로 publish 호출.
// 싱글톤이면 마지막 페이지 데이터만 남아 다른 페이지 렌더링 실패.

const _perPageLayoutMaps = new Map<string, Map<string, ComputedLayout>>();
let _sharedLayoutVersion = 0;
let _mergedLayoutMap: Map<string, ComputedLayout> | null = null;
let _mergedLayoutVersion = -1;

/** publishLayoutMap 이후 호출되는 리스너 (StoreRenderBridge 재동기화용) */
const _layoutPublishListeners = new Set<() => void>();

export function onLayoutPublished(cb: () => void): () => void {
  _layoutPublishListeners.add(cb);
  return () => _layoutPublishListeners.delete(cb);
}

/** fullTreeLayoutMap을 페이지 단위로 공유한다. */
export function publishLayoutMap(
  map: Map<string, ComputedLayout> | null,
  pageId?: string,
): void {
  const key = pageId ?? "__default__";
  if (map) {
    _perPageLayoutMaps.set(key, map);
  } else {
    _perPageLayoutMaps.delete(key);
  }
  _sharedLayoutVersion++;
  // Layout 발행 후 리스너 알림 (StoreRenderBridge 재동기화)
  for (const cb of _layoutPublishListeners) cb();
}

export function publishLayoutMapsBatch(
  updates: Array<{ key: string; map: Map<string, ComputedLayout> | null }>,
  deleteKeys: Iterable<string> = [],
): void {
  let touched = false;

  for (const key of deleteKeys) {
    _perPageLayoutMaps.delete(key);
    touched = true;
  }

  for (const { key, map } of updates) {
    if (map) {
      _perPageLayoutMaps.set(key, map);
    } else {
      _perPageLayoutMaps.delete(key);
    }
    touched = true;
  }

  if (!touched) return;
  _sharedLayoutVersion++;
  for (const cb of _layoutPublishListeners) cb();
}

/** 공유된 fullTreeLayoutMap 조회 (모든 페이지 머지, 버전 캐시) */
export function getSharedLayoutMap(): Map<string, ComputedLayout> | null {
  if (_perPageLayoutMaps.size === 0) return null;
  if (_mergedLayoutVersion === _sharedLayoutVersion) return _mergedLayoutMap;
  const merged = new Map<string, ComputedLayout>();
  for (const pageMap of _perPageLayoutMaps.values()) {
    for (const [k, v] of pageMap) merged.set(k, v);
  }
  _mergedLayoutMap = merged;
  _mergedLayoutVersion = _sharedLayoutVersion;
  return merged;
}

/** 공유 Layout Map 변경 버전 */
export function getSharedLayoutVersion(): number {
  return _sharedLayoutVersion;
}

// ─── 공유 Filtered Children Map (Fix 1: 트리 소스 일원화) ────────────
// Multi-page: 동일 페이지별 저장 패턴

const _perPageFilteredMaps = new Map<string, Map<string, string[]>>();
let _filteredVersion = 0;
let _mergedFilteredMap: Map<string, string[]> | null = null;
let _mergedFilteredVersion = -1;

function cloneFilteredChildrenMap(
  map: Map<string, string[]>,
): Map<string, string[]> {
  const clone = new Map<string, string[]>();
  for (const [key, childIds] of map) {
    clone.set(key, [...childIds]);
  }
  return clone;
}

/** filteredChildIdsMap을 페이지 단위로 공유 */
export function publishFilteredChildrenMap(
  map: Map<string, string[]> | null,
  pageId?: string,
): void {
  const key = pageId ?? "__default__";
  if (map) {
    _perPageFilteredMaps.set(key, map);
  } else {
    _perPageFilteredMaps.delete(key);
  }
  _filteredVersion++;
}

/** cache hit 경로에서 동일 key 의 filteredChildIdsMap 을 재발행하기 위한 조회 API */
export function getPublishedFilteredChildrenMap(
  pageId?: string,
): Map<string, string[]> | null {
  const key = pageId ?? "__default__";
  const map = _perPageFilteredMaps.get(key);
  return map ? cloneFilteredChildrenMap(map) : null;
}

// ─── 공유 Synthetic Elements Map ──────────────────────────────────
// Command Stream 경로에서 synthetic element를 조회할 수 있도록 root별로 공유.
// Tabs virtual Tab 처럼 layout pass 중 생성되는 element 는 elementsMap 에 없고
// filteredChildrenMap 에 id만 남으므로, layoutMap/filteredMap 과 같은 root key
// fallback으로 저장해야 multi-page/frame 렌더에서
// 마지막 root 의 synthetic children 만 남는 회귀를 막을 수 있다.
const _perPageSyntheticElementsMaps = new Map<
  string,
  Map<string, CanvasLayoutNode>
>();
let _activeSyntheticElementsMap: Map<string, CanvasLayoutNode> | null = null;
let _syntheticElementsVersion = 0;
let _mergedSyntheticElementsMap: Map<string, CanvasLayoutNode> | null = null;
let _mergedSyntheticElementsVersion = -1;

function cloneSyntheticElementsMap(
  map: ReadonlyMap<string, CanvasLayoutNode>,
): Map<string, CanvasLayoutNode> {
  return new Map(map);
}

function beginSyntheticElementsCollection(): void {
  _activeSyntheticElementsMap = new Map();
}

function publishCollectedSyntheticElements(rootKey: string): void {
  publishSyntheticElementsMap(
    _activeSyntheticElementsMap ?? new Map(),
    rootKey,
  );
  _activeSyntheticElementsMap = null;
}

export function publishSyntheticElementsMap(
  map: ReadonlyMap<string, CanvasLayoutNode> | null,
  pageId?: string,
): void {
  const key = pageId ?? "__default__";
  if (map) {
    _perPageSyntheticElementsMaps.set(key, cloneSyntheticElementsMap(map));
  } else {
    _perPageSyntheticElementsMaps.delete(key);
  }
  _syntheticElementsVersion++;
}

/** Synthetic element 등록 (DFS synthetic handler에서 호출) */
export function registerSyntheticElement(el: CanvasLayoutNode): void {
  if (_activeSyntheticElementsMap) {
    _activeSyntheticElementsMap.set(el.id, el);
    return;
  }

  const defaultMap =
    _perPageSyntheticElementsMaps.get("__default__") ?? new Map();
  defaultMap.set(el.id, el);
  publishSyntheticElementsMap(defaultMap);
}

/** 레이아웃 패스 시작 시 이전 synthetic elements 정리 (메모리 릭 방지) */
export function clearSyntheticElements(pageId?: string): void {
  if (pageId) {
    _perPageSyntheticElementsMaps.delete(pageId);
  } else {
    _perPageSyntheticElementsMaps.clear();
    _activeSyntheticElementsMap = null;
  }
  _syntheticElementsVersion++;
}

export function getPublishedSyntheticElementsMap(
  pageId?: string,
): Map<string, CanvasLayoutNode> | null {
  const key = pageId ?? "__default__";
  const map = _perPageSyntheticElementsMaps.get(key);
  return map ? cloneSyntheticElementsMap(map) : null;
}

/** Synthetic elements 조회 (command stream 경로에서 elementsMap fallback) */
export function getSyntheticElementsMap(): ReadonlyMap<
  string,
  CanvasLayoutNode
> {
  if (_perPageSyntheticElementsMaps.size === 0) {
    return _activeSyntheticElementsMap ?? new Map();
  }
  if (_mergedSyntheticElementsVersion === _syntheticElementsVersion) {
    return _mergedSyntheticElementsMap ?? new Map();
  }

  const merged = new Map<string, CanvasLayoutNode>();
  for (const pageMap of _perPageSyntheticElementsMaps.values()) {
    for (const [id, element] of pageMap) merged.set(id, element);
  }
  if (_activeSyntheticElementsMap) {
    for (const [id, element] of _activeSyntheticElementsMap) {
      merged.set(id, element);
    }
  }

  _mergedSyntheticElementsMap = merged;
  _mergedSyntheticElementsVersion = _syntheticElementsVersion;
  return merged;
}

/** 공유된 filteredChildIdsMap 조회 (모든 페이지 머지, 버전 캐시) */
export function getSharedFilteredChildrenMap(): Map<string, string[]> | null {
  if (_perPageFilteredMaps.size === 0) return null;
  if (_mergedFilteredVersion === _filteredVersion) return _mergedFilteredMap;
  const merged = new Map<string, string[]>();
  for (const pageMap of _perPageFilteredMaps.values()) {
    for (const [k, v] of pageMap) merged.set(k, v);
  }
  _mergedFilteredMap = merged;
  _mergedFilteredVersion = _filteredVersion;
  return merged;
}

// ─── 내부 유틸리티 ───────────────────────────────────────────────────

/** Taffy WASM binary protocol 은 grid track 을 array 로 기대. CSS 표준 string ("1fr auto")
 *  입력을 정규화. 이미 array 면 그대로 통과. `taffyStyleToRecord` /
 *  `buildNodeStyle` grid branch / `patchBatchStyleFromImplicit` 3 진입점 공유. */
function coerceGridTrack(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (Array.isArray(val)) return val;
  return parseGridTemplate(val as string);
}

/** Grid container 의 layout-영향 속성 — 증분 갱신에서 변경 시 full rebuild 필요.
 *  Taffy `updateStyleRaw` 가 track/placement 캐시 invalidation 실패. */
const GRID_REBUILD_TRIGGER_KEYS = [
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
  "gridAutoColumns",
  "gridAutoRows",
  "gridAutoFlow",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
] as const;

function isGridDisplay(display: unknown): boolean {
  return display === "grid" || display === "inline-grid";
}

// ─── Implicit Style 패치 ──────────────────────────────────────────────

/** CSS dimension 속성 (number → "${v}px" 변환) */
const IMPLICIT_DIM_PROPS = new Set([
  "marginLeft",
  "marginRight",
  "marginTop",
  "marginBottom",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "gap",
  "rowGap",
  "columnGap",
  "flexBasis",
]);

/**
 * applyImplicitStyles가 변경한 CSS 속성을 batch record에 패치.
 *
 * DFS post-order에서 자식은 부모보다 먼저 처리되므로,
 * 부모의 applyImplicitStyles 결과가 자식 batch 엔트리에 반영되지 않는다.
 * 변경된 속성만 찾아 taffyStyleToRecord 형식으로 패치한다.
 */
function patchBatchStyleFromImplicit(
  batchStyle: Record<string, unknown>,
  origStyle: Record<string, unknown>,
  modStyle: Record<string, unknown>,
): void {
  for (const key of Object.keys(modStyle)) {
    if (modStyle[key] === origStyle[key]) continue;
    const val = modStyle[key];
    if (val === undefined) continue;

    // flex shorthand → flexGrow/flexShrink/flexBasis 분해
    if (key === "flex") {
      const n = Number(val);
      if (!isNaN(n)) {
        batchStyle.flexGrow = n;
        batchStyle.flexShrink = 1;
        batchStyle.flexBasis = "0%";
      }
      continue;
    }

    // dimension 속성: number → "Npx", string → 그대로
    if (IMPLICIT_DIM_PROPS.has(key)) {
      batchStyle[key] = typeof val === "number" ? `${val}px` : val;
      continue;
    }

    // numeric 속성
    if (key === "flexGrow" || key === "flexShrink" || key === "order") {
      batchStyle[key] = Number(val);
      continue;
    }

    // position + inset 속성: CSS left/top/right/bottom → Taffy insetLeft/Top/Right/Bottom
    if (key === "position") {
      batchStyle.position =
        val === "absolute" || val === "fixed" ? "absolute" : val;
      continue;
    }
    if (
      key === "left" ||
      key === "top" ||
      key === "right" ||
      key === "bottom"
    ) {
      const insetKey = `inset${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      batchStyle[insetKey] = typeof val === "number" ? `${val}px` : String(val);
      continue;
    }

    // Grid track 속성: CSS string ("1fr auto") → WASM 이 기대하는 array 로 정규화
    if (
      key === "gridTemplateColumns" ||
      key === "gridTemplateRows" ||
      key === "gridAutoColumns" ||
      key === "gridAutoRows"
    ) {
      batchStyle[key] = coerceGridTrack(val);
      continue;
    }

    // string 속성 (display, flexDirection, alignItems 등)
    if (typeof val === "string") {
      batchStyle[key] = val;
      continue;
    }

    // 배열 속성 (gridTemplateAreas 등)
    if (Array.isArray(val)) {
      batchStyle[key] = val;
      continue;
    }
  }
}

// ─── TaffyStyle → Record 변환 ────────────────────────────────────────

/**
 * TaffyStyle 객체를 JSON 직렬화 가능한 Record로 변환.
 *
 * TaffyLayout 클래스 내부의 normalizeStyle()과 동일한 변환 규칙을 적용한다.
 * - 숫자 dimension 값은 `${v}px` 문자열로 변환
 * - undefined 필드는 결과에서 제외
 * - 배열 필드(grid track)는 그대로 전달
 * - 문자열 필드는 그대로 전달
 */
function taffyStyleToRecord(style: TaffyStyle): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // dimension 값을 string으로 정규화하는 내부 헬퍼
  function dim(v: string | number): string {
    return typeof v === "number" ? `${v}px` : v;
  }

  // Display & position
  if (style.display !== undefined) result.display = style.display;
  if (style.position !== undefined) result.position = style.position;
  if (style.overflowX !== undefined) result.overflowX = style.overflowX;
  if (style.overflowY !== undefined) result.overflowY = style.overflowY;

  // Flex container
  if (style.flexDirection !== undefined)
    result.flexDirection = style.flexDirection;
  if (style.flexWrap !== undefined) result.flexWrap = style.flexWrap;
  if (style.justifyContent !== undefined)
    result.justifyContent = style.justifyContent;
  if (style.justifyItems !== undefined)
    result.justifyItems = style.justifyItems;
  if (style.alignItems !== undefined) result.alignItems = style.alignItems;
  if (style.alignContent !== undefined)
    result.alignContent = style.alignContent;

  // Flex item
  if (style.flexGrow !== undefined) result.flexGrow = style.flexGrow;
  if (style.flexShrink !== undefined) result.flexShrink = style.flexShrink;
  if (style.flexBasis !== undefined) result.flexBasis = dim(style.flexBasis);
  if (style.alignSelf !== undefined) result.alignSelf = style.alignSelf;
  if (style.justifySelf !== undefined) result.justifySelf = style.justifySelf;
  if (style.order !== undefined) result.order = style.order;

  // Grid container — CSS 표준 string ("1fr auto") → WASM 이 기대하는 track array 정규화
  if (style.gridTemplateColumns !== undefined)
    result.gridTemplateColumns = coerceGridTrack(style.gridTemplateColumns);
  if (style.gridTemplateRows !== undefined)
    result.gridTemplateRows = coerceGridTrack(style.gridTemplateRows);
  if (style.gridAutoFlow !== undefined)
    result.gridAutoFlow = style.gridAutoFlow;
  if (style.gridAutoColumns !== undefined)
    result.gridAutoColumns = coerceGridTrack(style.gridAutoColumns);
  if (style.gridAutoRows !== undefined)
    result.gridAutoRows = coerceGridTrack(style.gridAutoRows);

  // Grid item
  if (style.gridColumnStart !== undefined)
    result.gridColumnStart = String(style.gridColumnStart);
  if (style.gridColumnEnd !== undefined)
    result.gridColumnEnd = String(style.gridColumnEnd);
  if (style.gridRowStart !== undefined)
    result.gridRowStart = String(style.gridRowStart);
  if (style.gridRowEnd !== undefined)
    result.gridRowEnd = String(style.gridRowEnd);

  // Size
  if (style.width !== undefined) result.width = dim(style.width);
  if (style.height !== undefined) result.height = dim(style.height);
  if (style.minWidth !== undefined) result.minWidth = dim(style.minWidth);
  if (style.minHeight !== undefined) result.minHeight = dim(style.minHeight);
  if (style.maxWidth !== undefined) result.maxWidth = dim(style.maxWidth);
  if (style.maxHeight !== undefined) result.maxHeight = dim(style.maxHeight);

  // Margin
  if (style.marginTop !== undefined) result.marginTop = dim(style.marginTop);
  if (style.marginRight !== undefined)
    result.marginRight = dim(style.marginRight);
  if (style.marginBottom !== undefined)
    result.marginBottom = dim(style.marginBottom);
  if (style.marginLeft !== undefined) result.marginLeft = dim(style.marginLeft);

  // Padding
  if (style.paddingTop !== undefined) result.paddingTop = dim(style.paddingTop);
  if (style.paddingRight !== undefined)
    result.paddingRight = dim(style.paddingRight);
  if (style.paddingBottom !== undefined)
    result.paddingBottom = dim(style.paddingBottom);
  if (style.paddingLeft !== undefined)
    result.paddingLeft = dim(style.paddingLeft);

  // Border
  if (style.borderTop !== undefined) result.borderTop = dim(style.borderTop);
  if (style.borderRight !== undefined)
    result.borderRight = dim(style.borderRight);
  if (style.borderBottom !== undefined)
    result.borderBottom = dim(style.borderBottom);
  if (style.borderLeft !== undefined) result.borderLeft = dim(style.borderLeft);

  // Inset
  if (style.insetTop !== undefined) result.insetTop = dim(style.insetTop);
  if (style.insetRight !== undefined) result.insetRight = dim(style.insetRight);
  if (style.insetBottom !== undefined)
    result.insetBottom = dim(style.insetBottom);
  if (style.insetLeft !== undefined) result.insetLeft = dim(style.insetLeft);

  // Gap
  if (style.columnGap !== undefined) result.columnGap = dim(style.columnGap);
  if (style.rowGap !== undefined) result.rowGap = dim(style.rowGap);

  // Aspect ratio — TaffyStyle.aspectRatio는 이미 숫자이므로 그대로 전달
  if (
    style.aspectRatio !== undefined &&
    typeof style.aspectRatio === "number" &&
    style.aspectRatio > 0
  ) {
    result.aspectRatio = style.aspectRatio;
  }

  return result;
}

/**
 * CanvasLayoutNode와 display 정보로 TaffyStyle을 계산 후 Record로 변환.
 *
 * display 타입에 따라 적절한 변환 함수를 선택한다:
 * - flex / inline-flex  → elementToTaffyStyle() (TaffyFlexEngine)
 * - grid / inline-grid  → applyCommonTaffyStyle() 기반 grid 스타일 (간소화)
 * - 그 외 (block 계열)  → elementToTaffyBlockStyle() + toTaffyDisplay()
 */
function buildNodeStyle(
  element: CanvasLayoutNode,
  computedStyle: ComputedStyle,
  childDisplays: string[],
  parentDisplay: string,
  childElements?: CanvasLayoutNode[],
): Record<string, unknown> {
  // ADR-079 P2 read-through 확장: Spec containerStyles 를 props.style 에 merge 한
  // enriched element 를 display/grid branch 양쪽에서 일관 참조. ProgressBar/Meter 등이
  // `display: "grid"` + `gridTemplateColumns` 를 spec containerStyles 에만 선언하고
  // factory 가 props.style 에 중복 주입하지 않는 케이스에서 Skia Grid 레이아웃 누락 방지.
  const rawStyle = (element.props?.style ?? {}) as Record<string, unknown>;
  const type = (element.type ?? "").toLowerCase();
  const specFallback = resolveContainerStylesFallback(type, rawStyle);
  const hasFallback = Object.keys(specFallback).length > 0;
  const mergedStyle = hasFallback ? { ...specFallback, ...rawStyle } : rawStyle;
  const enriched: CanvasLayoutNode = hasFallback
    ? { ...element, props: { ...element.props, style: mergedStyle } }
    : element;

  const display = getElementDisplay(enriched);
  const normalized = display.trim().toLowerCase();

  if (normalized === "flex" || normalized === "inline-flex") {
    const taffyStyle: TaffyStyle = elementToTaffyStyle(enriched, computedStyle);
    return taffyStyleToRecord(taffyStyle);
  }

  if (normalized === "grid" || normalized === "inline-grid") {
    // Grid: applyCommonTaffyStyle 기반 간소화 경로
    // 전체 grid 속성 변환은 TaffyGridEngine에 있으나
    // fullTreeLayout 배치에서는 size/padding/border/gap 처리가 핵심이므로
    // applyCommonTaffyStyle로 공통 부분을 처리하고 grid display를 주입한다.
    const style = mergedStyle;
    const partial: Record<string, unknown> = { display: "grid" };
    applyCommonTaffyStyle(partial, style, {});

    // Grid container 핵심 속성 전달. spec/props.style 이 CSS string ("1fr auto")
    // 형식으로 저장할 수 있어 WASM 이 기대하는 track array 로 정규화.
    if (style.gridTemplateColumns)
      partial.gridTemplateColumns = coerceGridTrack(style.gridTemplateColumns);
    if (style.gridTemplateRows)
      partial.gridTemplateRows = coerceGridTrack(style.gridTemplateRows);
    if (style.gridAutoFlow) partial.gridAutoFlow = style.gridAutoFlow;
    if (style.gridAutoColumns)
      partial.gridAutoColumns = coerceGridTrack(style.gridAutoColumns);
    if (style.gridAutoRows)
      partial.gridAutoRows = coerceGridTrack(style.gridAutoRows);
    if (style.justifyContent) partial.justifyContent = style.justifyContent;
    if (style.alignItems) partial.alignItems = style.alignItems;
    if (style.alignContent) partial.alignContent = style.alignContent;
    if (style.justifyItems) partial.justifyItems = style.justifyItems;

    // Grid item 배치 속성
    if (style.gridColumnStart)
      partial.gridColumnStart = String(style.gridColumnStart);
    if (style.gridColumnEnd)
      partial.gridColumnEnd = String(style.gridColumnEnd);
    if (style.gridRowStart) partial.gridRowStart = String(style.gridRowStart);
    if (style.gridRowEnd) partial.gridRowEnd = String(style.gridRowEnd);
    if (style.alignSelf) partial.alignSelf = style.alignSelf;
    if (style.justifySelf) partial.justifySelf = style.justifySelf;

    // Position + Inset
    if (style.position === "absolute" || style.position === "fixed") {
      partial.position = "absolute";
    } else if (style.position === "relative") {
      partial.position = "relative";
    }
    if (
      style.position === "absolute" ||
      style.position === "fixed" ||
      style.position === "relative"
    ) {
      const top = parseCSSPropWithContext(style.top, {});
      const left = parseCSSPropWithContext(style.left, {});
      const right = parseCSSPropWithContext(style.right, {});
      const bottom = parseCSSPropWithContext(style.bottom, {});
      if (top !== undefined) partial.insetTop = top;
      if (left !== undefined) partial.insetLeft = left;
      if (right !== undefined) partial.insetRight = right;
      if (bottom !== undefined) partial.insetBottom = bottom;
    }

    const margin = parseMargin(style);
    if (margin.top !== 0) partial.marginTop = margin.top;
    if (margin.right !== 0) partial.marginRight = margin.right;
    if (margin.bottom !== 0) partial.marginBottom = margin.bottom;
    if (margin.left !== 0) partial.marginLeft = margin.left;

    // CSS: grid 요소가 flex/grid 부모의 자식이면 flex item 속성도 적용
    if (FLEX_GRID_DISPLAYS.has(parentDisplay)) {
      applyFlexItemProperties(partial, style);
    }

    return partial;
  }

  // block / inline-block / inline / flow-root / 기타 → TaffyBlockEngine 경로
  // taffyDisplayAdapter가 모든 block layout 시뮬레이션 규칙을 TaffyDisplayConfig에 포함하고,
  // elementToTaffyBlockStyle이 모든 필드를 패스스루하므로 수동 주입 불필요.
  const taffyConfig = toTaffyDisplay(display, childDisplays, childElements);
  const taffyStyle: TaffyStyle = elementToTaffyBlockStyle(
    enriched,
    taffyConfig,
  );
  const record = taffyStyleToRecord(taffyStyle);

  // CSS: block 요소가 flex/grid 부모의 자식이면 flex item 속성 적용
  // 자식의 display는 내부 formatting context만 결정, flex item 참여는 부모 display로 결정
  if (FLEX_GRID_DISPLAYS.has(parentDisplay)) {
    const style = (element.props?.style ?? {}) as Record<string, unknown>;
    applyFlexItemProperties(record, style);
  }

  return record;
}

// ─── Fix 6: 자식 available size 추정 ────────────────────────────────

/**
 * 현재 요소의 명시적 크기 + padding/border를 고려하여
 * 자식에게 전달할 available width/height를 추정한다.
 */
function estimateChildAvailableSize(
  style: Record<string, unknown> | undefined,
  parentAvailWidth: number,
  parentAvailHeight: number,
): { width: number; height: number } {
  if (!style) return { width: parentAvailWidth, height: parentAvailHeight };

  // 명시적 width 해석
  let contentWidth = parentAvailWidth;
  const rawW = style.width;
  if (rawW != null) {
    const strW = String(rawW);
    if (strW.endsWith("%")) {
      const pct = parseFloat(strW);
      if (!isNaN(pct)) contentWidth = (parentAvailWidth * pct) / 100;
    } else if (strW !== "auto") {
      const px = parseFloat(strW);
      if (!isNaN(px)) contentWidth = px;
    }
  }

  // 명시적 height 해석
  let contentHeight = parentAvailHeight;
  const rawH = style.height;
  if (rawH != null) {
    const strH = String(rawH);
    if (strH.endsWith("%")) {
      const pct = parseFloat(strH);
      if (!isNaN(pct)) contentHeight = (parentAvailHeight * pct) / 100;
    } else if (strH !== "auto") {
      const px = parseFloat(strH);
      if (!isNaN(px)) contentHeight = px;
    }
  }

  // padding + border 차감 → content area
  const pad = parsePadding(style, contentWidth);
  const brd = parseBorder(style);
  contentWidth = Math.max(
    0,
    contentWidth - pad.left - pad.right - brd.left - brd.right,
  );
  contentHeight = Math.max(
    0,
    contentHeight - pad.top - pad.bottom - brd.top - brd.bottom,
  );

  return { width: contentWidth, height: contentHeight };
}

// ─── DFS post-order 순회 ─────────────────────────────────────────────

/** DFS 전체에서 공유되는 불변 context + mutable 누적기 */
interface DFSContext {
  // 불변 참조
  elementsMap: Map<string, CanvasLayoutNode>;
  childrenMap: Map<string, string[]>;
  getChildElements: (id: string) => CanvasLayoutNode[];
  // mutable 누적기
  batch: PersistentBatchNode[];
  indexMap: Map<string, number>;
  visiting: Set<string>;
  processedElementsMap: Map<string, CanvasLayoutNode>;
}

/**
 * DFS post-order 순회로 배치 배열 구성.
 *
 * 리프 노드를 먼저 배열에 추가하고, 이후 부모 노드가 자식 인덱스를
 * children 배열에 참조하는 방식으로 tree 구조를 평탄화한다.
 */
function traversePostOrder(
  elementId: string,
  ctx: DFSContext,
  availableWidth: number,
  availableHeight: number,
  parentComputed: ComputedStyle,
  parentDisplay: string,
  depth: number = 0,
): void {
  const {
    elementsMap,
    childrenMap,
    getChildElements,
    batch,
    indexMap,
    visiting,
    processedElementsMap,
  } = ctx;
  // 1. 중복 방문 방지 (이미 post-order 완료된 노드)
  if (indexMap.has(elementId)) return;

  // 2. 순환 참조 감지
  if (visiting.has(elementId)) {
    if (import.meta.env.DEV) {
      console.warn(`[fullTreeLayout] Cycle detected at ${elementId}`);
    }
    return;
  }

  // 3. 깊이 제한
  if (depth > MAX_TREE_DEPTH) {
    if (import.meta.env.DEV) {
      console.warn(
        `[fullTreeLayout] Max depth ${MAX_TREE_DEPTH} exceeded for ${elementId}`,
      );
    }
    return;
  }

  visiting.add(elementId);

  const storeElement = elementsMap.get(elementId);
  if (!storeElement) {
    visiting.delete(elementId);
    return;
  }
  let rawElement = storeElement;

  // Heading/Description → InlineAlert 부모 spec에서 font 스타일 주입 (텍스트 폭 측정 정합성)
  if (rawElement.type === "Heading" || rawElement.type === "Description") {
    const parent = rawElement.parent_id
      ? elementsMap.get(rawElement.parent_id)
      : undefined;
    if (parent?.type === "InlineAlert") {
      const parentSize =
        ((parent.props as Record<string, unknown> | undefined)
          ?.size as string) ?? "md";
      const specSize = (InlineAlertSpec.sizes[parentSize] ??
        InlineAlertSpec.sizes[
          InlineAlertSpec.defaultSize
        ]) as unknown as Record<string, unknown>;
      const cs = (rawElement.props?.style ?? {}) as Record<string, unknown>;
      const injected: Record<string, unknown> = { ...cs };
      if (rawElement.type === "Heading") {
        if (injected.fontSize == null && specSize.headingFontSize != null)
          injected.fontSize = specSize.headingFontSize;
        if (injected.fontWeight == null && specSize.headingFontWeight != null)
          injected.fontWeight = specSize.headingFontWeight;
      } else {
        if (injected.fontSize == null && specSize.descFontSize != null)
          injected.fontSize = specSize.descFontSize;
        if (injected.fontWeight == null && specSize.descFontWeight != null)
          injected.fontWeight = specSize.descFontWeight;
        if (injected.width == null) injected.width = "100%";
      }
      rawElement = {
        ...rawElement,
        props: { ...rawElement.props, style: injected },
      };
    }
  }

  // ProgressBar/Meter: leaf spec 컴포넌트 — display:grid 정규화
  // 이전 기본값에서 display:"grid"가 주입된 기존 요소를 block으로 정규화
  // grid+자식없음 → Taffy height=0 문제 방지
  // 하이브리드 모드 (자식 있음): grid 유지 — Label child가 Taffy 레이아웃 참여
  {
    const rawTag = (rawElement.type ?? "").toLowerCase();
    const hasChildren = getChildElements(rawElement.id).length > 0;
    if (
      !hasChildren &&
      (rawTag === "progressbar" ||
        rawTag === "progress" ||
        rawTag === "loadingbar" ||
        rawTag === "meter" ||
        rawTag === "gauge") &&
      (rawElement.props?.style as Record<string, unknown> | undefined)
        ?.display === "grid"
    ) {
      const { display: _, ...restStyle } = (rawElement.props?.style ??
        {}) as Record<string, unknown>;
      rawElement = {
        ...rawElement,
        props: { ...rawElement.props, style: restStyle },
      };
    }
  }

  // TagList → TagGroup 부모 propagation rawElement 주입 (DFS 진입 시점)
  //
  // 배경: TagGroup.spec.ts propagation rules `{ parentProp: <items|variant|size|
  //   allowsRemoving|maxRows>, childPath: "TagList", override: true }` 는 Inspector
  //   `buildPropagationUpdates` 와 factory `applyFactoryPropagation` 에서 store 직접
  //   갱신을 담당하지만, legacy migration / 부분 propagation 결손 시 TagList.props
  //   에 일부 필드가 누락된 상태로 store 가 로드될 수 있다.
  //
  // 영향: `calculateContentHeight` taglist 분기(utils.ts) 는 `element.props.items` /
  //   `element.props.maxRows` 를 직접 소비. items 누락 시 row-wrap 결과 0 반환 →
  //   TagGroup 컨테이너 높이 = Label 단독으로 고정. maxRows 누락 시 행 제한 미적용.
  //   Skia 렌더는 `resolveTagListItemsFromParent` (buildSpecNodeData.ts) 에서 동일
  //   방어 패치를 수행하므로 chip 시각은 정상 — Skia ↔ Layout 비대칭 발생 원인.
  //
  // 처리: Tag/Checkbox/Radio 의 부모 size delegation 과 동일하게 DFS 진입 시 rawElement
  //   props 를 부모값으로 보강. 자식 명시값(override:true 가 아닌 필드는 자식 우선)은 유지.
  if (rawElement.type === "TagList" && rawElement.parent_id) {
    const parent = elementsMap.get(rawElement.parent_id);
    if (parent?.type === "TagGroup") {
      const childProps = (rawElement.props ?? {}) as Record<string, unknown>;
      const parentProps = (parent.props ?? {}) as Record<string, unknown>;
      const delegated: Record<string, unknown> = {};

      // items / maxRows: spec rule override:true — 부모 우선
      const parentItems = parentProps.items;
      if (Array.isArray(parentItems) && parentItems.length > 0) {
        delegated.items = parentItems;
      }
      const parentMaxRows = parentProps.maxRows;
      if (typeof parentMaxRows === "number" && parentMaxRows > 0) {
        delegated.maxRows = parentMaxRows;
      }

      // size / variant / allowsRemoving: 자식 명시값 없을 때만 주입
      if (childProps.size === undefined && parentProps.size !== undefined) {
        delegated.size = parentProps.size;
      }
      if (
        childProps.variant === undefined &&
        parentProps.variant !== undefined
      ) {
        delegated.variant = parentProps.variant;
      }
      if (parentProps.allowsRemoving === true) {
        delegated.allowsRemoving = true;
      }

      if (Object.keys(delegated).length > 0) {
        rawElement = {
          ...rawElement,
          props: { ...rawElement.props, ...delegated },
        };
      }
    }
  }

  // Tag → TagGroup 부모 size 상속 (CSS data-type-size parent delegation 에뮬레이션)
  // DFS 진입 시 element에 size를 주입하면 이후 calculateContentHeight/parseBoxModel 등에서 자연스럽게 사용
  if (rawElement.type === "Tag") {
    const rawProps = rawElement.props as Record<string, unknown> | undefined;
    let ancestor = rawElement.parent_id
      ? elementsMap.get(rawElement.parent_id)
      : undefined;
    if (ancestor?.type === "TagList" && ancestor.parent_id) {
      ancestor = elementsMap.get(ancestor.parent_id);
    }
    if (ancestor?.type === "TagGroup") {
      const groupProps = ancestor.props as Record<string, unknown> | undefined;
      const delegated: Record<string, unknown> = {};
      // size delegation: TagGroup size → Tag (없으면 "md" 기본값)
      if (!rawProps?.size) {
        delegated.size = (groupProps?.size as string) || "md";
      }
      // allowsRemoving delegation
      if (groupProps?.allowsRemoving) {
        delegated.allowsRemoving = true;
      }
      if (Object.keys(delegated).length > 0) {
        rawElement = {
          ...rawElement,
          props: { ...rawElement.props, ...delegated },
        };
      }
    }
  }

  // Checkbox/Radio → CheckboxGroup/RadioGroup 부모 size 상속 (DFS 진입 시)
  // implicitStyles가 containerProps.size로 indicator marginLeft를 계산하므로
  // Store에 size가 없는 Checkbox/Radio에 부모 Group의 size를 주입해야 함
  if (
    (rawElement.type === "Checkbox" || rawElement.type === "Radio") &&
    !(rawElement.props as Record<string, unknown> | undefined)?.size &&
    rawElement.parent_id
  ) {
    let ancestor = elementsMap.get(rawElement.parent_id);
    // CheckboxItems/RadioItems 래퍼 통과
    if (
      ancestor &&
      (ancestor.type === "CheckboxItems" || ancestor.type === "RadioItems") &&
      ancestor.parent_id
    ) {
      ancestor = elementsMap.get(ancestor.parent_id);
    }
    const groupTag =
      rawElement.type === "Checkbox" ? "CheckboxGroup" : "RadioGroup";
    if (ancestor?.type === groupTag) {
      const groupSize = (ancestor.props as Record<string, unknown> | undefined)
        ?.size as string | undefined;
      if (groupSize) {
        rawElement = {
          ...rawElement,
          props: { ...rawElement.props, size: groupSize },
        };
      }
    }
  }

  // Label → 부모 size 상속 (DFS 진입 시 fontSize/lineHeight 주입)
  // CSS는 --label-font-size 변수로 처리하지만, Taffy는 인라인 fontSize가 필요
  if (rawElement.type === "Label") {
    const rawProps = rawElement.props as Record<string, unknown> | undefined;
    const labelStyle = (rawProps?.style || {}) as Record<string, unknown>;
    // lineHeight 미설정 시 주입 (factory가 fontSize만 설정하고 lineHeight를 누락한 경우 포함)
    // CSS Preview 정합성: --text-sm--line-height 등과 동일한 lineHeight 보장
    if (labelStyle.lineHeight == null && rawElement.parent_id) {
      // 부모 → 조상 탐색: 마지막으로 만난 delegation 부모를 기억
      let ancestor = elementsMap.get(rawElement.parent_id);
      let ancestorSize: string | undefined;
      let lastDelegationAncestor: CanvasLayoutNode | undefined;
      while (ancestor) {
        if (LABEL_DELEGATION_PARENT_TAGS.has(ancestor.type)) {
          lastDelegationAncestor = ancestor;
          ancestorSize =
            ((ancestor.props as Record<string, unknown> | undefined)
              ?.size as string) || undefined;
          if (ancestorSize) break; // size 찾음 → 확정
        }
        // 래퍼 태그면 계속 상위 탐색 (Checkbox → CheckboxItems → CheckboxGroup)
        if (LABEL_WRAPPER_TAGS.has(ancestor.type) && ancestor.parent_id) {
          ancestor = elementsMap.get(ancestor.parent_id);
        } else {
          break;
        }
      }
      if (lastDelegationAncestor) {
        const parentSize = ancestorSize ?? "md";
        const delegated = LABEL_SIZE_STYLE[parentSize] ?? LABEL_SIZE_STYLE.md;
        rawElement = {
          ...rawElement,
          props: {
            ...rawElement.props,
            size: parentSize,
            style: {
              ...labelStyle,
              fontSize: delegated.fontSize,
              lineHeight: delegated.lineHeight,
            },
          },
        };
      }
    }

    // Label necessity indicator: 부모의 necessityIndicator → children 텍스트에 반영
    // enrichWithIntrinsicSize(fit-content 폭 측정)에 indicator 포함 텍스트 사용
    if (rawElement.parent_id) {
      const parent = elementsMap.get(rawElement.parent_id);
      const parentProps = parent?.props as Record<string, unknown> | undefined;
      const necessity = parentProps?.necessityIndicator as string | undefined;
      if (necessity) {
        const isReq = Boolean(parentProps?.isRequired);
        const originalText =
          ((rawElement.props as Record<string, unknown> | undefined)
            ?.children as string) ?? "";
        const suffix = getNecessityIndicatorSuffix(necessity, isReq);
        if (suffix) {
          rawElement = {
            ...rawElement,
            props: { ...rawElement.props, children: originalText + suffix },
          };
        }
      }
    }
  }

  // GAP 3: Implicit Style 통합 — 원본 자식 수집 후 applyImplicitStyles로 전처리
  const rawChildIds = childrenMap.get(elementId) ?? [];
  const rawChildren = rawChildIds
    .map((id) => elementsMap.get(id))
    .filter((el): el is CanvasLayoutNode => el !== undefined);

  const { effectiveParent, filteredChildren } = applyImplicitStyles(
    rawElement,
    rawChildren,
    getChildElements,
    elementsMap,
    availableWidth,
  );

  // implicit style이 주입된 부모 요소 사용
  let element = effectiveParent;
  // DFS injection 또는 implicit style로 변경된 경우만 보존 (2-pass re-enrichment용)
  // storeElement: DFS injection 전 원본. rawElement는 DFS 중 재할당될 수 있어 비교 기준 부적합
  if (element !== storeElement) {
    processedElementsMap.set(elementId, element);
  }

  // TagList/TagGroup의 Tag 자식에 TagGroup size 상속 (calculateContentWidth 정합성)
  // DFS rawElement 주입(line 602)은 개별 Tag 노드 진입 시에만 적용되므로,
  // 부모(TagList/TagGroup)의 filteredChildren에도 동일하게 size를 주입해야
  // enrichWithIntrinsicSize → calculateContentWidth 재귀 시 올바른 크기를 산출한다.
  const containerTag = (rawElement.type ?? "").toLowerCase();
  if (containerTag === "taglist" || containerTag === "taggroup") {
    // TagGroup의 size/allowsRemoving 조회
    let groupSize: string | undefined;
    let groupAllowsRemoving = false;
    if (containerTag === "taggroup") {
      const gp = rawElement.props as Record<string, unknown> | undefined;
      groupSize = gp?.size as string | undefined;
      groupAllowsRemoving = Boolean(gp?.allowsRemoving);
    } else {
      // TagList → 부모 TagGroup에서 조회
      const parentEl = rawElement.parent_id
        ? elementsMap.get(rawElement.parent_id)
        : undefined;
      if (parentEl?.type === "TagGroup") {
        const gp = parentEl.props as Record<string, unknown> | undefined;
        groupSize = gp?.size as string | undefined;
        groupAllowsRemoving = Boolean(gp?.allowsRemoving);
      }
    }
    for (let i = 0; i < filteredChildren.length; i++) {
      const child = filteredChildren[i];
      if (child.type !== "Tag") continue;
      const childProps = child.props as Record<string, unknown> | undefined;
      const delegated: Record<string, unknown> = {};
      if (groupSize && !childProps?.size) delegated.size = groupSize;
      if (groupAllowsRemoving) delegated.allowsRemoving = true;
      if (Object.keys(delegated).length > 0) {
        filteredChildren[i] = {
          ...child,
          props: { ...child.props, ...delegated },
        };
      }
    }
  }

  // filteredChildren 기반으로 유효한 자식 ID 목록 재구성
  const childIds = filteredChildren.map((child) => child.id);

  // CSS `order` 속성 기반 stable sort (ADR-006 P1-1)
  // order 값이 모두 0(기본값)이면 복사 비용을 회피하기 위해 원본 배열을 그대로 사용
  const getOrder = (id: string): number => {
    const s = (elementsMap.get(id)?.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const o = parseInt(String(s.order ?? "0"), 10);
    return isNaN(o) ? 0 : o;
  };
  const hasOrder = childIds.some((id) => getOrder(id) !== 0);
  const sortedChildIds = hasOrder
    ? [...childIds].sort((a, b) => getOrder(a) - getOrder(b)) // stable sort (CSS spec)
    : childIds; // order 미사용 시 복사 비용 회피

  // DEV 모드 로그
  if (hasOrder && import.meta.env.DEV) {
    console.info(
      `[fullTreeLayout] CSS order applied for children of ${elementId}`,
    );
  }

  // 1. computed style 계산 (CSS 상속 처리)
  const elementStyle = (element.props?.style ?? {}) as Record<string, unknown>;

  // GAP 1: CSS Blockification — 부모가 flex/grid면 현재 요소의 display를 blockify
  const shouldBlockify = FLEX_GRID_DISPLAYS.has(parentDisplay);
  let effectiveDisplay = getElementDisplay(element);

  if (shouldBlockify) {
    const blockified = blockifyDisplay(effectiveDisplay);
    if (blockified !== effectiveDisplay) {
      effectiveDisplay = blockified;
      element = {
        ...element,
        props: {
          ...element.props,
          style: {
            ...((element.props?.style as Record<string, unknown>) ?? {}),
            display: blockified,
          },
        },
      };
    }
  }

  const computedStyle = resolveStyle(elementStyle, parentComputed);

  // 2. 자식들의 display 값 수집 (toTaffyDisplay inline-block 감지용)
  // filteredChildren 기준으로 blockified 값 사용
  const childDisplays: string[] = filteredChildren.map((childEl) => {
    const rawDisplay = getElementDisplay(childEl);
    if (FLEX_GRID_DISPLAYS.has(effectiveDisplay)) {
      return blockifyDisplay(rawDisplay);
    }
    return rawDisplay;
  });

  // 3. 자식 먼저 재귀 (post-order)
  // Fix 6: 현재 요소의 content area 크기를 자식의 availableWidth/Height로 전달
  let childAvail = estimateChildAvailableSize(
    elementStyle,
    availableWidth,
    availableHeight,
  );

  // Grid 컨테이너: 자식 availableWidth를 트랙 폭으로 조정
  // CSS에서 1fr 트랙은 컨테이너 폭을 균등 분배하므로, DFS에서 미리 계산하여
  // enrichWithIntrinsicSize가 올바른 width 기준으로 height를 계산하도록 한다.
  if (effectiveDisplay === "grid" || effectiveDisplay === "inline-grid") {
    const gridCols = elementStyle.gridTemplateColumns as string[] | undefined;
    if (gridCols && gridCols.length > 0) {
      const numCols = gridCols.length;
      const gapVal =
        typeof elementStyle.gap === "number"
          ? elementStyle.gap
          : parseFloat(String(elementStyle.gap ?? "0")) || 0;
      const totalGap = gapVal * (numCols - 1);
      const trackWidth = Math.max(0, (childAvail.width - totalGap) / numCols);
      childAvail = { ...childAvail, width: trackWidth };
    }
  }

  for (const childId of sortedChildIds) {
    traversePostOrder(
      childId,
      ctx,
      childAvail.width,
      childAvail.height,
      computedStyle,
      effectiveDisplay,
      depth + 1,
    );
  }

  // 3.5. Synthetic children (e.g., `xxx__synlabel` from applyImplicitStyles) 처리
  // elementsMap에 없는 자식(Radio/Checkbox/Switch/Toggle의 합성 Label)을
  // leaf 노드로 Taffy 트리에 추가하여 레이아웃을 계산받게 한다.
  // 이를 통해 BuilderCanvas의 renderChildElement가 fullTreeLayoutMap에서 레이아웃을 조회 가능.
  for (const synthChild of filteredChildren) {
    if (elementsMap.has(synthChild.id) || indexMap.has(synthChild.id)) continue;

    const synthStyle = (synthChild.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const synthComputed = resolveStyle(synthStyle, computedStyle);
    const isSynthFlexChild = FLEX_GRID_DISPLAYS.has(effectiveDisplay);
    const synthEnriched = enrichWithIntrinsicSize(
      synthChild,
      childAvail.width,
      childAvail.height,
      synthComputed,
      [],
      getChildElements,
      isSynthFlexChild,
    );
    const synthRecord = buildNodeStyle(
      synthEnriched,
      synthComputed,
      [],
      effectiveDisplay,
    );
    batch.push({ style: synthRecord, children: [], elementId: synthChild.id });
    indexMap.set(synthChild.id, batch.length - 1);
    registerSyntheticElement(synthChild);
  }

  // 3.6. Implicit child style overrides → batch 반영
  // DFS post-order에서 자식은 부모보다 먼저 처리되어 원본 스타일로 batch에 등록됨.
  // applyImplicitStyles가 실제 자식(DB 요소)의 스타일을 변경한 경우
  // (e.g., Checkbox→Label marginLeft, SelectTrigger→SelectValue flex:1),
  // 이미 생성된 batch 엔트리에 변경사항을 패치한다.
  for (const filteredChild of filteredChildren) {
    const batchIdx = indexMap.get(filteredChild.id);
    if (batchIdx === undefined) continue;

    const originalEl = elementsMap.get(filteredChild.id);
    if (!originalEl) continue;

    // props.style 참조 비교 — 동일하면 applyImplicitStyles가 수정하지 않은 것
    if (filteredChild.props?.style === originalEl.props?.style) continue;

    // DFS injection(Label fontSize/lineHeight) + parent implicit styles(whiteSpace 등) merge
    // props: DFS injection 우선 (size 등 보존), style: implicit 우선 (marginLeft 등 적용)
    const existingProcessed = processedElementsMap.get(filteredChild.id);
    if (existingProcessed) {
      const { style: dfsStyle, ...dfsNonStyleProps } =
        (existingProcessed.props ?? {}) as Record<string, unknown>;
      const implicitStyle = (filteredChild.props?.style ?? {}) as Record<
        string,
        unknown
      >;
      processedElementsMap.set(filteredChild.id, {
        ...filteredChild,
        props: {
          ...filteredChild.props,
          ...dfsNonStyleProps,
          style: {
            ...((dfsStyle ?? {}) as Record<string, unknown>),
            ...implicitStyle,
          },
        },
      } as CanvasLayoutNode);
    } else {
      processedElementsMap.set(filteredChild.id, filteredChild);
    }

    const origStyle = (originalEl.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const modStyle = (filteredChild.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    patchBatchStyleFromImplicit(batch[batchIdx].style, origStyle, modStyle);

    // DFS post-order: 자식이 부모보다 먼저 enrichment → fontSize 미주입 상태로 계산됨
    // implicitStyles가 fontSize를 주입하면 height(lineHeight 기반) + fit-content width 재계산
    if (modStyle.fontSize != null && modStyle.fontSize !== origStyle.fontSize) {
      const childFs =
        typeof modStyle.fontSize === "number"
          ? modStyle.fontSize
          : parseFloat(String(modStyle.fontSize)) || 16;
      // LabelSpec lineHeight 사용: CSS Preview(--text-sm--line-height 등)와 정합성 보장
      const labelEntry = Object.values(LABEL_SIZE_STYLE).find(
        (e) => e.fontSize === childFs,
      );
      const correctedHeight = labelEntry
        ? parseFloat(labelEntry.lineHeight)
        : Math.ceil(childFs * 1.5);
      batch[batchIdx].style.height = `${correctedHeight}px`;

      // fit-content/max-content/min-content: 텍스트 측정값이 fontSize에 의존
      const childStoreWidth = origStyle.width;
      if (
        childStoreWidth === "fit-content" ||
        childStoreWidth === "max-content" ||
        childStoreWidth === "min-content"
      ) {
        const childText = String(
          (filteredChild.props as Record<string, unknown>)?.children ?? "",
        );
        if (childText) {
          const childFw =
            parseFloat(
              String(modStyle.fontWeight ?? origStyle.fontWeight ?? 400),
            ) || 400;
          const childFf =
            (modStyle.fontFamily as string) ??
            (origStyle.fontFamily as string) ??
            specFontFamily.sans;
          const correctedWidth = Math.ceil(
            measureTextWidth(childText, childFs, childFf, childFw),
          );
          batch[batchIdx].style.width = `${correctedWidth}px`;
        }
      }
    }
  }

  // 4. enrichWithIntrinsicSize: intrinsic 크기 주입
  // CSS height:auto 일반 규칙:
  //   A. 컨테이너 (Taffy 자식 있음) → Taffy가 자식 border-box + padding + border로 자동 계산
  //   B. 리프 (Taffy 자식 없음) → intrinsic height 주입 (텍스트 측정 / spec shapes)
  const isFlexChild =
    parentDisplay === "flex" || parentDisplay === "inline-flex";
  // hasTaffyChildren: 실제 Taffy 노드로 처리된 자식이 있는지 확인
  // synthetic children도 이제 indexMap에 포함되므로 정상적으로 true 반환
  const hasTaffyChildren = childIds.some((id) => indexMap.has(id));

  // enrichment에 implicit-styled 자식 사용:
  // applyImplicitStyles가 주입한 padding/gap이 calculateContentWidth에 반영되어야
  // fit-content/min-content 계산 시 정확한 border-box 크기를 산출한다.
  // (원본 childElements는 spec padding/gap 미포함 → 크기 과소 산출)

  // ADR-048: Registry 기반 부모→자식 props 전파 (블록 1~3, 5 통합)
  // propagation 규칙이 있는 컨테이너에서 자식에게 props를 주입
  let effectiveGetChildElements = getChildElements;
  const propagationRules = getPropagationRules(containerTag);
  if (propagationRules) {
    const containerProps = rawElement.props as Record<string, unknown>;
    const prevGet = effectiveGetChildElements;
    effectiveGetChildElements = (id: string) => {
      const children = prevGet(id);
      return children.map((child) => {
        const patch = resolvePropagatedProps(
          containerTag,
          containerProps,
          child.type,
          child.props as Record<string, unknown>,
        );
        return patch
          ? { ...child, props: { ...child.props, ...patch } }
          : child;
      });
    };
  }
  // CheckboxItems/RadioItems: 부모 Group의 propagation을 중계
  if (containerTag === "checkboxitems" || containerTag === "radioitems") {
    const parentEl = rawElement.parent_id
      ? elementsMap.get(rawElement.parent_id)
      : undefined;
    if (parentEl) {
      const parentRules = getPropagationRules(parentEl.type.toLowerCase());
      if (parentRules) {
        const parentProps = parentEl.props as Record<string, unknown>;
        const prevGet2 = effectiveGetChildElements;
        effectiveGetChildElements = (id: string) => {
          const children = prevGet2(id);
          return children.map((child) => {
            const patch = resolvePropagatedProps(
              parentEl.type,
              parentProps,
              child.type,
              child.props as Record<string, unknown>,
            );
            return patch
              ? { ...child, props: { ...child.props, ...patch } }
              : child;
          });
        };
      }
    }
  }

  // Label fontSize/lineHeight 주입 — 부모의 size에 따라 Label에 fontSize/lineHeight 인라인 주입
  if (getLabelDelegationParents()?.has(containerTag)) {
    const parentSize =
      ((rawElement.props as Record<string, unknown> | undefined)?.size as
        | string
        | undefined) || "md";
    {
      const delegated = LABEL_SIZE_STYLE[parentSize];
      if (delegated) {
        const prevGetChildElements2 = effectiveGetChildElements;
        effectiveGetChildElements = (id: string) => {
          const children = prevGetChildElements2(id);
          return children.map((child) => {
            if (child.type !== "Label") return child;
            const cs = (child.props?.style || {}) as Record<string, unknown>;
            if (cs.lineHeight != null) return child; // 인라인 lineHeight가 이미 있으면 스킵
            return {
              ...child,
              props: {
                ...child.props,
                size: parentSize,
                style: {
                  ...cs,
                  fontSize: delegated.fontSize,
                  lineHeight: delegated.lineHeight,
                },
              },
            };
          });
        };
      }
    }
  }

  const enrichChildren = filteredChildren;

  let enriched: CanvasLayoutNode = enrichWithIntrinsicSize(
    element,
    availableWidth,
    availableHeight,
    computedStyle,
    enrichChildren,
    effectiveGetChildElements,
    isFlexChild,
  );

  if (hasTaffyChildren) {
    // A. 컨테이너: CSS height:auto → enrichment가 주입한 height를 제거
    // 사용자가 명시한 CSS height는 보존, enrichment가 추가한 height만 제거
    // → Taffy가 자식 border-box + padding + border로 height를 자동 계산
    const originalHeight = elementStyle.height;
    if (!originalHeight || originalHeight === "auto") {
      const enrichedStyle = (enriched.props?.style ?? {}) as Record<
        string,
        unknown
      >;
      if (
        enrichedStyle.height !== undefined &&
        enrichedStyle.height !== originalHeight
      ) {
        const { height: _, ...restStyle } = enrichedStyle;
        enriched = {
          ...enriched,
          props: { ...enriched.props, style: restStyle },
        };
      }
    }
  } else {
    // B. 리프: enrichWithIntrinsicSize의 early return guard로 height 미주입된 경우 보완
    // Panel 등 spec shapes 컴포넌트는 CSS height 없고 element children도 없지만
    // 시각적 콘텐츠가 있어 intrinsic height가 필요하다.
    const enrichedStyle = (enriched.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    if (
      !enrichedStyle.height &&
      (!elementStyle.height || elementStyle.height === "auto")
    ) {
      const intrinsicHeight = calculateContentHeight(
        element,
        availableWidth,
        filteredChildren,
        getChildElements,
        computedStyle,
      );
      if (intrinsicHeight > 0) {
        const box = parseBoxModel(element, availableWidth, availableHeight);
        const borderBoxHeight =
          intrinsicHeight +
          box.padding.top +
          box.padding.bottom +
          box.border.top +
          box.border.bottom;
        enriched = {
          ...enriched,
          props: {
            ...enriched.props,
            style: { ...enrichedStyle, height: borderBoxHeight },
          },
        };
      }
    }
  }

  // 4.7.1. ProgressBar/Meter: spec shapes leaf 안전망
  // enrichWithIntrinsicSize가 height를 주입했어야 하지만,
  // 어떤 이유로 누락된 경우 calculateContentHeight로 보정
  // 하이브리드 모드 (자식 있음): Taffy가 자동 계산 → 이 안전망 스킵
  {
    const enrichedStyle = (enriched.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const enrichedTag = (rawElement.type ?? "").toLowerCase();
    if (
      !enrichedStyle.height &&
      !hasTaffyChildren &&
      (enrichedTag === "progressbar" ||
        enrichedTag === "progress" ||
        enrichedTag === "loadingbar" ||
        enrichedTag === "meter" ||
        enrichedTag === "gauge")
    ) {
      const fallbackHeight = calculateContentHeight(
        rawElement,
        availableWidth,
        filteredChildren,
        getChildElements,
        computedStyle,
      );
      if (fallbackHeight > 0) {
        enriched = {
          ...enriched,
          props: {
            ...enriched.props,
            style: { ...enrichedStyle, height: fallbackHeight },
          },
        };
      }
    }
  }

  // 4.8. CSS min-width:auto 에뮬레이션 (flex/grid 자식 리프 노드)
  // CSS Flexbox §4.5: flex/grid item의 기본 min-width는 auto = min-content.
  // Taffy는 텍스트 측정이 불가하여 min-content를 0으로 처리한다.
  // 캔버스의 non-TEXT_LEAF 노드는 단일 행 렌더링(줄바꿈 없음)이므로
  // max-content(전체 텍스트 폭)를 minWidth로 주입하여
  // shrink-wrap 환경(alignItems:center 등)에서 텍스트 축소를 방지한다.
  if (FLEX_GRID_DISPLAYS.has(parentDisplay) && !hasTaffyChildren) {
    const enrichedStyle = (enriched.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    if (!enrichedStyle.width && !enrichedStyle.minWidth) {
      const props = rawElement.props as Record<string, unknown> | undefined;
      const textContent = String(
        props?.children ??
          props?.text ??
          props?.label ??
          props?.placeholder ??
          "",
      );
      if (textContent) {
        const fontSize =
          parseFloat(
            String(enrichedStyle.fontSize ?? computedStyle?.fontSize ?? 14),
          ) || 14;
        // Spec 기반 font 속성 추출 — 렌더러와 동일한 fontWeight/fontFamily 보장
        // (Button 공백 텍스트 줄바꿈 방지 패턴: docs/bug/skia-button-text-linebreak.md)
        const specStyle = extractSpecTextStyle(
          rawElement.type,
          props as Record<string, unknown>,
        );
        const fontFamily =
          (enrichedStyle.fontFamily as string | undefined) ??
          specStyle?.fontFamily;
        const fontWeight =
          (parseFloat(String(enrichedStyle.fontWeight ?? "")) ||
            specStyle?.fontWeight) ??
          400;
        const maxContentW = measureTextWidth(
          textContent,
          fontSize,
          fontFamily,
          fontWeight,
        );
        if (maxContentW > 0) {
          const box = parseBoxModel(
            rawElement,
            availableWidth,
            availableHeight,
          );
          const borderBoxMinW = Math.ceil(
            maxContentW +
              box.padding.left +
              box.padding.right +
              box.border.left +
              box.border.right,
          );
          enriched = {
            ...enriched,
            props: {
              ...enriched.props,
              style: { ...enrichedStyle, minWidth: borderBoxMinW },
            },
          };
        }
      }
    }
  }

  // 5. 현재 노드의 TaffyStyle 계산 → Record 변환
  // filteredChildren 전달: vertical-align 기반 alignItems 동적 결정에 사용 (ADR-006 P2-3)
  const styleRecord = buildNodeStyle(
    enriched,
    computedStyle,
    childDisplays,
    parentDisplay,
    filteredChildren,
  );

  // 5.5. block→flex-row-wrap 변환 시 block-level 자식에 width:100% 주입
  // CSS block container 내 block-level 자식은 자동으로 부모 폭 100%이지만
  // Taffy flex-row-wrap 시뮬레이션에서는 명시적 설정 필요 (taffyDisplayAdapter 규칙)
  if (styleRecord.display === "flex" && styleRecord.flexWrap === "wrap") {
    for (let ci = 0; ci < childIds.length; ci++) {
      const childEl = elementsMap.get(childIds[ci]);
      const childStyle = (childEl?.props?.style ?? {}) as Record<
        string,
        unknown
      >;
      if (needsBlockChildFullWidth(childDisplays[ci], childStyle.width)) {
        const childBatchIdx = indexMap.get(childIds[ci]);
        if (childBatchIdx !== undefined) {
          // enrichWithIntrinsicSize가 이미 numeric width를 주입한 경우 보존
          // (Tag, Badge 등 INLINE_BLOCK_TAGS의 텍스트 기반 border-box 크기)
          const existingW = batch[childBatchIdx].style.width;
          if (
            typeof existingW === "number" ||
            (typeof existingW === "string" &&
              existingW !== "auto" &&
              existingW !== "100%")
          ) {
            continue;
          }
          batch[childBatchIdx].style.width = "100%";
        }
      }
    }
  }

  // 5.7. overflow: non-visible 부모의 flex 자식 shrink 방지
  // CSS에서 overflow clipped 컨테이너(hidden/clip/scroll/auto)의 flex 자식은
  // shrink하지 않고 overflow 허용. Taffy는 이 상호작용 미지원 → flexShrink: 0 주입
  if (FLEX_GRID_DISPLAYS.has(effectiveDisplay)) {
    const ov = (elementStyle.overflow as string) ?? "visible";
    const ovX = (elementStyle.overflowX as string) ?? ov;
    const ovY = (elementStyle.overflowY as string) ?? ov;
    const isClippedX = ovX !== "visible";
    const isClippedY = ovY !== "visible";
    const isRow =
      !styleRecord.flexDirection ||
      styleRecord.flexDirection === "row" ||
      styleRecord.flexDirection === "row-reverse";
    if ((isRow && isClippedX) || (!isRow && isClippedY)) {
      for (const childId of sortedChildIds) {
        const childBatchIdx = indexMap.get(childId);
        if (childBatchIdx === undefined) continue;
        const childBatch = batch[childBatchIdx];
        if (childBatch.style.flexShrink === undefined) {
          childBatch.style.flexShrink = 0;
        }
      }
    }
  }

  // 6. 자식 batch 인덱스 목록 구성 (filteredChildren 기반)
  // CSS order 정렬 순서를 유지하기 위해 sortedChildIds 사용
  const childIndices: number[] = [];
  for (const childId of sortedChildIds) {
    const childIdx = indexMap.get(childId);
    if (childIdx !== undefined) {
      childIndices.push(childIdx);
    }
  }

  // 7. 현재 노드를 배치 배열에 추가, 인덱스 매핑 저장
  const currentIndex = batch.length;
  batch.push({
    style: styleRecord,
    children: childIndices,
    elementId,
  });
  indexMap.set(elementId, currentIndex);

  // 순환 참조 감지용 visiting set에서 제거 (DFS backtrack)
  visiting.delete(elementId);
}

// ─── 증분 갱신 ──────────────────────────────────────────────────────

/**
 * Persistent 트리 증분 갱신.
 *
 * DFS 결과(batch)와 기존 persistent tree를 비교하여
 * 새 노드 추가 / 스타일 변경 / 자식 구조 변경 / 노드 삭제를 수행한다.
 *
 * PersistentTaffyTree 내부의 해시 비교로 실제 변경이 없는 노드는 자동 스킵되며,
 * Taffy의 dirty cache 덕분에 computeLayout()에서 변경 없는 서브트리는 O(1) 스킵된다.
 *
 * @returns DEV 전용: 실제 갱신된 스타일/자식/추가/삭제 수
 */
function incrementalUpdate(
  tree: PersistentTaffyTree,
  batch: PersistentBatchNode[],
  filteredChildIdsMap: Map<string, string[]>,
): {
  stylesUpdated: number;
  childrenUpdated: number;
  added: number;
  removed: number;
} {
  const stats = { stylesUpdated: 0, childrenUpdated: 0, added: 0, removed: 0 };
  const currentNodeIds = new Set(batch.map((n) => n.elementId));

  // 1. 삭제된 노드 식별 (현재 batch에 없는 기존 노드)
  const allHandles = tree.getAllHandles();
  const removedIds: string[] = [];
  for (const existingId of allHandles.keys()) {
    if (!currentNodeIds.has(existingId)) {
      removedIds.push(existingId);
    }
  }

  // 2. post-order 순회: 새 노드 추가 + 기존 노드 스타일 갱신
  //    모든 batch 노드를 Taffy에 반영 (부분 필터 시 OLD+NEW 혼합 → 잘못된 계산)
  //    updateNodeStyle은 내부 JSON 비교로 변경 없는 노드 스킵
  for (const node of batch) {
    if (tree.hasNode(node.elementId)) {
      if (tree.updateNodeStyle(node.elementId, node.style)) {
        stats.stylesUpdated++;
      }
    } else {
      tree.addNode(node.elementId, node.style);
      stats.added++;
    }
  }

  // 3. 자식 구조 갱신 (변경 감지는 PersistentTaffyTree 내부 hash 비교)
  for (const node of batch) {
    const childIds = filteredChildIdsMap.get(node.elementId) ?? [];
    if (tree.updateChildren(node.elementId, childIds)) {
      stats.childrenUpdated++;
    }
  }

  // 4. 삭제된 노드 제거 (자식 구조 갱신 후 → 더 이상 참조되지 않음)
  for (const id of removedIds) {
    tree.removeNode(id);
    stats.removed++;
  }

  return stats;
}

// ─── 공개 API ────────────────────────────────────────────────────────

/**
 * 전체 트리를 WASM Taffy로 레이아웃 계산.
 *
 * Phase 2: Persistent Taffy Tree
 * - Path A (초기 빌드): DFS → buildFull() → computeLayout() → getLayoutsBatch()
 * - Path B (증분 갱신): DFS → incrementalUpdate() → computeLayout() → getLayoutsBatch()
 *
 * DFS 순회는 항상 수행 (implicit style, enrichment, CSS resolve 필요).
 * 초기 빌드 후 증분 갱신은 변경된 노드만 WASM 호출하여
 * Taffy internal dirty cache를 최대한 활용한다.
 *
 * WASM 엔진이 사용 불가하거나 실패하면 null을 반환한다.
 * 호출부(BuilderCanvas)는 null 수신 시 레거시 레벨별 폴백으로 전환해야 한다.
 *
 * **ADR-125 Phase 1 transition note**: 본 entry 의 `elementsMap`/`childrenMap`
 * map shape signature 는 transition-derived-readonly. Phase 2 에서
 * `calculateFullTreeLayoutFromSceneModel(sceneModel, ...)` canonical-native
 * entry 가 primary path 로 전환된다. 본 entry 는 Phase 2 완료까지 유지하되
 * 신규 caller 는 `calculateFullTreeLayoutFromSceneModel` 사용 권장.
 *
 * @param rootElementId  - 루트 컨테이너 요소 ID (보통 body 또는 page root)
 * @param elementsMap    - O(1) 요소 조회 맵 (canonical scene model derived view)
 * @param childrenMap    - O(1) 자식 ID 목록 맵 (canonical scene model derived view)
 * @param availableWidth - 루트에 제공할 가용 너비 (px)
 * @param availableHeight- 루트에 제공할 가용 높이 (px)
 * @param getChildElements - elementId → CanvasLayoutNode[] accessor
 * @returns elementId → ComputedLayout 맵, 실패 시 null
 */
export function calculateFullTreeLayout(
  rootElementId: string,
  elementsMap: Map<string, CanvasLayoutNode>,
  childrenMap: Map<string, string[]>,
  availableWidth: number,
  availableHeight: number,
  getChildElements: (id: string) => CanvasLayoutNode[],
): Map<string, ComputedLayout> | null {
  // WASM 가용성 확인
  if (!isRustWasmReady()) return null;

  // 루트 요소 존재 확인
  const rootEl = elementsMap.get(rootElementId);
  if (!rootEl) return null;

  // 페이지/Frame root 별 persistent tree 조회/생성.
  // Frame body 는 page_id 가 null 이므로 layout binding 으로 분리하지 않으면 여러
  // reusable Frame 이 "__default__" Taffy tree 를 공유해 root state 가 섞인다.
  const rootKey =
    rootEl.page_id ?? getFrameElementMirrorId(rootEl) ?? rootElementId;
  let persistentTree = persistentTrees.get(rootKey);
  if (!persistentTree) {
    persistentTree = new PersistentTaffyTree();
    persistentTrees.set(rootKey, persistentTree);
  }
  if (!persistentTree.isAvailable) return null;
  beginSyntheticElementsCollection();

  // ── Step 1: DFS post-order 순회 → 배치 배열 구성 ──────────────────
  //    (항상 수행 — implicit style, enrichment, CSS resolve 필요)
  const dfsCtx: DFSContext = {
    elementsMap,
    childrenMap,
    getChildElements,
    batch: [],
    indexMap: new Map<string, number>(),
    visiting: new Set<string>(),
    processedElementsMap: new Map<string, CanvasLayoutNode>(),
  };
  const { batch, indexMap, processedElementsMap } = dfsCtx;

  // TagGroup allowsRemoving 컨텍스트 설정 (모든 DFS/FlexEngine/재귀 경로에서 조회)
  setTagGroupAllowsRemovingContext(elementsMap, childrenMap);

  traversePostOrder(
    rootElementId,
    dfsCtx,
    availableWidth,
    availableHeight,
    getRootComputedStyle(),
    "block",
    0,
  );

  if (batch.length === 0) return null;

  // ── Step 1.5: Body(root) 요소에 breakpoint 페이지 크기 명시 ─────────
  // CSS height:auto → block 요소는 콘텐츠 높이에 맞춤 (body 높이 = 24px 문제)
  // 빌더 특수 케이스: body 크기 = breakpoint 토글 크기
  // → 자식의 width/height:100%가 페이지 크기 기준으로 계산되도록 보장
  //
  // NOTE: availableWidth/Height는 content-box (pageWidth - padding - border)
  //       Taffy style.size = border-box → padding/border 포함한 전체 페이지 크기 필요
  const rootIdx = indexMap.get(rootElementId);
  if (rootIdx !== undefined) {
    const rootEl = elementsMap.get(rootElementId);
    if (rootEl && rootEl.type.toLowerCase() === "body") {
      const rootStyle = (rootEl.props?.style ?? {}) as Record<string, unknown>;
      const bp = parsePadding(rootStyle, availableWidth);
      const bb = parseBorder(rootStyle);
      const pageW = availableWidth + bp.left + bp.right + bb.left + bb.right;
      const pageH = availableHeight + bp.top + bp.bottom + bb.top + bb.bottom;
      batch[rootIdx].style.width = `${pageW}px`;
      batch[rootIdx].style.height = `${pageH}px`;
    }
  }

  // ── Step 2: filteredChildIds 맵 구성 (batch 인덱스 → elementId 변환) ──
  const filteredChildIdsMap = new Map<string, string[]>();
  for (const node of batch) {
    filteredChildIdsMap.set(
      node.elementId,
      node.children.map((idx) => batch[idx].elementId),
    );
  }

  // Fix 1: 트리 소스 일원화 — filteredChildIdsMap 공유
  // Multi-page + frame authoring: layout map 과 동일한 root key fallback chain 사용.
  // frame body 는 frame mirror id 로 저장해야 page-mode filtered tree 와
  // frame-mode filtered tree 가 서로 `__default__` 에서 덮이지 않는다.
  publishFilteredChildrenMap(filteredChildIdsMap, rootKey);
  publishCollectedSyntheticElements(rootKey);

  // ── Step 3: 초기 빌드 또는 증분 갱신 ──────────────────────────────
  try {
    // display 타입 전환 감지 (flex↔grid↔block): incremental update로는
    // Taffy WASM이 올바르게 재계산하지 않으므로 full rebuild 필요
    let needsFullRebuild = !persistentTree.isInitialized;
    if (!needsFullRebuild) {
      // display/grid 전환 감지: Taffy 증분 갱신으로 처리 불가 → full rebuild
      for (const node of batch) {
        const prevJson = persistentTree.getLastJson(node.elementId);
        const curDisplay = node.style.display;
        // 신규 노드 (prevJson 없음) 가 grid container 면 full rebuild 필요 —
        // Taffy WASM `addNode` 증분 추가로는 grid track (gridTemplateColumns/Areas)
        // 이 auto-placement 로 degrade 됨. `buildFull` 로만 정상 배치.
        if (!prevJson) {
          if (isGridDisplay(curDisplay)) {
            needsFullRebuild = true;
            break;
          }
          continue;
        }
        const prevParsed = JSON.parse(prevJson);
        if (prevParsed.display !== curDisplay) {
          needsFullRebuild = true;
          break;
        }
        // Grid container 의 layout-영향 속성 변경: Taffy `updateStyleRaw` 가
        // track/placement 캐시 invalidation 실패 (padding 변경→1줄 degrade,
        // gap 변경→미반영). GRID_REBUILD_TRIGGER_KEYS 중 하나라도 변경 시
        // full rebuild 강제.
        if (isGridDisplay(curDisplay)) {
          let gridChanged = false;
          for (const k of GRID_REBUILD_TRIGGER_KEYS) {
            if (
              JSON.stringify(prevParsed[k]) !== JSON.stringify(node.style[k])
            ) {
              gridChanged = true;
              break;
            }
          }
          if (gridChanged) {
            needsFullRebuild = true;
            break;
          }
        }
      }
      // 자식 수 변경 감지는 incrementalUpdate의 updateChildren에서 처리
    }

    if (needsFullRebuild) {
      // Path A: 초기 빌드 또는 display 전환 시 full rebuild
      persistentTree.reset();
      persistentTree.buildFull(rootElementId, batch, filteredChildIdsMap);
    } else {
      // Path B: 증분 갱신 (JSON 비교로 변경된 노드만 WASM 호출)
      incrementalUpdate(persistentTree, batch, filteredChildIdsMap);
    }

    // ── Step 4: 레이아웃 계산 ─────────────────────────────────────────
    persistentTree.computeLayout(availableWidth, availableHeight);

    // ── Step 4.5: 2-pass height 교정 (width 변동 → 텍스트 줄바꿈 → height 재계산)
    // 1차 pass의 enrichment는 부모 availableWidth 기준이지만,
    // 실제 Taffy 할당 width는 grid 1fr, flex-grow/shrink, 부모 제약 등으로 달라질 수 있다.
    // 자식의 실제 width가 enrichment width와 다르면 → 실제 width로 re-enrich → 재계산.
    // 부모는 Taffy가 자식 height 합산으로 auto height를 자동 갱신한다.
    {
      const WIDTH_TOLERANCE = 2;
      let needsSecondPass = false;
      const childUpdates: Array<{
        nodeIndex: number;
        actualWidth: number;
      }> = [];

      const firstPassLayouts = persistentTree.getLayoutsBatch();

      // 모든 노드를 순회하며 실제 width vs enrichment width 비교
      for (let i = 0; i < batch.length; i++) {
        const node = batch[i];
        const childEl = elementsMap.get(node.elementId);
        if (!childEl) continue;

        // root(body) 노드는 Step 1.5에서 pageWidth/Height를 명시적으로 설정하므로 스킵
        if (node.elementId === rootElementId) continue;

        // auto height가 아닌 요소는 스킵 (고정 height는 줄바꿈 영향 없음)
        const childStyle = (childEl.props?.style ?? {}) as Record<
          string,
          unknown
        >;
        const rawH = childStyle.height;
        if (
          rawH !== undefined &&
          rawH !== null &&
          rawH !== "auto" &&
          rawH !== "fit-content"
        )
          continue;

        const handle = persistentTree.getHandle(node.elementId);
        if (handle === undefined) continue;
        const layout = firstPassLayouts.get(handle);
        if (!layout) continue;

        // enrichment 시 사용된 width 추정
        const rawW = childStyle.width;
        let enrichedWidth: number;
        if (typeof rawW === "number") {
          enrichedWidth = rawW;
        } else if (typeof rawW === "string" && rawW.endsWith("px")) {
          enrichedWidth = parseFloat(rawW) || availableWidth;
        } else if (typeof rawW === "string" && rawW.endsWith("%")) {
          enrichedWidth = (availableWidth * (parseFloat(rawW) || 100)) / 100;
        } else {
          enrichedWidth = availableWidth;
        }

        if (Math.abs(layout.width - enrichedWidth) > WIDTH_TOLERANCE) {
          childUpdates.push({
            nodeIndex: i,
            actualWidth: layout.width,
          });
          needsSecondPass = true;
        }
      }

      if (needsSecondPass) {
        const parentsToMarkDirty = new Set<string>();

        for (const { nodeIndex, actualWidth } of childUpdates) {
          const node = batch[nodeIndex];
          // DFS injection + implicit style이 적용된 element 사용 (store 원본 대신)
          // Label: DFS에서 fontSize/lineHeight 주입, ComboBoxTrigger: implicit에서 width/height 주입
          // store 원본 사용 시 이 값들이 소실되어 height가 잘못 계산됨
          const childEl =
            processedElementsMap.get(node.elementId) ??
            elementsMap.get(node.elementId);
          if (!childEl) continue;

          const childStyle = (childEl.props?.style ?? {}) as Record<
            string,
            unknown
          >;
          // 컨테이너(자식이 있는 요소)는 height 제거 — Taffy auto height 계산
          const childChildren = getChildElements(node.elementId);
          const filteredChildIds = filteredChildIdsMap.get(node.elementId);
          const isContainer =
            childChildren.length > 0 ||
            (filteredChildIds != null && filteredChildIds.length > 0);
          if (isContainer) {
            if (node.style.height) {
              delete node.style.height;
              persistentTree.updateNodeStyle(node.elementId, node.style);
            }
            continue;
          }

          // implicitStyles가 주입한 width를 element에 반영하여 re-enrich
          const batchWidth = node.style.width;
          const storeStyle = (elementsMap.get(node.elementId)?.props?.style ??
            {}) as Record<string, unknown>;

          const mergedStyle =
            batchWidth && !storeStyle.width
              ? { ...childStyle, width: batchWidth }
              : childStyle;
          const mergedEl =
            mergedStyle !== childStyle
              ? ({
                  ...childEl,
                  props: { ...childEl.props, style: mergedStyle },
                } as CanvasLayoutNode)
              : childEl;
          const childComputed = resolveStyle(
            mergedStyle,
            getRootComputedStyle(),
          );
          const reEnriched = enrichWithIntrinsicSize(
            mergedEl,
            actualWidth,
            availableHeight,
            childComputed,
            childChildren,
            getChildElements,
            false,
          );

          const reStyle = (reEnriched.props?.style ?? {}) as Record<
            string,
            unknown
          >;
          const origStyle = (childEl.props?.style ?? {}) as Record<
            string,
            unknown
          >;
          patchBatchStyleFromImplicit(node.style, origStyle, reStyle);
          const styleChanged = persistentTree.updateNodeStyle(
            node.elementId,
            node.style,
          );

          // 자식 height 변경 시 부모 dirty 수집
          if (styleChanged && childEl.parent_id) {
            parentsToMarkDirty.add(childEl.parent_id);
          }
        }

        // 부모 + 조부모 명시적 dirty 마킹
        // grid 내 flex 컨테이너(GridListItem) 등에서 dirty propagation 보장
        for (const parentId of parentsToMarkDirty) {
          persistentTree.markDirty(parentId);
          const parentEl = elementsMap.get(parentId);
          if (parentEl?.parent_id) {
            persistentTree.markDirty(parentEl.parent_id);
          }
        }

        persistentTree.computeLayout(availableWidth, availableHeight);
      }
    }

    // ── Step 5: 결과 수집 → Map<elementId, ComputedLayout> ──────────
    const layoutBatch = persistentTree.getLayoutsBatch();
    const result = new Map<string, ComputedLayout>();

    sanitizeStats.count = 0;

    for (let i = 0; i < batch.length; i++) {
      const node = batch[i];
      const handle = persistentTree.getHandle(node.elementId);
      if (handle === undefined) continue;
      const layoutResult = layoutBatch.get(handle);
      if (!layoutResult) continue;

      // margin 정보 (ComputedLayout.margin 필드용)
      const elementStyle = (elementsMap.get(node.elementId)?.props?.style ??
        {}) as Record<string, unknown>;
      const margin = parseMargin(elementStyle);

      result.set(node.elementId, {
        elementId: node.elementId,
        x: sanitizeLayoutValue(layoutResult.x),
        y: sanitizeLayoutValue(layoutResult.y),
        width: sanitizeLayoutValue(layoutResult.width),
        height: sanitizeLayoutValue(layoutResult.height),
        margin: {
          top: sanitizeLayoutValue(margin.top),
          right: sanitizeLayoutValue(margin.right),
          bottom: sanitizeLayoutValue(margin.bottom),
          left: sanitizeLayoutValue(margin.left),
        },
      });
    }

    if (sanitizeStats.count > 0 && import.meta.env.DEV) {
      console.warn(
        `[fullTreeLayout] Sanitized non-finite values: ${sanitizeStats.count}`,
      );
    }
    sanitizeStats.count = 0; // 매 호출 리셋

    // GAP 4: overflow:scroll/auto 요소의 maxScroll 업데이트
    for (const [elementId, layout] of result) {
      const el = elementsMap.get(elementId);
      const elStyle = (el?.props?.style ?? {}) as Record<string, unknown>;
      const overflow = elStyle?.overflow as string | undefined;
      if (overflow === "scroll" || overflow === "auto") {
        const scrollChildIds = childrenMap.get(elementId) ?? [];
        let maxRight = 0;
        let maxBottom = 0;
        for (const cid of scrollChildIds) {
          const cl = result.get(cid);
          if (cl) {
            maxRight = Math.max(
              maxRight,
              cl.x + cl.width + (cl.margin?.right ?? 0),
            );
            maxBottom = Math.max(
              maxBottom,
              cl.y + cl.height + (cl.margin?.bottom ?? 0),
            );
          }
        }
        // queueMicrotask: 렌더링 중 setState 방지 (React strict mode)
        const scrollTop = Math.max(0, maxBottom - layout.height);
        const scrollLeft = Math.max(0, maxRight - layout.width);
        queueMicrotask(() => {
          useScrollState
            .getState()
            .updateMaxScroll(elementId, scrollTop, scrollLeft);
        });
      }
    }

    return result;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[fullTreeLayout] WASM failed:", err);
    }
    // 에러 시 해당 root 의 persistent tree만 리셋 → 다음 프레임에 초기 빌드(Path A) 재시도
    resetPersistentTree(rootKey);
    return null;
  }
  // Phase 1: finally { taffy.clear() } 제거 — persistent tree 유지
}

/**
 * **ADR-125 Phase 1 — canonical-native layout entry**.
 *
 * `CanonicalSceneModel` 을 직접 입력으로 받아 layout 을 계산하는 transitional
 * entry. 내부적으로 scene model 의 derived `elementsMap`/`childrenByParent` 를
 * `calculateFullTreeLayout` 에 전달한다.
 *
 * Phase 1 에서는 기존 `calculateFullTreeLayout(rootElementId, elementsMap,
 * childrenMap, ...)` map shape entry 와 **동등** 하다 (signature wrapping 만).
 * Phase 2 에서 fullTreeLayout 내부 traversal 이 canonical-native 로 전환되면
 * 본 entry 가 primary path 가 되고 map shape entry 는 deprecated 마킹.
 *
 * **신규 caller 는 본 entry 를 사용한다 (transition contract)**.
 *
 * @param sceneModel       - canonical document 에서 derived 된 scene snapshot
 * @param rootElementId    - 루트 컨테이너 요소 ID
 * @param availableWidth   - 루트에 제공할 가용 너비 (px)
 * @param availableHeight  - 루트에 제공할 가용 높이 (px)
 * @param getChildElements - elementId → CanvasLayoutNode[] accessor (optional, 미전달 시
 *                           sceneModel.childrenByParent 사용)
 * @returns elementId → ComputedLayout 맵, 실패 시 null
 */
export function calculateFullTreeLayoutFromSceneModel(
  sceneModel: {
    elementsMap: Map<string, CanvasLayoutNode>;
    childrenByParent: Map<string, CanvasLayoutNode[]>;
  },
  rootElementId: string,
  availableWidth: number,
  availableHeight: number,
  getChildElements?: (id: string) => CanvasLayoutNode[],
): Map<string, ComputedLayout> | null {
  // childrenByParent (CanvasLayoutNode[]) 를 childrenMap (string[]) 로 derive
  const childrenIdMap = new Map<string, string[]>();
  for (const [parentId, children] of sceneModel.childrenByParent) {
    childrenIdMap.set(
      parentId,
      children.map((child) => child.id),
    );
  }

  const accessor =
    getChildElements ??
    ((id: string) => sceneModel.childrenByParent.get(id) ?? []);

  return calculateFullTreeLayout(
    rootElementId,
    sceneModel.elementsMap,
    childrenIdMap,
    availableWidth,
    availableHeight,
    accessor,
  );
}
