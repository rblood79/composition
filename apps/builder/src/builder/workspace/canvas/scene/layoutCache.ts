import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { CanvasLayoutNode } from "../layout/layoutNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  calculateFullTreeLayoutFromSceneModel,
  getPublishedFilteredChildrenMap,
  getPublishedSyntheticElementsMap,
  publishFilteredChildrenMap,
  publishSyntheticElementsMap,
} from "../layout/engines/fullTreeLayout";
import { parseBorder, parsePadding } from "../layout/engines/utils";
import { getCacheMetrics } from "../skia/cacheMetrics";

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

const LAYOUT_STYLE_KEYS = [
  "display",
  "position",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "border",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
  "flex",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "alignContent",
  "alignSelf",
  // justifySelf — Transform Width Fill 이 grid item 에 stretch 를 송신한다. 미등재 시
  // width mode 변경이 캐시 히트로 흡수돼 Canvas 레이아웃에 반영되지 않는다 (ADR-156 R6).
  "justifySelf",
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  // ADR-156 R6 (Phase 3) — grid 계열 발산 필드가 캐시 시그니처 미등재라 엔진을 고쳐도
  // 해당 키만 바뀐 편집이 캐시 히트로 흡수됨. justifyItems(E2)·gridAutoColumns/Rows(E14)·
  // gridColumnStart/RowStart(E13, layout-engine.md 가 factory 에 숫자 line 병기 요구)를 등재.
  "justifyItems",
  "gridAutoColumns",
  "gridAutoRows",
  "gridColumn",
  "gridColumnStart",
  "gridRow",
  "gridRowStart",
  // ADR-168 — 프리셋이 breakpoint 별로 트랙/배치를 override 하면서 End 계열과
  // gridTemplateAreas 가 실제 변경 축이 됐다. Start 만 등재된 상태에서는 tablet override
  // 가 End 만 바꾸는 경우(예: widgets 를 하단 전폭으로) 시그니처가 불변이라 캐시 히트로
  // 흡수돼 조용히 무반영된다 (ADR-156 R6 과 동형 결함).
  "gridColumnEnd",
  "gridRowEnd",
  "gridTemplateAreas",
  "overflow",
  // ADR-156 P4 (R6): 파이프라인은 overflowX/overflowY longhand 를 송신하고(utils.ts),
  //   엔진은 overflow≠visible 로 BFC 를 판정해 부모-자식 마진 상쇄를 차단한다(E17).
  //   shorthand "overflow" 만 등재돼 있으면 longhand 편집이 style 시그니처 불변 →
  //   캐시 히트 → 상쇄 재판정 skip. 두 longhand 를 등재해 overflow 편집이 relayout 유발.
  "overflowX",
  "overflowY",
  "whiteSpace",
  "wordBreak",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "aspectRatio",
  "objectFit",
  "top",
  "right",
  "bottom",
  "left",
  "transform",
];

const LAYOUT_PROP_KEYS = [
  "children",
  "text",
  "label",
  "title",
  "description",
  "placeholder",
  "value",
  "size",
  "layout",
  "orientation",
  "items",
  "options",
  "rows",
  "columns",
  "src",
  "allowsRemoving",
  "maxRows",
  "granularity",
  "hourCycle",
  "locale",
  "calendar",
  "calendarSystem",
  "necessityIndicator",
  "isRequired",
  "labelPosition",
  "iconName",
  "iconPosition",
  "minValue",
  "maxValue",
  "formatOptions",
  "showValueLabel",
  "valueLabel",
  // ADR-912 Disclosure 버그 수정 (2026-06-10): Disclosure isExpanded 변경이 자식
  //   DisclosureContent 의 display:none 주입(applyImplicitStyles)을 트리거하도록 캐시
  //   시그니처에 포함. 누락 시 isExpanded 만 바뀌면 노드 시그니처 동일 → 캐시 히트로
  //   레이아웃 재계산 skip → collapse 가 Skia/layout 에 반영 안 됨.
  "isExpanded",
  // DisclosureGroup allowsMultipleExpanded (2026-07-14): false 면 그룹이 자식 Disclosure 중
  //   첫 번째만 펼치므로(RAC useDisclosureGroupState 동형) 나머지 DisclosureContent 에
  //   display:none 이 주입된다(applyImplicitStyles). 그룹 노드의 prop 이지만 자식 레이아웃을
  //   바꾸므로 시그니처 포함 — isExpanded 선례 동형(시그니처는 페이지 전역 join 이라
  //   그룹 노드 변경만으로 전체 재레이아웃 트리거).
  "allowsMultipleExpanded",
  // Table 고정 높이 (2026-07-13 parity sweep): heightMode="fixed" 의 props.height 를
  //   applyImplicitStyles 가 style.height 로 주입 — 편집 시 캐시 시그니처가 바뀌어야
  //   재레이아웃된다 (Disclosure isExpanded 선례 동형).
  "height",
  "heightMode",
  // ADR-157 Phase 3 (2026-07-21): scene 이 sample mode data-bound ListBox owner 에 주입하는
  //   totalRows 전체 높이(= totalRows × rowHeight). collection 행 수 변화 시 scene 이 이 값을
  //   갱신하는데, owner 의 items/children 시그니처는 불변(dataBinding 은 외부 데이터)이므로
  //   본 키가 없으면 owner 레이아웃이 캐시 히트로 stale(이전 행 수 높이) 된다 — height/isExpanded
  //   선례 동형(§1.55b 가 소비, layoutInvalidation 은 scene 파생이라 불필요).
  "_projectedRowsContentHeight",
  // collection slot 구성(_slots) — projection 이 origin/anchor 의 slot 자식 style(특히 label/
  //   description fontSize)을 fold 해 ListBox owner(§1.55b) + ListBoxItem/GridListItem row
  //   (§1.55b-2) scene props 에 주입한다. 행 높이가 이 slot fontSize 로 산출되는데(utils.ts
  //   resolveListBoxItemRowHeightFromStyle), 본 키가 없으면 origin label/description **size 편집**
  //   시 fontSize 는 escape 로 live 렌더되지만 행 높이 시그니처는 불변 → 캐시 히트로 높이 stale
  //   (새로고침 후에만 반영, 2026-07-21 사용자 보고). _projectedRowsContentHeight 선례 동형 —
  //   layer A(layoutVersion)는 origin 자식 size/style 편집이 이미 bump, _slots 는 scene 파생이라
  //   layer B(본 시그니처)만 필요. 값이 객체라 serializeLayoutRelevantValue 가 JSON 직렬화(fontSize 포함).
  "_slots",
];

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
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/**
 * style 축 시그니처 캐시 — 키는 **style 객체 identity**.
 *
 * 편집 프레임 실측(2026-07-30): 시그니처 3종이 편집 1회당 51.8ms(long task 의
 * 21.7%)를 차지했고, 그중 layout signature 가 27.9ms 다. 그런데 store 는 불변
 * 업데이트라 편집으로 실제 바뀌는 요소는 1개이고, `signatureCacheKey.test.ts`
 * 실측으로 **미변경 요소의 `props.style` 객체가 200/201 재사용**됨을 확인했다
 * (scene 변환이 `props` 는 `_slots` 주입 때문에 새로 만들지만 `style` 은 원본을
 * 그대로 넘긴다). 그래서 여기만 캐시가 성립한다.
 *
 * 정확성은 자명하다 — 같은 style 객체면 73키를 어떻게 읽어도 같은 문자열이다.
 * 전제는 하나, **style 을 제자리 변경하지 않는 것**. 그 계약은
 * `signatureCacheKey.test.ts` 가 고정한다. 깨지면 캐시가 stale 문자열을 돌려주고
 * 레이아웃 편집이 조용히 무반영된다.
 *
 * `props` 축(43키)은 캐시하지 않는다 — props 객체가 편집마다 전량 새로 만들어져
 * (0/201) WeakMap 키로 쓸 수 없다.
 */
const styleSignatureCache = new WeakMap<object, string>();

/**
 * dev 전용 적중률 채널 — `window.__composition_CACHE_METRICS__.snapshotAll()`.
 * 캐시가 무력화돼도 화면과 테스트는 정상이라 **적중률이 유일한 조기 신호**다.
 * prod 는 null 이라 hot path 에 함수 호출이 남지 않는다.
 */
const styleSignatureMetrics =
  process.env.NODE_ENV === "development"
    ? getCacheMetrics("layout-style-signature")
    : null;

/**
 * style 이 없는 요소가 매번 `{}` 리터럴을 만들면 키가 달라져 전량 미스가 된다.
 * 공유 상수를 쓰면 그 요소들이 한 엔트리로 수렴한다.
 */
const EMPTY_STYLE: Record<string, unknown> = {};

function createStyleAxisSignature(style: Record<string, unknown>): string {
  const cached = styleSignatureCache.get(style);
  if (cached !== undefined) {
    styleSignatureMetrics?.recordHit();
    return cached;
  }
  styleSignatureMetrics?.recordMiss();

  const signature = LAYOUT_STYLE_KEYS.map(
    (key) => `${key}=${serializeLayoutRelevantValue(style[key])}`,
  ).join(";");
  styleSignatureCache.set(style, signature);
  return signature;
}

function createElementLayoutSignature(element: CanvasLayoutNode): string {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const style = (props.style ?? EMPTY_STYLE) as Record<string, unknown>;

  const styleSignature = createStyleAxisSignature(style);
  const propSignature = LAYOUT_PROP_KEYS.map(
    (key) => `${key}=${serializeLayoutRelevantValue(props[key])}`,
  ).join(";");

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

function getLayoutPublishKey(bodyElement: CanvasLayoutNode): string {
  return (
    bodyElement.page_id ??
    getFrameElementMirrorId(bodyElement) ??
    bodyElement.id
  );
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
  childrenIdMap,
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

  const rootKey = getLayoutPublishKey(bodyElement);
  const cacheKey = bodyElement.page_id ?? bodyElement.id;
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
    | Record<string, unknown>
    | undefined;
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
