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
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "gridColumn",
  "gridRow",
  "overflow",
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

function createElementLayoutSignature(element: CanvasLayoutNode): string {
  const props = (element.props ?? {}) as Record<string, unknown>;
  const style = (props.style ?? {}) as Record<string, unknown>;

  const styleSignature = LAYOUT_STYLE_KEYS.map(
    (key) => `${key}=${serializeLayoutRelevantValue(style[key])}`,
  ).join(";");
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
