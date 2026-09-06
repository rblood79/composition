import type { CanvasLayoutNode } from "../layout/layoutNode";
import { getLayoutRootKey } from "../layout/layoutRootKey";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  calculateFullTreeLayoutFromSceneModel,
  getPublishedFilteredChildrenMap,
  getPublishedSyntheticElementsMap,
  publishFilteredChildrenMap,
  publishSyntheticElementsMap,
} from "../layout/engines/fullTreeLayout";
import { parseBorder, parsePadding } from "../layout/engines/utils";
import {
  LAYOUT_PROP_KEYS,
  LAYOUT_STYLE_KEYS,
} from "../../../presentation/invalidation/editorMutationEffectRegistry";

interface BuildPageChildrenMapInput {
  bodyElement: CanvasLayoutNode | null;
  elementById: Map<string, CanvasLayoutNode>;
  pageElements: CanvasLayoutNode[];
}

interface CachedPageLayoutEntry {
  bodyId: string;
  fullTreeLayoutMap: Map<string, ComputedLayout> | null;
  pageElementsSignature: string;
  pageLayoutSignature: string;
  pageHeight: number;
  pageWidth: number;
  wasmLayoutReady: boolean;
  filteredChildIdsMap: Map<string, string[]> | null;
  syntheticElementsMap: Map<string, CanvasLayoutNode> | null;
  rootKey: string;
}

const pageLayoutCache = new Map<string, CachedPageLayoutEntry>();

/**
 * `pageLayoutCache` 의 키 — 페이지당 1 엔트리.
 *
 * 호출부가 자체 키를 만들면 prune 과 조회가 서로 다른 키를 쓰게 되므로 여기서만 만든다
 * (publisher 의 발행 키는 frame mirror id 를 섞어 쓰기 때문에 **다른 키다**).
 */
export function getPageLayoutCacheKey(bodyElement: CanvasLayoutNode): string {
  return bodyElement.page_id ?? bodyElement.id;
}

/**
 * 살아 있는 페이지 집합에 없는 엔트리를 제거한다.
 *
 * 엔트리 하나가 그 페이지의 `fullTreeLayoutMap` 전체(요소당 ComputedLayout) +
 * filteredChildIdsMap + syntheticElementsMap 을 들고 있어 페이지 삭제·프로젝트 전환으로
 * 남는 엔트리의 비용이 작지 않다. 키가 페이지 id 라 **자연 사망 시점이 있으므로**
 * LRU 상한이 아니라 liveness 로 정리한다 — 캔버스는 여러 페이지를 동시에 그리므로
 * 상한을 두면 가시 페이지 수를 넘는 순간 프레임마다 퇴거·재계산이 돈다.
 */
export function prunePageLayoutCache(
  activeCacheKeys: ReadonlySet<string>,
): void {
  for (const key of pageLayoutCache.keys()) {
    if (!activeCacheKeys.has(key)) {
      pageLayoutCache.delete(key);
    }
  }
}

function isContentsElement(element: CanvasLayoutNode | undefined): boolean {
  const style = element?.props?.style as Record<string, unknown> | undefined;
  return style?.display === "contents";
}

export function createPageElementsSignature(
  elements: CanvasLayoutNode[],
): string {
  return elements
    .map((element) => {
      return `${element.id}:${element.parent_id ?? "root"}`;
    })
    .join("|");
}

// ADR-187 Phase 1: cache signature key order is registry-derived and Phase 0 parity-guarded.
function serializeLayoutRelevantValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? "undefined";
  } catch {
    return "";
  }
}

// 빈 값은 기존 서명에서도 동일하게 취급한다. 실제 값만 기록해 매 render마다
// 모든 registry key의 빈 문자열을 할당하지 않는다. 길이 접두사는 값 내부의
// 구분자가 다음 속성으로 해석되는 충돌을 막는다. 객체 identity 캐시는 쓰지
// 않으므로 같은 객체 내부의 변경도 계속 감지한다.
function createLayoutValuesSignature(
  values: Record<string, unknown>,
  keys: readonly string[],
): string {
  let signature = "";
  for (const key of keys) {
    const value = serializeLayoutRelevantValue(values[key]);
    if (value !== "") {
      signature += `${key}=${value.length}:${value};`;
    }
  }
  return signature;
}

function createElementLayoutSignature(element: CanvasLayoutNode): string {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const style = (props.style ?? {}) as Record<string, unknown>;

  const styleSignature = createLayoutValuesSignature(style, LAYOUT_STYLE_KEYS);
  const propSignature = createLayoutValuesSignature(props, LAYOUT_PROP_KEYS);

  return [
    element.id,
    element.type,
    element.parent_id ?? "root",
    styleSignature,
    propSignature,
  ].join("|");
}

export function createPageLayoutSignature(
  bodyElement: CanvasLayoutNode | null,
  elements: CanvasLayoutNode[],
): string {
  const signatureParts: string[] = [];

  if (bodyElement) {
    signatureParts.push(createElementLayoutSignature(bodyElement));
  }

  for (const element of elements) {
    signatureParts.push(createElementLayoutSignature(element));
  }

  return signatureParts.join("||");
}

export function buildPageChildrenMap({
  bodyElement,
  elementById,
  pageElements,
}: BuildPageChildrenMapInput): Map<string | null, CanvasLayoutNode[]> {
  const map = new Map<string | null, CanvasLayoutNode[]>();
  const bodyId = bodyElement?.id ?? null;

  const getLayoutParentId = (parentId: string | null): string | null => {
    let currentId = parentId;
    while (currentId) {
      const parentElement = elementById.get(currentId);
      if (!isContentsElement(parentElement)) {
        break;
      }
      currentId = parentElement?.parent_id ?? bodyId;
    }
    return currentId;
  };

  for (const element of pageElements) {
    if (isContentsElement(element)) {
      continue;
    }

    const rawParentId = element.parent_id ?? bodyId;
    const key = getLayoutParentId(rawParentId);
    const list = map.get(key);
    if (list) {
      list.push(element);
    } else {
      map.set(key, [element]);
    }
  }

  return map;
}

export function buildChildrenIdMap(
  pageChildrenMap: Map<string | null, CanvasLayoutNode[]>,
): Map<string, string[]> {
  const childrenIdMap = new Map<string, string[]>();

  for (const [key, elements] of pageChildrenMap) {
    if (key != null) {
      childrenIdMap.set(
        key,
        elements.map((element) => element.id),
      );
    }
  }

  return childrenIdMap;
}

interface GetCachedPageLayoutInput {
  bodyElement: CanvasLayoutNode | null;
  childrenIdMap: Map<string, string[]>;
  elementById: Map<string, CanvasLayoutNode>;
  pageChildrenMap: Map<string | null, CanvasLayoutNode[]>;
  pageElementsSignature: string;
  pageLayoutSignature: string;
  pageHeight: number;
  pageWidth: number;
  wasmLayoutReady: boolean;
}

export function getCachedPageLayout({
  bodyElement,
  elementById,
  pageChildrenMap,
  pageElementsSignature,
  pageLayoutSignature,
  pageHeight,
  pageWidth,
  wasmLayoutReady,
}: GetCachedPageLayoutInput): Map<string, ComputedLayout> | null {
  if (!bodyElement || !wasmLayoutReady) {
    return null;
  }

  const rootKey = getLayoutRootKey(bodyElement);
  const cacheKey = getPageLayoutCacheKey(bodyElement);
  const cachedEntry = pageLayoutCache.get(cacheKey);

  if (
    cachedEntry &&
    cachedEntry.bodyId === bodyElement.id &&
    cachedEntry.pageElementsSignature === pageElementsSignature &&
    cachedEntry.pageLayoutSignature === pageLayoutSignature &&
    cachedEntry.pageWidth === pageWidth &&
    cachedEntry.pageHeight === pageHeight &&
    cachedEntry.wasmLayoutReady === wasmLayoutReady
  ) {
    publishFilteredChildrenMap(
      cachedEntry.filteredChildIdsMap,
      cachedEntry.rootKey,
    );
    publishSyntheticElementsMap(
      cachedEntry.syntheticElementsMap,
      cachedEntry.rootKey,
    );
    return cachedEntry.fullTreeLayoutMap;
  }
  const bodyStyle = bodyElement.props?.style as
    Record<string, unknown> | undefined;
  const bodyBorderVal = parseBorder(bodyStyle);
  const bodyPaddingVal = parsePadding(bodyStyle, pageWidth);
  const availableWidth =
    pageWidth -
    bodyBorderVal.left -
    bodyBorderVal.right -
    bodyPaddingVal.left -
    bodyPaddingVal.right;
  const availableHeight =
    pageHeight -
    bodyBorderVal.top -
    bodyBorderVal.bottom -
    bodyPaddingVal.top -
    bodyPaddingVal.bottom;

  // **ADR-125 Phase 2 — canonical-native layout entry**:
  // calculateFullTreeLayoutFromSceneModel 은 internal 으로 elementsMap +
  // childrenByParent 를 받아 fullTreeLayout map shape 로 lower 하는 transitional
  // entry. 외부 contract 가 canonical-native scene model 형태가 됨.
  // childrenByParent 는 layoutCache 가 이미 보유한 pageChildrenMap (key: string |
  // null) 을 string-key 만 추출하여 전달.
  const childrenByParent = new Map<string, CanvasLayoutNode[]>();
  for (const [key, elements] of pageChildrenMap) {
    if (key !== null) childrenByParent.set(key, elements);
  }
  const fullTreeLayoutMap = calculateFullTreeLayoutFromSceneModel(
    {
      elementsMap: elementById,
      childrenByParent,
    },
    bodyElement.id,
    availableWidth,
    availableHeight,
    (id: string) => pageChildrenMap.get(id) ?? [],
  );
  const filteredChildIdsMap = getPublishedFilteredChildrenMap(rootKey);
  const syntheticElementsMap = getPublishedSyntheticElementsMap(rootKey);

  pageLayoutCache.set(cacheKey, {
    bodyId: bodyElement.id,
    fullTreeLayoutMap,
    pageElementsSignature,
    pageLayoutSignature,
    pageHeight,
    pageWidth,
    wasmLayoutReady,
    filteredChildIdsMap,
    syntheticElementsMap,
    rootKey,
  });

  return fullTreeLayoutMap;
}
