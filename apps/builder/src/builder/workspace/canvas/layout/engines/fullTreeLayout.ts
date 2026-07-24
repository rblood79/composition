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
import type { TaffyStyle } from "../../wasm-bindings/layoutTypes";
import { isCompositionEngineReady } from "../../wasm-bindings/compositionEngineWasm";
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
  calculateContentWidth,
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
  isInlineBlockSimulationParent,
  needsBlockChildFullWidth,
} from "./taffyDisplayAdapter";
import { elementToTaffyBlockStyle } from "./TaffyBlockEngine";
import { elementToTaffyStyle } from "./TaffyFlexEngine";
import { parseGridTemplate } from "./TaffyGridEngine";
import {
  applyImplicitStyles,
  resolveContainerStylesFallback,
  resolveEffectiveOverflow,
} from "./implicitStyles";
import { resolvePropagatedProps } from "../../../../utils/propagationEngine";
import {
  getPropagationRules,
  getParentTagsForChild,
} from "../../../../utils/propagationRegistry";
import { extractSpecTextStyle } from "../../utils/specTextStyle";
import { fontFamily as specFontFamily } from "@composition/specs";
// ADR-912 단계5 step4 (2026-06-17): InlineAlertSpec import 제거 — InlineAlert 자식 font 분기를
//   resolveSkiaRule("InlineAlert").sizes read-through 로 이관(spec 삭제 선행, rule fallback).
import { resolveSkiaRule } from "../../skia/resolveSkiaVisualRule";
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
// ADR-912 (2026-06-14): CheckboxItems/RadioItems 중간 컨테이너 폐기 → 래퍼 멤버 제거.
//   Checkbox/Radio 는 여전히 Label 자식 보유 → 유지.
const LABEL_WRAPPER_TAGS = new Set(["Checkbox", "Radio"]);

// ADR-150 A2: scrollOffset 기반 가상화(collectionVirtualization) 대상 collection owner.
//   이들은 data-bound(props.items/rows) 라 childrenMap element 자식이 0개이고, 스크롤
//   content 는 projection(spacer 총 높이)으로 표현된다. GAP 4 의 childrenMap 기반 maxScroll
//   (=자식 0 → 0)이 BuilderCanvas 의 projection-height 기반 updateMaxScroll(정확값)을 덮어쓰지
//   않도록, childrenMap 이 빈 경우 GAP 4 에서 skip 한다(자식 있는 static collection 은 GAP 4 유지).
const A2_WINDOWED_COLLECTION_TAGS = new Set(["ListBox", "GridList", "Table"]);

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

// dev 전용 디버그 전역 — 콘솔/자동화(Chrome MCP) 의 CSS↔Skia parity 검증 하니스가
// layout 결과를 읽는 단일 진입점. 콘솔 dynamic import('/src/...') 는 Vite HMR 이후
// 앱 그래프와 다른 모듈 인스턴스를 받아 module-level map 이 비어 보이는 문제가 있어
// (2026-07-13 parity sweep 실측) window 전역으로 우회한다. production 빌드 제외.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_LAYOUT_DEBUG__ =
    {
      getSharedLayoutMap,
      getSharedLayoutVersion,
    };
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

/** dimension 값(number|string)을 WASM 이 기대하는 px string 으로 정규화.
 *  `taffyStyleToRecord` 내부 `dim()` 과 동일 계약이나, **grid branch** 는
 *  `applyCommonTaffyStyle`(숫자 그대로 반환) 결과를 partial 로 직접 반환하여
 *  `taffyStyleToRecord.dim()` 정규화를 우회한다. 이 buildFull 경로는
 *  `normalizeStyle.dimToString()` 후처리도 거치지 않으므로(그 후처리는
 *  persistentTaffyTree createNode/updateStyle 경로 전용), grid branch 가
 *  직접 본 헬퍼로 gap/padding/border/dimension 을 px string 화해야 한다.
 *
 *  **Why (2026-07-06 전수조사)**: ProgressBar/Meter/Slider 는 factory 가
 *  `rowGap: 4`(숫자) + `display: grid` 로 저장 → grid branch 가 숫자 rowGap 을
 *  그대로 batch 에 넣어 `build_tree_batch: invalid type integer 4, expected
 *  string` parse error → calculateFullTreeLayout null → persistentTree 리셋
 *  무한 재시도 → 레이아웃 전면 실패. grid branch 만의 정규화 공백. */
const GRID_DIM_FIELDS = [
  "rowGap",
  "columnGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "insetTop",
  "insetRight",
  "insetBottom",
  "insetLeft",
  // flexBasis — grid item 이 flex/grid 부모의 자식이면 applyFlexItemProperties 가
  // parseCSSPropWithContext 결과(number 가능)를 partial.flexBasis 에 주입. IMPLICIT_DIM_PROPS /
  // taffyStyleToRecord.dim() 양쪽 모두 flexBasis 를 dim 대상으로 포함 → grid branch 도 정합.
  "flexBasis",
] as const;

function normalizeGridDimFields(partial: Record<string, unknown>): void {
  for (const key of GRID_DIM_FIELDS) {
    const v = partial[key];
    if (typeof v === "number") partial[key] = `${v}px`;
  }
}

/** Grid container 의 layout-영향 속성 — 증분 갱신에서 변경 시 full rebuild 필요.
 *  Taffy `updateStyleRaw`(=set_style) 가 track/placement 캐시 invalidation 실패.
 *
 *  dimension(width/height/min/max) 추가 (2026-06-16): grid container **자신**의 width/height
 *  변경 시 incremental 경로(updateStyleRaw)에선 1fr/auto track 이 변경 전 컨테이너 폭 기준으로
 *  stale degrade(1줄로 무너짐) → 브라우저 새로고침(buildFull) 후에만 정상 2행. padding/gap 과
 *  동일 병인(grid track/placement 캐시 미무효화) → 동일 처방(full rebuild). 신규 grid container
 *  (`!prevJson`) 는 이미 needsFullRebuild 강제 대상이므로, 본 키들은 **기존** grid container 의
 *  dimension 변경 케이스를 커버한다. */
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
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
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
  modStyle: Record<string, unknown>,
): void {
  // 각 modStyle key 를 Taffy 형식 (targetKey, coercedVal) 로 정규화한 뒤
  // batchStyle 의 현재 값과 비교해 달라진 경우에만 패치한다.
  //
  // batchStyle (= 실제 패치 대상) 기준 비교가 핵심: origStyle (DB 원본) 기준으로
  // skip 하면 size 변경 시 2회 fullRebuild 에서 batchStyle 이 직전 pass 값으로 stale 된다.
  // 예) SliderThumb width 가 sm pass 에서 "14px" 로 patch → md pass 에서
  // modStyle.width(18) === origStyle.width(18, factory baked) 로 skip → batchStyle 은
  // "14px" 유지 → position:absolute/left 상호작용으로 box 가 block(x=0,w=100%,h=0) degrade.
  // batchStyle 기준 비교는 그 stale 을 잡으면서 (14px ≠ 18px → patch) 동일 값 재설정도 피한다.
  for (const key of Object.keys(modStyle)) {
    const val = modStyle[key];
    if (val === undefined) continue;

    // flex shorthand → flexGrow/flexShrink/flexBasis 분해 (multi-key, 별도 처리)
    if (key === "flex") {
      const n = Number(val);
      if (!isNaN(n)) {
        batchStyle.flexGrow = n;
        batchStyle.flexShrink = 1;
        batchStyle.flexBasis = "0%";
      }
      continue;
    }

    // key 정규화 + 값 강제 변환 → (targetKey, coercedVal)
    let targetKey = key;
    let coercedVal: unknown;
    if (IMPLICIT_DIM_PROPS.has(key)) {
      coercedVal = typeof val === "number" ? `${val}px` : val;
    } else if (key === "flexGrow" || key === "flexShrink" || key === "order") {
      coercedVal = Number(val);
    } else if (key === "position") {
      coercedVal = val === "absolute" || val === "fixed" ? "absolute" : val;
    } else if (
      key === "left" ||
      key === "top" ||
      key === "right" ||
      key === "bottom"
    ) {
      // CSS left/top/right/bottom → Taffy insetLeft/Top/Right/Bottom
      targetKey = `inset${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      coercedVal = typeof val === "number" ? `${val}px` : String(val);
    } else if (
      key === "gridTemplateColumns" ||
      key === "gridTemplateRows" ||
      key === "gridAutoColumns" ||
      key === "gridAutoRows"
    ) {
      // CSS string ("1fr auto") → WASM 이 기대하는 array 로 정규화
      coercedVal = coerceGridTrack(val);
    } else if (typeof val === "string") {
      coercedVal = val; // display, flexDirection, alignItems 등
    } else if (Array.isArray(val)) {
      coercedVal = val; // gridTemplateAreas 등
    } else {
      continue; // 지원하지 않는 타입
    }

    // batchStyle 이 이미 정확한 값을 가지면 skip (array 는 참조 비교라 항상 patch)
    if (!Array.isArray(coercedVal) && batchStyle[targetKey] === coercedVal) {
      continue;
    }
    batchStyle[targetKey] = coercedVal;
  }
}

// ─── TaffyStyle → Record 변환 ────────────────────────────────────────

/**
 * TaffyStyle 객체를 JSON 직렬화 가능한 Record로 변환.
 *
 * 자체 엔진 pkg 에 전달할 style JSON 정규화 규칙을 적용한다.
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
  let mergedStyle = hasFallback ? { ...specFallback, ...rawStyle } : rawStyle;

  // ToggleButtonGroup: flexDirection 의 SSOT 는 `orientation` prop 이다(2026-06-28).
  //   orientation 이 horizontal/vertical 이면 그에 맞는 flexDirection(row/column)을 강제하고
  //   stale inline `style.flexDirection`(과거 factory 잔재)을 무시한다. 미주입 시 self-node
  //   계산이 mergedStyle.flexDirection(=inline row)만 보고 row 로 고정 → orientation=vertical
  //   전환이 self-node 단에서 무력화(applyImplicitStyles 의 부모→자식 column 처리와 split-brain).
  //   CSS([data-orientation]) / applyImplicitStyles 와 동일하게 orientation 단일 기준으로 정렬.
  if (type === "togglebuttongroup") {
    const orientation = (element.props as { orientation?: string } | undefined)
      ?.orientation;
    if (orientation === "vertical" || orientation === "horizontal") {
      mergedStyle = {
        ...mergedStyle,
        flexDirection: orientation === "vertical" ? "column" : "row",
      };
    }
  }

  const enriched: CanvasLayoutNode =
    hasFallback || type === "togglebuttongroup"
      ? { ...element, props: { ...element.props, style: mergedStyle } }
      : element;

  const display = getElementDisplay(enriched);
  const normalized = display.trim().toLowerCase();

  if (normalized === "flex" || normalized === "inline-flex") {
    const taffyStyle: TaffyStyle = elementToTaffyStyle(enriched, computedStyle);
    const record = taffyStyleToRecord(taffyStyle);
    // Calendar/RangeCalendar: width:fit-content 를 엔진 FIT_CONTENT(-2) 센티넬로
    //   통과 (allowlist). parseCSSPropWithContext 는 intrinsic 키워드를 전역 drop
    //   하고 enrichWithIntrinsicSize 의 numeric 선해석에 의존하지만, Calendar
    //   컨테이너 intrinsic 은 자식(CalendarGrid) 측정에 의존해 선해석이 불가 →
    //   drop 시 auto(stretch)로 발산 (CSS fit-content 256 vs Skia 390/768 —
    //   2026-07-13 parity sweep). 엔진은 block 자식 intake(tree_golden N8) +
    //   flex cross 축(a359d513a)에서 shrink-to-fit 을 지원한다. 전역 passthrough
    //   는 2-pass 재계산과의 상호작용 미검증이라 allowlist 로 한정.
    if (
      (type === "calendar" || type === "rangecalendar") &&
      mergedStyle.width === "fit-content" &&
      record.width === undefined
    ) {
      record.width = "fit-content";
    }
    return record;
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

    // dimension 필드(gap/padding/border/size/margin/inset) 숫자 → px string 정규화.
    // grid branch 는 partial 직접 반환이라 taffyStyleToRecord.dim() /
    // normalizeStyle.dimToString() 을 우회 → 숫자가 그대로 build_tree_batch 로 가면
    // WASM parse error("expected string"). flex 경로(taffyStyleToRecord)와 대칭 확보.
    normalizeGridDimFields(partial);

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
  //
  // ADR-912 (TableView 자식 Skia 대칭, 2026-06-25): flex item 속성 source 는 원본
  //   element.props.style 이 아니라 mergedStyle(catalog/spec fallback merge 결과)이어야 한다.
  //   Column/Cell 은 display 미보유 → 본 block 경로로 진입하는데, 이들의 `flex:"1"` 은
  //   catalog rule(COMPONENT_RULES_TABLE.Column/Cell.containerStyles)에만 있고 원본
  //   props.style 에는 없다. 원본만 보던 기존 코드는 catalog flex 를 누락 → flex item grow
  //   미적용 → Skia 에서 Column/Cell 이 intrinsic(fit-content/0) 폭으로 붕괴, 텍스트 겹침 +
  //   Preview(renderTableView 인라인 flex:1)와 비대칭. flex/grid 분기는 이미 enriched/mergedStyle
  //   을 쓰므로(line 714/723) block 분기만 비대칭이었다. mergedStyle 로 정합.
  //   회귀 범위 0: top-level containerStyles.flex 보유 type 은 Column/Cell 뿐(grep 확증),
  //   다른 fallback 키(display/flexDirection 등)는 applyFlexItemProperties 가 무시.
  if (FLEX_GRID_DISPLAYS.has(parentDisplay)) {
    applyFlexItemProperties(record, mergedStyle);
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

/**
 * TagGroup maxRows chip 접힘 — Taffy 실측 chip y좌표(rowY) 기반으로 유지할 chip id 를 산출한다.
 *
 * **폭 가변 견고**: 폭 값을 전혀 쓰지 않고 Taffy 가 배치한 각 chip 의 실제 rowY 로 행 번호를 매핑,
 * `행 번호 ≥ maxRows` 인 비-Show all chip 을 제외한다. CSS 정본 알고리즘(`TagGroup.tsx`
 * `computeVisibleTagCount`: getBoundingClientRect y 로 rowCount, `rowCount > maxRows` break)과
 * 동일 원리 — DOM getBoundingClientRect y ↔ Taffy layout y 대응.
 *
 * @param chips - RowsGroup 자식 chip (id + Taffy 실측 y + Show all 여부), emit 순서 보존
 * @param maxRows - 표시 최대 행 수 (owner TagGroup.props.maxRows)
 * @returns keep - Taffy 트리에 유지할 chip id 배열. 접힘 발생 시 Show all 유지, 미발생 시 Show all 제외.
 */
export function computeTagFoldKeep(
  chips: ReadonlyArray<{ id: string; y: number; isShowAll: boolean }>,
  maxRows: number,
): string[] {
  if (chips.length === 0 || maxRows <= 0)
    return chips.filter((c) => !c.isShowAll).map((c) => c.id);
  // 고유 rowY → 행 번호 매핑 (오름차순). Taffy 실배치 기준이라 폭 무관.
  const uniqueYs = [...new Set(chips.map((c) => c.y))].sort((a, b) => a - b);
  const rowIndexOf = (y: number): number => uniqueYs.indexOf(y);
  // 표시 행 수(비-Show all chip 기준, Show all 은 별도 행일 수 있어 제외하고 계산).
  const itemRowCount = new Set(
    chips.filter((c) => !c.isShowAll).map((c) => c.y),
  ).size;
  if (itemRowCount <= maxRows) {
    // 접힘 불필요 → 모든 item chip 유지 + Show all 제외 (미접힘이니 불필요).
    return chips.filter((c) => !c.isShowAll).map((c) => c.id);
  }
  // 접힘 발생 → 행 번호 ≥ maxRows 인 비-Show all chip 제외 + Show all 유지.
  return chips
    .filter((c) => c.isShowAll || rowIndexOf(c.y) < maxRows)
    .map((c) => c.id);
}

/**
 * side-label TagGroup 의 명시(preserve) height 를 제거해야 하는지 판정 (2026-07-02).
 *
 * labelPosition="side" 인 TagGroup 은 `sideLabelProjectionContainer` 판정으로
 *   `preserveEnrichHeight=true` → enrich 의 calculateContentHeight(추정 wrap, stale mirror
 *   items 기반) 가 산출한 명시 height 가 Taffy 에 강제된다. Step 4.5b/c 가 자식(TagList/RowsGroup)
 *   을 자식-bottom 실측으로 교정해도 부모 명시 height 는 fixed 라 갱신 안 됨 → selection 여분 공백.
 *   자식 교정 시점에 부모 명시 height 를 제거해 Taffy row auto height(max 자식)로 재계산시킨다.
 *
 * 제거 대상 조건 (3가지 모두):
 *   1. type === "TagGroup"
 *   2. labelPosition === "side" (row 배치 → preserve 대상)
 *   3. 사용자 명시 CSS height 없음 (있으면 사용자 의도 보존)
 *
 * top-label(column)은 preserve 미적용(자식 2개 → auto 합산 자연 수렴)이라 대상 아님.
 */
export function shouldClearSideLabelTagGroupHeight(
  parentProps:
    | { type?: string; labelPosition?: unknown; styleHeight?: unknown }
    | undefined,
): boolean {
  if (!parentProps) return false;
  const hasUserHeight =
    parentProps.styleHeight !== undefined && parentProps.styleHeight !== "auto";
  return (
    parentProps.type === "TagGroup" &&
    parentProps.labelPosition === "side" &&
    !hasUserHeight
  );
}

/**
 * bounded-scroll collection owner 판정 — height/maxHeight px + overflow(-y) scroll/auto.
 *
 * `collectionVirtualization.ts` 의 scroll-mode 판정(readBoundedHeightPx + isScrollOverflow)과
 * 동일 의미론 (그 둘은 module-private 이라 미러 — scene→layout 역방향 import 순환 회피).
 *
 * **Why (2026-07-22, ListBox 인스턴스 maxHeight:300 + 긴 label/desc)**: bounded-scroll owner 가
 * `onlyProjectionRowsChild` preserve 에 걸리면 enrich 의 1-pass 추정 height(단일 줄 행 합산)가
 * Taffy 에 동결된다. Step 4.5 2-pass 가 행을 wrap 실측(§1.55b-2 wrapContext)으로 재계산해
 * rowsGroup 은 커지는데(400) owner 는 동결값(234)에 머물러 CSS(min(content, maxHeight)=300)와
 * 발산 + 행 clip. bounded-scroll owner 는 preserve 를 제외해 Taffy auto(자식 실측 합) +
 * max_size(maxHeight) clamp 로 CSS 와 정합시킨다. **sample-mode(auto-height, ADR-157) owner 는
 * bounded 가 아니므로 본 판정 false → preserve 유지** — 표시 정책 불변.
 */
export function isBoundedScrollOwnerStyle(
  style: Record<string, unknown> | undefined,
): boolean {
  if (!style) return false;
  const overflowY = style.overflowY ?? style.overflow;
  if (overflowY !== "scroll" && overflowY !== "auto") return false;
  const raw = style.height ?? style.maxHeight;
  if (typeof raw === "number") return raw > 0;
  if (typeof raw === "string") {
    const match = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(raw.trim());
    if (match) return Number.parseFloat(match[1]) > 0;
  }
  return false;
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
      // ADR-912 단계5 step4 (2026-06-17): InlineAlertSpec.sizes 직독 → resolveSkiaRule read-through.
      const inlineAlertRule = resolveSkiaRule("InlineAlert");
      const specSize = (inlineAlertRule?.sizes[parentSize] ??
        inlineAlertRule?.sizes[inlineAlertRule.defaultSize ?? "md"] ??
        {}) as unknown as Record<string, unknown>;
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

  // Tag → TagGroup 부모 size 상속 (CSS data-tag-size parent delegation 에뮬레이션)
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
    // ADR-912 (2026-06-14): CheckboxItems/RadioItems 래퍼 폐기 → Checkbox/Radio 의 직접
    //   부모가 곧 CheckboxGroup/RadioGroup. 중간 래퍼 통과 로직 제거.
    const ancestor = elementsMap.get(rawElement.parent_id);
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
        // 래퍼 태그면 계속 상위 탐색 (Label → Checkbox → CheckboxGroup)
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
  // ADR-912 (TableView 자식 Skia 대칭, 2026-06-25): effectiveDisplay 는 원본 element 가 아니라
  //   catalog/spec fallback(resolveContainerStylesFallback) 의 display 를 반영해야 한다. Row/
  //   TableHeader/TableBody 는 display 를 catalog rule.containerStyles 에만 선언하고 factory
  //   props.style 에는 안 둔다(layout SSOT=catalog). 원본만 보던 기존 코드는 이들을 "block" 으로
  //   처리 → 자식(Column/Cell)에게 parentDisplay="block" 을 전달 → flex item 처리 미발동 →
  //   Column/Cell 이 block child 로 세로 stacking(Skia 텍스트 겹침) + Preview(renderTableView
  //   flex row)와 비대칭. buildNodeStyle(line 703)은 이미 fallback 을 자체 적용하므로 traverse 의
  //   parentDisplay 전파만 비대칭이었다. fallback display 를 elementStyle 에 merge 해 정합.
  //   회귀 범위: fallback 에 display 를 가진 cutover 컨테이너(TagGroup/ListBox/Menu/Tree 등 +
  //   Table 자식 5종)만 영향 — 이들은 본래 flex/grid 컨테이너로 인식돼야 정상(기존 spec 보유
  //   시점과 동일 동작). spec 보유 type 은 specFallback 이 동일 display 를 줘 무변화.
  const displayFallback = resolveContainerStylesFallback(
    (element.type ?? "").toLowerCase(),
    elementStyle,
  ).display;
  const effectiveElement =
    typeof displayFallback === "string" && elementStyle.display === undefined
      ? {
          ...element,
          props: {
            ...element.props,
            style: { ...elementStyle, display: displayFallback },
          },
        }
      : element;
  // 이후 하류 로직(자식 width 주입 / buildNodeStyle / enrich)이 일관되게 fallback display 를
  //   인지하도록 element 를 effectiveElement 로 통일. buildNodeStyle 은 자체 fallback 을 재적용하나
  //   effectiveDisplay 분기(grid/flex 자식 처리)와 element 가 어긋나지 않게 source 단일화.
  element = effectiveElement;
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

  // side-label row 컨테이너: 비-Label 자식 availableWidth 에서 Label 자연폭 차감
  //   (grid 트랙 폭 조정과 동형 — flex-direction:row 의 1fr 대응).
  // **Why (TagGroup side height 버그)**: labelPosition="side" 면 컨테이너가 row 로 바뀌어
  //   Label(자연폭 고정) + items-wrapper(TagList, flex:1) 가 가로 배치된다. CSS 의
  //   `.tag-list-wrapper`(RAC `.react-aria-TagList`)는 Label 옆 남은 폭에서 칩을 flex-wrap 한다.
  //   그러나 이 루프가 wrapper 자식에 컨테이너 전체 폭(availableWidth)을 그대로 넘기면,
  //   enrichWithIntrinsicSize 가 그 폭 기준으로 칩 wrap 을 계산해 1줄 height(28)를 박는다.
  //   부모(TagGroup) 자신은 calculateContentHeight 차감 분기로 2줄 height(60)를 산출하지만,
  //   Taffy 는 자식 wrapper 의 명시 height(28)를 우선하므로 컨테이너가 54 로 고정 → 칩 2줄째가
  //   박스 밖으로 삐져나간다(side 전환 시 selection 높이 불변). CheckboxGroup/RadioGroup 은
  //   synthetic wrapper 가 flexShrink:0 자연폭이라 이 폭 불일치를 구조적으로 회피하지만,
  //   TagGroup 의 TagList(RAC export element)는 flex:1 이라 여기서 폭 차감이 필요하다.
  // 적용 조건: row flex + Label 자식 존재. 비-Label 자식에 (전체폭 − Label폭 − gap) 전달.
  let sideLabelChildAvailWidth: number | undefined;
  let sideLabelChildIds: Set<string> | undefined;
  if (
    (effectiveDisplay === "flex" || effectiveDisplay === "inline-flex") &&
    elementStyle.flexDirection === "row" &&
    childAvail.width !== undefined &&
    childAvail.width > 0
  ) {
    const labelChild = filteredChildren.find((c) => c.type === "Label");
    const nonLabelChildren = filteredChildren.filter((c) => c.type !== "Label");
    if (labelChild && nonLabelChildren.length > 0) {
      // effectiveGetChildElements(parent-delegated 래퍼)는 아래 1568 정의 — 이 시점엔
      //   TDZ 라 원본 getChildElements 사용(Label 폭 측정엔 충분, grid 트랙 조정과 동일).
      const labelChildren = getChildElements?.(labelChild.id);
      const labelWidth = calculateContentWidth(
        labelChild,
        labelChildren,
        getChildElements,
        computedStyle,
      );
      const gapVal =
        typeof elementStyle.gap === "number"
          ? elementStyle.gap
          : parseFloat(String(elementStyle.gap ?? "0")) || 0;
      sideLabelChildAvailWidth = Math.max(
        0,
        childAvail.width - labelWidth - gapVal,
      );
      sideLabelChildIds = new Set(nonLabelChildren.map((c) => c.id));
    }
  }

  for (const childId of sortedChildIds) {
    // side-label row: 비-Label 자식은 Label 폭을 차감한 폭으로 enrich (wrap 정합)
    const childWidth =
      sideLabelChildAvailWidth !== undefined && sideLabelChildIds?.has(childId)
        ? sideLabelChildAvailWidth
        : childAvail.width;
    traversePostOrder(
      childId,
      ctx,
      childWidth,
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
  //
  // **synthetic 컨테이너 (CheckboxGroup/RadioGroup `__items` wrapper, 2026-06-19)**:
  //   wrapper.props.__synthChildIds 가 있으면 자식 보유 synthetic 컨테이너다. 자식 item
  //   (Checkbox/Radio)은 filteredChildren 에 유지돼 위 post-order 재귀(3.)에서 이미 batch 에
  //   등록됐으므로 indexMap 으로 조회해 wrapper children 으로 연결한다. 그러면 filteredChildIdsMap
  //   (Step 2)이 wrapperId→[itemIds] 를 자동 생성 → Taffy 2단 트리 구성(CSS `.checkbox-items` 동형).
  for (const synthChild of filteredChildren) {
    if (elementsMap.has(synthChild.id) || indexMap.has(synthChild.id)) continue;

    const synthChildIds = (synthChild.props as Record<string, unknown>)
      ?.__synthChildIds as string[] | undefined;
    const synthChildIndices: number[] = [];
    if (synthChildIds) {
      for (const itemId of synthChildIds) {
        const itemIdx = indexMap.get(itemId);
        if (itemIdx !== undefined) synthChildIndices.push(itemIdx);
      }
    }

    const synthStyle = (synthChild.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const synthComputed = resolveStyle(synthStyle, computedStyle);
    const isSynthFlexChild = FLEX_GRID_DISPLAYS.has(effectiveDisplay);
    // 컨테이너 wrapper 는 자식 layout-node 를 enrich/buildNodeStyle 에 전달해 Taffy 가
    //   자식 합산으로 wrapper 크기를 산출하게 한다(leaf 는 빈 배열).
    const synthChildNodes = synthChildIds
      ? (synthChildIds
          .map((id) => elementsMap.get(id))
          .filter(Boolean) as CanvasLayoutNode[])
      : [];
    // buildNodeStyle 계약: 3번째 인자 = 자식 display 문자열 배열(grid/vertical-align 분기용),
    //   5번째 인자 = 자식 layout-node 배열. wrapper 는 flex 라 display 배열 미소비지만
    //   타입 계약 + 향후 grid 분기 대비로 정확히 전달.
    const synthChildDisplays = synthChildNodes.map((n) => getElementDisplay(n));
    const synthEnriched = enrichWithIntrinsicSize(
      synthChild,
      childAvail.width,
      childAvail.height,
      synthComputed,
      synthChildNodes,
      getChildElements,
      isSynthFlexChild,
    );
    const synthRecord = buildNodeStyle(
      synthEnriched,
      synthComputed,
      synthChildDisplays,
      effectiveDisplay,
      synthChildNodes,
    );
    batch.push({
      style: synthRecord,
      children: synthChildIndices,
      elementId: synthChild.id,
    });
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
    patchBatchStyleFromImplicit(batch[batchIdx].style, modStyle);

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
          (filteredChild.props as Record<string, unknown>)?.label ??
            (filteredChild.props as Record<string, unknown>)?.text ??
            (filteredChild.props as Record<string, unknown>)?.children ??
            "",
        );
        if (childText) {
          // ADR-912 영역 B (A): 순수 measureTextWidth 는 type-specific 부속(Tag remove X /
          //   Button icon 등) 폭을 누락한다. calculateContentWidth(type 분기 포함)로 교체해
          //   fit-content 재계산이 content-width 를 generic 하게 산출하게 한다 — Tag chip 의 X
          //   공간이 fit-content 에 포함되어 Tag.spec X 우측정렬이 라벨과 겹치지 않는다.
          //   주입된 fontSize 를 element.props.style 에 반영해 type 분기가 올바른 fontSize 로 계산.
          const childForWidth: CanvasLayoutNode = {
            ...filteredChild,
            props: {
              ...filteredChild.props,
              style: {
                ...(filteredChild.props?.style as
                  | Record<string, unknown>
                  | undefined),
                fontSize: childFs,
              },
            },
          };
          const correctedWidth = Math.ceil(
            calculateContentWidth(childForWidth),
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
  // ADR-912 (2026-06-14): CheckboxItems/RadioItems propagation 중계 제거.
  //   중간 컨테이너 폐기로 CheckboxGroup/RadioGroup 의 propagation rules 가 자식
  //   Checkbox/Radio 에 직접 적용됨(부모 spec childPath ["Checkbox"]/["Radio"] 로 단축).
  //   중계 분기 도달 불가능 → 제거.

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

  // projection-only 컨테이너(TagList 등): 유일한 Taffy 자식이 projection RowsGroup("Rows")
  //   인 경우, enrich 가 calculateContentHeight(taglist 분기, items 기반 정확)로 산출한 height 를
  //   **보존**한다. **Why (TagGroup side height 버그 최종층)**: 칩은 element 가 아니라 projection
  //   scene node("Rows" RowsGroup, width:100%, flex-wrap)다. RowsGroup 의 칩 wrap 을 Taffy 에
  //   맡기면, TagList 가 side-label 에서 flex:1 폭을 Taffy 가 푸는 시점과 enrich 폭(Label 차감 229)
  //   사이 불일치로 1줄(28)로 무너진다(컨테이너 54 고정). items 기반 calculateContentHeight 가
  //   maxRows/폭 wrap 을 정확히 계산하므로(229→2줄→60) 그 명시 height 를 Taffy 에 강제하는 게
  //   projection Taffy wrap 보다 정확. (ListBox/GridList top-level 은 enrich 폭=Taffy 폭 일치라
  //   기존 height 제거로도 정상 — TagList 의 flex:1 side-label 만 발산.)
  const onlyProjectionRowsChild =
    filteredChildren.length === 1 && filteredChildren[0]?.type === "Rows";

  // side-label row 컨테이너(TagGroup labelPosition="side" 등): Label + projection-only
  //   자식(TagList → RowsGroup) 의 가로 배치. enrich 의 calculateContentHeight(taggroup 분기,
  //   Math.max(Label, TagList)) 가 이미 정확한 height(64)를 산출하지만, 이를 제거하고 Taffy
  //   자식 합산에 맡기면 Taffy 가 row 에서 projection-only 자식(TagList)의 height 를 그 자식
  //   RowsGroup 과 중복 누적하여 발산(64 → 88)한다. **Why (TagGroup side selection 과대 버그
  //   최종층, 2026-06-19)**: TagList 자체 layout 은 64 로 정확하나, 부모(TagGroup)가 그 TagList 를
  //   row 배치할 때 Taffy 가 +24px 부풀려 selection/hover outline 이 실제 박스보다 높게 잡힌다.
  //   onlyProjectionRowsChild(자식 1개 Rows) 보존과 동형으로, side-label row + Label + 나머지
  //   전부 projection-only 컨테이너면 enrich height 를 보존한다.
  const labelChildForPreserve = filteredChildren.find(
    (c) => c.type === "Label",
  );
  const nonLabelChildrenForPreserve = filteredChildren.filter(
    (c) => c.type !== "Label",
  );
  const sideLabelProjectionContainer =
    (effectiveDisplay === "flex" || effectiveDisplay === "inline-flex") &&
    elementStyle.flexDirection === "row" &&
    !!labelChildForPreserve &&
    nonLabelChildrenForPreserve.length > 0 &&
    nonLabelChildrenForPreserve.every((c) => {
      const grand = effectiveGetChildElements(c.id);
      return (
        grand.length === 1 &&
        ((grand[0] as { type?: string })?.type === "Rows" ||
          String((grand[0] as { id?: string })?.id ?? "").includes("-rows:"))
      );
    });

  // bounded-scroll owner(maxHeight/height + overflow scroll/auto)는 preserve 제외 —
  //   1-pass 추정(단일 줄 행 합산) 동결이 Step 4.5 행 wrap 실측과 발산(owner 234 vs rows 400,
  //   CSS min(content,maxHeight)=300). Taffy auto + max_size clamp 가 CSS 와 정합.
  //   sample-mode(auto-height, ADR-157)는 bounded 아님 → preserve 유지 (표시 정책 불변).
  const preserveEnrichHeight =
    (onlyProjectionRowsChild && !isBoundedScrollOwnerStyle(elementStyle)) ||
    sideLabelProjectionContainer;

  if (hasTaffyChildren && !preserveEnrichHeight) {
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
  } else if (!hasTaffyChildren) {
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
  //
  // **부모 게이트 (2026-07-14)**: 본 보정은 **IFC 시뮬레이션 부모** 전용이다
  //   (block/flow-root 부모 + inline-level 자식 → toTaffyDisplay 가 row+wrap 합성).
  //   결과 style(display:flex && flexWrap:wrap)만 보면 **사용자/카탈로그가 선언한 진짜
  //   CSS flex 컨테이너**까지 오폭한다 — CSS flex item 은 block-level 이어도 부모 폭
  //   100% 가 아니다(flex-basis/grow 가 폭을 정한다).
  //   사고: labelPosition="side" TagGroup(catalog containerVariants → flex+row+wrap)의
  //   TagList 자식이 `flex:1/flexBasis:0%` 를 받았음에도 width:100%(=350) 로 덮여
  //   `Label(68)+gap(4)+350 > 350` → 둘째 줄로 wrap → Skia 만 세로 배치(CSS 는 정상 가로).
  if (
    styleRecord.display === "flex" &&
    styleRecord.flexWrap === "wrap" &&
    isInlineBlockSimulationParent(effectiveDisplay)
  ) {
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

  // 5.7. (제거됨 — ADR-164 Phase 1) overflow 부모 기준 flexShrink:0 강제 주입은
  // 엔진 §4.5 automatic minimum size (flex.rs — **item 자신의** overflow 조건 +
  // content-based minimum floor) 로 대체됐다. TS 에서 flexShrink 를 다시 주입하는
  // 보정 재도입 금지 — layout-engine.md "TS 잔존 계약" 참조.

  // 6. 자식 batch 인덱스 목록 구성 (filteredChildren 기반)
  // CSS order 정렬 순서를 유지하기 위해 sortedChildIds 사용.
  //
  // synthetic 컨테이너 (CheckboxGroup/RadioGroup `__items` wrapper) 의 자식 item 은
  //   wrapper children 으로 이미 연결됐으므로 group 직속에서 제외한다(이중 부모 방지 —
  //   동일 노드가 group + wrapper 양쪽 Taffy 자식이 되면 이중 layout/render). wrapper 가
  //   group 의 자식으로 들어가고, item 은 wrapper 의 자식으로만 들어간다.
  const wrappedItemIds = new Set<string>();
  for (const child of filteredChildren) {
    const ids = (child.props as Record<string, unknown> | undefined)
      ?.__synthChildIds as string[] | undefined;
    if (ids) ids.forEach((id) => wrappedItemIds.add(id));
  }
  // TagGroup maxRows chip 접힘은 layout 에서 chip 을 제외하지 않는다 — Taffy 는 chip 전부를
  //   flexWrap 배치하고, 초과 chip 은 **render 단계**(StoreRenderBridge, 실제 RowsGroup layout.width
  //   보유)에서 미emit + Show all 표시한다. **Why (2026-07-01, maxRows=3 gap 발산 근본)**: layout
  //   1-pass 시점의 availableWidth 는 부모 top-down 추정폭(예 310)이라 실제 RowsGroup 배치폭(예 350,
  //   flex/100% resolve 후)과 다르다. layout 에서 그 추정폭으로 chip 을 미리 제외하면, height(2-pass
  //   실폭 재보정)/render(실폭 layoutMap.width)와 접힘 판정이 갈려 chip 실배치 행 수 < 강제 height →
  //   align-content 분산으로 세로 gap 발산. chip 개수 제어를 render 로 일원화하면 height/render 가
  //   동일 실폭을 써 정합(fold-skip 이 유일하게 실폭 미보유였음).
  const childIndices: number[] = [];
  for (const childId of sortedChildIds) {
    if (wrappedItemIds.has(childId)) continue; // wrapper 자식 → group 직속 제외
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
  // WASM 가용성 확인 (자체 엔진 — ADR-916 Taffy 완전 제거)
  if (!isCompositionEngineReady()) return null;

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
        //
        // ADR-912 R1 후속 (2026-06-12): 신규 노드가 **자식 서브트리를 가진 컨테이너**
        // (Select/ComboBox 등 addComplexElement 로 부모+자식 트리 일괄 등록) 면 grid 가
        // 아니어도 full rebuild 필요. `addNode` 증분은 단일 노드 추가엔 동작하지만,
        // 한 batch 에 부모+자식 다수 신규 노드가 들어오면 자식 layout 이 produce 되지 않아
        // (layout=undefined) 자식이 (0,0) 에 겹쳐 그려지고 부모 height 가 자식 합산 미만으로
        // degrade 됨 (Select 등록 직후 height 34 → 새로고침 full rebuild 후 54). buildFull
        // 로만 신규 서브트리 전체가 정상 배치된다.
        if (!prevJson) {
          if (isGridDisplay(curDisplay)) {
            needsFullRebuild = true;
            break;
          }
          const newNodeChildren = filteredChildIdsMap.get(node.elementId);
          if (newNodeChildren && newNodeChildren.length > 0) {
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
        // **processedElementsMap 우선** (DFS injection + implicitStyles 적용본).
        //   store 원본(elementsMap)에는 implicitStyles 가 주입한 height 가 없다 — 아래
        //   "명시 height 는 skip" 가드가 store 만 보면 **주입된 height 를 auto 로 오판**한다.
        //   회귀 (2026-07-14 DatePicker): SelectTrigger 의 height(30px)는 implicitStyles
        //   selecttrigger 분기가 주입하고 store 엔 없다 → 가드 미발동 → childUpdates 에 편입 →
        //   아래 "컨테이너는 height 제거" 분기가 **주입된 30px 을 삭제** → trigger 가 auto(28)로
        //   축소되고, 그 안의 DateInput(`height:100%`)이 **auto 부모 기준 → 0** 으로 붕괴
        //   (Skia 에서 DateInput 이 사라짐). 아래 update 루프(2637)는 이미 processedElementsMap
        //   을 쓰고 있어 **selection 루프만 비대칭**이었다.
        const childEl =
          processedElementsMap.get(node.elementId) ??
          elementsMap.get(node.elementId);
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

      // ── Step 4.5b: TagGroup maxRows chip 접힘 = Taffy 실측 행 번호 기반 (폭 가변 견고) ──
      //   **Why (2026-07-02, maxRows gap 발산 최종 근본)**: TagGroup 폭은 가변이다. chip 접힘
      //   개수/height 를 추정 wrap 공식(`resolveTagWrapLayout`, measureText + 특정 폭 의존)으로
      //   계산하면 실제 Taffy WASM flexWrap 배치와 어긋난다(JS measureText ≠ Taffy 측정, f32,
      //   폭 추정 오차). 어긋나면 (1) render skip 은 Skia 그리기만 막고 Taffy 는 chip 전부를 배치해
      //   RowsGroup height 가 실제 표시 행보다 큼(예 15+Show all=16 chip → 5줄 166, 표시는 3줄) →
      //   잉여 여백이 align-content 분산 → 세로 gap 발산 + Show all 이 box 밖. 근본 해결 = **폭 값을
      //   전혀 안 쓰고 Taffy 가 배치한 각 chip 의 실제 y좌표(rowY)로 행 번호를 산출**해 `행 번호 ≥
      //   maxRows` chip 을 Taffy 트리(RowsGroup children)에서 제외한다. rowY 는 Taffy 실배치 결과라
      //   폭 무관 정확 — 리사이즈 시 Taffy 가 재배치하면 자동 정합. Show all(_isShowAll)은 유지 →
      //   Taffy 가 남은 chip 다음에 재배치. 제외 후 recompute 하면 RowsGroup height 가 표시 행 수로
      //   수렴 → TagList(preserveEnrichHeight) 와 정합 → 분산 gap 소멸.
      const foldChipRemovals: Array<{ rowsGroupId: string; keep: string[] }> =
        [];
      // projection-only TagList 전수(접힘 여부 무관): Step 4.5c 가 각 RowsGroup Taffy 실측
      //   height 를 부모 TagList 에 강제할 대상. 접힘 미발생(itemRowCount ≤ maxRows) 이어도
      //   preserveEnrichHeight(추정 wrap contentHeight)와 Taffy 실배치 행 수가 어긋날 수 있어
      //   (measureText ≠ Taffy, 폭 추정 오차 → 예 11 tag/maxRows3: 추정 4행 156 vs 실측 3행 122)
      //   전 케이스 실측 강제가 필요하다.
      const projectionTagLists: Array<{
        tagListId: string;
        rowsGroupId: string;
      }> = [];
      for (let i = 0; i < batch.length; i++) {
        const node = batch[i];
        const childIds = filteredChildIdsMap.get(node.elementId);
        // TagList 판정: 유일 자식이 projection RowsGroup(`-rows:`).
        if (
          !childIds ||
          childIds.length !== 1 ||
          !childIds[0].includes("-rows:")
        )
          continue;
        const tagListEl =
          processedElementsMap.get(node.elementId) ??
          elementsMap.get(node.elementId);
        if ((tagListEl?.type ?? "").toLowerCase() !== "taglist") continue;
        projectionTagLists.push({
          tagListId: node.elementId,
          rowsGroupId: childIds[0],
        });

        const rowsGroupId = childIds[0];
        // owner-first: maxRows 는 owner TagGroup.props SSOT (TagList mirror stale 회피).
        const tlProps = tagListEl!.props as Record<string, unknown> | undefined;
        const ownerTg = tagListEl!.parent_id
          ? elementsMap.get(tagListEl!.parent_id)
          : undefined;
        const ownerProps =
          ownerTg?.type === "TagGroup"
            ? (ownerTg.props as Record<string, unknown> | undefined)
            : undefined;
        const maxRows =
          typeof ownerProps?.maxRows === "number"
            ? (ownerProps.maxRows as number)
            : typeof tlProps?.maxRows === "number"
              ? (tlProps.maxRows as number)
              : 0;
        if (maxRows <= 0) continue;

        // RowsGroup 의 chip 자식 + 각 chip 의 1-pass rowY 수집.
        const chipIds = filteredChildIdsMap.get(rowsGroupId);
        if (!chipIds || chipIds.length === 0) continue;
        const chipRows: Array<{ id: string; y: number; isShowAll: boolean }> =
          [];
        for (const chipId of chipIds) {
          const ch = persistentTree.getHandle(chipId);
          const cl = ch !== undefined ? firstPassLayouts.get(ch) : undefined;
          if (!cl) continue;
          const chipEl = elementsMap.get(chipId);
          const isShowAll = Boolean(
            (chipEl?.props as Record<string, unknown> | undefined)?._isShowAll,
          );
          chipRows.push({ id: chipId, y: Math.round(cl.y), isShowAll });
        }
        if (chipRows.length === 0) continue;

        // rowY 기반 접힘 (폭 무관, CSS 정본 알고리즘과 동일). 유지할 chip id 산출.
        const keep = computeTagFoldKeep(chipRows, maxRows);
        if (keep.length === chipIds.length) continue; // 제외 대상 없음
        foldChipRemovals.push({ rowsGroupId, keep });
      }
      // chip 제외 적용 → RowsGroup children 갱신 → Taffy 재배치.
      for (const { rowsGroupId, keep } of foldChipRemovals) {
        filteredChildIdsMap.set(rowsGroupId, keep);
        persistentTree.updateChildren(rowsGroupId, keep);
        persistentTree.markDirty(rowsGroupId);
        needsSecondPass = true;
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
          // projection-only 컨테이너(TagList 등): 유일한 자식이 projection RowsGroup("Rows")이면
          //   height 를 보존한다(1-pass enrich 보존과 동형). **Why**: 칩 wrap height 는
          //   calculateContentHeight(taglist, items 기반)가 정확히 계산하므로 Taffy RowsGroup
          //   auto height(side-label flex:1 폭 발산 시 1줄로 무너짐)보다 신뢰. 이 2-pass 가
          //   1-pass 의 height 보존을 다시 삭제하면 side height 버그가 재현된다(최종층).
          // projection RowsGroup id 형식: `projection:<family>-rows:<ownerId>`
          //   (renderProjectionIds.toCollectionRowsGroupProjectionId). elementsMap 에 없는
          //   scene-graph 노드라 type 조회 대신 id prefix 로 판정.
          const onlyProjectionRowsChild2 =
            filteredChildIds?.length === 1 &&
            filteredChildIds[0].includes("-rows:");
          if (isContainer && !onlyProjectionRowsChild2) {
            if (node.style.height) {
              delete node.style.height;
              persistentTree.updateNodeStyle(node.elementId, node.style);
            }
            continue;
          }
          if (isContainer && onlyProjectionRowsChild2) {
            // projection-only: height 보존, re-enrich 도 skip (이미 정확)
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
          patchBatchStyleFromImplicit(node.style, reStyle);
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

      // ── Step 4.5c: RowsGroup Taffy 실측 height → TagList height 강제 (접힘 여부 무관) ──────
      //   projection-only TagList 는 `preserveEnrichHeight`(1-pass 추정 wrap contentHeight)로
      //   height 가 강제된 상태다. 그러나 추정 wrap(`resolveTagWrapLayout`, measureText 기반)은
      //   실제 Taffy WASM flexWrap 배치와 어긋난다(measureText ≠ Taffy 측정, 폭 추정 오차, f32) →
      //   Taffy 는 3행(122)으로 배치하는데 추정은 4행(156)을 반환해 selection height 에 여분 공백.
      //   **근본**: chip 개수 제어(Step 4.5b)뿐 아니라 **TagList height 도 Taffy 실측이 SSOT** 여야
      //   한다. 따라서 접힘 발생 여부와 무관하게 모든 projection TagList 의 RowsGroup 실측 height 를
      //   부모 TagList 에 강제한다. 접힘 케이스는 4.5b recompute 후 좌표(표시 행 기준), 미접힘 케이스는
      //   1-pass 좌표(전체 행) — 둘 다 Taffy 실배치라 폭 무관 정확.
      //   **Why (2026-07-02, 미접힘 여분 공백 근본)**: 이전 재설계는 접힘 경로만 실측으로 갔고
      //   미접힘 height 는 추정 잔존 → 11 tag/maxRows3(접힘 없음) 에서 추정 4행 = selection 156.
      if (projectionTagLists.length > 0) {
        const postFoldLayouts = persistentTree.getLayoutsBatch();
        let tagListHeightChanged = false;
        for (const { tagListId, rowsGroupId } of projectionTagLists) {
          // **Why 자식 실측(RowsGroup 컨테이너 실측 아님)**: Taffy `setChildren` 으로 chip 을 제거해도
          //   RowsGroup 컨테이너의 auto height 는 축소되지 않는다(증분 갱신 한계 — 자식 3행 배치인데
          //   컨테이너 height 는 Show all 포함 4행값 132 로 stale). 따라서 컨테이너 실측이 아니라
          //   **유지된 chip 들의 실제 배치 bottom(max(chip.y + chip.height))** 으로 content height 를
          //   직접 산출한다. 폭 무관(Taffy 실좌표 기준) + Show all 제거 반영.
          const chipIds = filteredChildIdsMap.get(rowsGroupId);
          if (!chipIds || chipIds.length === 0) continue;
          let maxBottom = 0;
          for (const chipId of chipIds) {
            const ch = persistentTree.getHandle(chipId);
            const cl = ch !== undefined ? postFoldLayouts.get(ch) : undefined;
            if (!cl) continue;
            const bottom = cl.y + cl.height;
            if (bottom > maxBottom) maxBottom = bottom;
          }
          if (maxBottom <= 0) continue;
          const newHeight = Math.round(maxBottom);

          // side-label projection 부모(TagGroup labelPosition="side")의 명시 height 제거.
          //   **Why (side-label 여분 공백 근본, 2026-07-02)**: labelPosition="side" 인 TagGroup 은
          //   `sideLabelProjectionContainer` 판정으로 `preserveEnrichHeight=true` → enrich 의
          //   calculateContentHeight(추정 wrap, stale mirror items 기반) 가 산출한 명시 height 가
          //   Taffy 에 강제된다(라이브 실측: 명시 98 = 3행 추정, 실제 TagList 자식은 2행 64). Step 4.5b/c
          //   가 TagList/RowsGroup 을 자식-bottom 실측(64)으로 교정하고 부모를 dirty 로 마킹해도,
          //   TagGroup 의 명시 height(98)는 auto 가 아니라 fixed 라 재계산 시에도 98 유지 →
          //   selection/hover outline 이 실제 자식(64) 아래로 34px(1행) 여분 공백. top-label 은 column
          //   이라 preserve 미적용(자식 2개)이라 auto 합산으로 자연 수렴하나, side-label(row)만 발산.
          //   → 부모 명시 height 를 제거해 Taffy 가 row auto height(max(Label, 교정된 TagList)=64)로
          //   재계산하게 한다. **정합(tlAligned&&rowsAligned) 여부와 독립** — TagList 가 이미 64 로
          //   정합이어도 부모 TagGroup 은 여전히 stale 98 을 명시 강제하므로, 아래 continue 앞에서
          //   처리한다. 사용자 명시 CSS height 는 보존.
          const tagListParentId = elementsMap.get(tagListId)?.parent_id;
          if (tagListParentId) {
            const parentEl = elementsMap.get(tagListParentId);
            const parentProps = parentEl?.props as
              | Record<string, unknown>
              | undefined;
            const parentStyle = parentProps?.style as
              | Record<string, unknown>
              | undefined;
            if (
              shouldClearSideLabelTagGroupHeight({
                type: parentEl?.type,
                labelPosition: parentProps?.labelPosition,
                styleHeight: parentStyle?.height,
              })
            ) {
              const parentIdx = batch.findIndex(
                (n) => n.elementId === tagListParentId,
              );
              if (parentIdx >= 0 && batch[parentIdx].style.height) {
                delete batch[parentIdx].style.height;
                persistentTree.updateNodeStyle(
                  tagListParentId,
                  batch[parentIdx].style,
                );
                persistentTree.markDirty(tagListParentId);
                tagListHeightChanged = true;
              }
            }
          }

          const tlHandle = persistentTree.getHandle(tagListId);
          const tlLayout =
            tlHandle !== undefined ? postFoldLayouts.get(tlHandle) : undefined;
          const tlAligned =
            tlLayout &&
            Math.abs(tlLayout.height - newHeight) <= WIDTH_TOLERANCE;
          // RowsGroup 컨테이너 stale height 도 명시 강제(자식 bottom) → TagGroup 세로 합산 정합.
          const rowsHandle = persistentTree.getHandle(rowsGroupId);
          const rowsLayout =
            rowsHandle !== undefined
              ? postFoldLayouts.get(rowsHandle)
              : undefined;
          const rowsAligned =
            rowsLayout &&
            Math.abs(rowsLayout.height - newHeight) <= WIDTH_TOLERANCE;
          if (tlAligned && rowsAligned) continue; // 이미 정합 (부모 처리는 위에서 완료)
          if (!rowsAligned) {
            const rowsBatchNode = batch.find(
              (n) => n.elementId === rowsGroupId,
            );
            if (rowsBatchNode) {
              rowsBatchNode.style.height = `${newHeight}px`;
              persistentTree.updateNodeStyle(rowsGroupId, rowsBatchNode.style);
              persistentTree.markDirty(rowsGroupId);
            }
          }
          const idx = batch.findIndex((n) => n.elementId === tagListId);
          if (idx < 0) continue;
          batch[idx].style.height = `${newHeight}px`;
          persistentTree.updateNodeStyle(tagListId, batch[idx].style);
          persistentTree.markDirty(tagListId);
          // 부모(TagGroup) 도 dirty → auto height 재계산 (parent_id 는 elementsMap 조회).
          if (tagListParentId) persistentTree.markDirty(tagListParentId);
          tagListHeightChanged = true;
        }
        if (tagListHeightChanged) {
          persistentTree.computeLayout(availableWidth, availableHeight);
        }
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
      // overflow 가 catalog containerStyles 에만 있는 컨테이너(ListBox/Tree/body 등)도 스크롤이
      //   발화하도록 catalog fallback 포괄. ref instance 는 resolved type(componentName). raw 우선.
      const elWithNameForOverflow = el as
        | { componentName?: unknown }
        | undefined;
      const overflowType =
        (typeof elWithNameForOverflow?.componentName === "string"
          ? elWithNameForOverflow.componentName
          : undefined) ?? (el?.type as string | undefined);
      const overflow = resolveEffectiveOverflow(overflowType, elStyle);
      if (overflow === "scroll" || overflow === "auto") {
        const scrollChildIds = childrenMap.get(elementId) ?? [];
        // ADR-150 A2: data-bound 가상화 collection(자식 0개)은 projection-height 기반
        //   maxScroll(BuilderCanvas)이 담당 → childrenMap 기반 0 으로 덮어쓰지 않도록 skip.
        //   origin 은 type("ListBox"), ref 인스턴스는 componentName 으로 식별(양쪽 검사).
        const elWithName = el as { componentName?: unknown } | undefined;
        const isWindowedCollection =
          (typeof el?.type === "string" &&
            A2_WINDOWED_COLLECTION_TAGS.has(el.type)) ||
          (typeof elWithName?.componentName === "string" &&
            A2_WINDOWED_COLLECTION_TAGS.has(elWithName.componentName));
        if (scrollChildIds.length === 0 && isWindowedCollection) {
          continue;
        }
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
