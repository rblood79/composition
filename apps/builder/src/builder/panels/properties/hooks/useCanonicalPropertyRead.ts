import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getChartDescriptor } from "@composition/specs";
import { getElementDataBinding, type FieldOrigin } from "@composition/shared";
import { getActiveCanonicalElementById } from "../../../stores/canonical/canonicalElementsView";
import {
  subscribeCanonicalStore,
  useActiveCanonicalDocument,
} from "../../../stores/canonical/canonicalElementsBridge";
import {
  getFirstProjectableNodeLookupByReference,
  getFirstProjectableNodeResolvedProps,
  getLastProjectableNodeById,
} from "../../../stores/canonical/canonicalTraversalHelpers";
import { getCanonicalRefTarget } from "../../../utils/canonicalRefResolution";
import { canonicalNodeToElement } from "../../../stores/canonical/canonicalElementsView";
import {
  getSyntheticDescendantChildren,
  getSyntheticDescendantLookup,
  isSyntheticDescendantId,
} from "../../../stores/canonical/syntheticDescendantLookup";
import type { PanelNode } from "../../panelNode";
import {
  getCanonicalPropertyReadIndex,
  type CanonicalPropertyReadIndex,
} from "./canonicalPropertyReadIndex";

const EMPTY_ELEMENTS: PanelNode[] = [];
const EMPTY_ELEMENTS_BY_ID: ReadonlyMap<string, PanelNode> = new Map();
const EMPTY_CHILDREN_BY_PARENT: ReadonlyMap<string, PanelNode[]> = new Map();
const EMPTY_PROPERTY_READ_INDEX: CanonicalPropertyReadIndex = {
  elements: EMPTY_ELEMENTS,
  elementsById: EMPTY_ELEMENTS_BY_ID,
  childrenByParent: EMPTY_CHILDREN_BY_PARENT,
};

function useCanonicalPropertyAggregateIndex(): CanonicalPropertyReadIndex {
  const canonicalDocument = useActiveCanonicalDocument();

  return canonicalDocument
    ? getCanonicalPropertyReadIndex(canonicalDocument)
    : EMPTY_PROPERTY_READ_INDEX;
}

export function useCanonicalPropertyElements(): PanelNode[] {
  return useCanonicalPropertyAggregateIndex().elements;
}

export function useCanonicalPropertyElement(
  elementId: string,
): PanelNode | undefined {
  const canonicalDocument = useActiveCanonicalDocument();
  const canonicalElement = useMemo(() => {
    if (!canonicalDocument) return undefined;
    return (
      (getActiveCanonicalElementById(elementId) as PanelNode | null) ??
      readSyntheticPanelNode(elementId) ??
      undefined
    );
  }, [canonicalDocument, elementId]);

  return canonicalElement;
}

/**
 * ADR-229 Phase 2 (F15): synthetic 자식 (`<instance>/<path>`) 은 canonical 노드가 없어 위 lookup 이
 * 비었다 — 해소된 노드 (origin ⊕ patch) 를 같은 Element 모양으로 읽는다. 쓰기는 store 가 바깥
 * instance 의 descendants 로 돌린다.
 */
export function readSyntheticPanelNode(elementId: string): PanelNode | null {
  if (!isSyntheticDescendantId(elementId)) return null;
  const lookup = getSyntheticDescendantLookup(elementId);
  if (!lookup) return null;
  return canonicalNodeToElement(lookup.node, lookup.parentId, {
    pageId: lookup.pageId,
    layoutId: lookup.layoutId,
  }) as PanelNode | null;
}

function readPanelNodeById(elementId: string) {
  return (
    getLastProjectableNodeById(elementId) ??
    getSyntheticDescendantLookup(elementId)?.node ??
    null
  );
}

/**
 * ADR-228: ref instance 의 유효 props (origin ⊕ override) 로 읽는 panel 노드. items 류 편집기가
 * 상속 항목을 보고 그 위에 추가하도록 — 쓰기는 그대로 instance override 로 간다.
 */
export function useCanonicalPropertyResolvedElement(
  elementId: string,
): PanelNode | undefined {
  const element = useCanonicalPropertyElement(elementId);
  return useMemo(() => {
    if (!element) return undefined;
    const resolved = getFirstProjectableNodeResolvedProps(elementId);
    if (!resolved || resolved === element.props) return element;
    return { ...element, props: resolved } as PanelNode;
  }, [element, elementId]);
}

function readCanonicalPropertyElementType(elementId: string): string | null {
  if (!elementId) return null;
  const node = readPanelNodeById(elementId);
  if (!node) return null;

  if (node.metadata?.type === "legacy-slot-hoisted") return "Slot";

  const reference = getCanonicalRefTarget(node);
  if (!reference) return node.type;
  return (
    getFirstProjectableNodeLookupByReference(reference)?.node.type ?? node.type
  );
}

/**
 * 선택 chrome이 필요한 최소 정체(type)만 구독한다.
 *
 * canonical document가 다른 필드 변경으로 교체되어도 동일한 primitive snapshot이면
 * React가 PropertiesPanelContent 재렌더를 건너뛴다. ref는 기존 선택 projection과 같이
 * 원본 컴포넌트 type으로 해소한다.
 */
export function useCanonicalPropertyElementType(
  elementId: string | null,
): string | null {
  const read = useCallback(
    () => readCanonicalPropertyElementType(elementId ?? ""),
    [elementId],
  );
  return useSyncExternalStore(subscribeCanonicalStore, read, () => null);
}

/** 이름 변경/차트 종류 변경만 header를 갱신하는 scalar snapshot. */
export function useCanonicalPropertyDisplayName(
  elementId: string | null,
): string | null {
  const read = useCallback(() => {
    if (!elementId) return null;
    const node = readPanelNodeById(elementId);
    if (!node) return null;
    const type = readCanonicalPropertyElementType(elementId);
    if (type !== "Chart") return type;
    if (node.name) return node.name;
    const reference = getCanonicalRefTarget(node);
    const origin = reference
      ? getFirstProjectableNodeLookupByReference(reference)?.node
      : undefined;
    return getChartDescriptor(node.props?.chartType ?? origin?.props?.chartType)
      .label;
  }, [elementId]);
  return useSyncExternalStore(subscribeCanonicalStore, read, () => null);
}

function readCanonicalPropertyValue(
  elementId: string,
  origin: FieldOrigin,
  key: string,
  baseValue: unknown,
): unknown {
  const node = readPanelNodeById(elementId);
  const props = node?.props;
  if (!props) return baseValue;

  if (origin === "style") {
    const style = props.style;
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      return baseValue;
    }
    return Object.hasOwn(style, key)
      ? (style as Record<string, unknown>)[key]
      : baseValue;
  }

  if (Object.hasOwn(props, key)) return props[key];
  // dataBinding 은 `x-composition` 에만 저장된 노드가 있다 — 편집 계약과 같은 공통 읽기
  //   계약으로 보강한다 (읽기 전용, canonical props 재저장 금지).
  if (key === "dataBinding") {
    const binding = getElementDataBinding(node, "props-first");
    if (binding !== undefined) return binding;
  }
  return baseValue;
}

/**
 * Generic Properties field 한 개의 canonical 값만 구독한다.
 *
 * store-level notification은 공유하되 snapshot이 해당 field의 scalar/reference라서
 * 다른 노드·다른 prop 갱신은 이 필드를 다시 렌더하지 않는다. ref/theme에서 해소된
 * 기본값은 `resolveEditContract`가 계산한 baseValue를 그대로 사용한다.
 */
export function useCanonicalPropertyValue(
  elementId: string | null | undefined,
  origin: FieldOrigin,
  key: string,
  baseValue: unknown,
): unknown {
  const read = useCallback(
    () =>
      elementId
        ? readCanonicalPropertyValue(elementId, origin, key, baseValue)
        : baseValue,
    [baseValue, elementId, key, origin],
  );
  return useSyncExternalStore(subscribeCanonicalStore, read, () => baseValue);
}

/**
 * 여러 키의 값을 한 스냅샷 문자열로 — boolean 칩 묶음 (한 컨트롤이 N 개 prop 을 읽는다). 값이
 * 같으면 같은 문자열이라 useSyncExternalStore 가 안정하다. 항목은 `keys` 순서, JSON 직렬.
 */
export function useCanonicalPropertyValuesSnapshot(
  elementId: string | null | undefined,
  origin: FieldOrigin,
  keys: readonly string[],
  baseValues: readonly unknown[],
): string {
  const read = useCallback(
    () =>
      JSON.stringify(
        keys.map((key, index) =>
          elementId
            ? readCanonicalPropertyValue(elementId, origin, key, baseValues[index])
            : baseValues[index],
        ),
      ),
    // keys/baseValues 는 호출측이 useMemo 로 고정한다
    [baseValues, elementId, keys, origin],
  );
  return useSyncExternalStore(subscribeCanonicalStore, read, read);
}

export function useCanonicalPropertyElementsMap(): ReadonlyMap<
  string,
  PanelNode
> {
  return useCanonicalPropertyAggregateIndex().elementsById;
}

export function useCanonicalPropertyChildren(elementId: string): PanelNode[] {
  const index = useCanonicalPropertyAggregateIndex();
  const canonicalDocument = useActiveCanonicalDocument();
  // ADR-229 Phase 2 (F15): synthetic 자식의 자식 (Button 의 Icon/Text) 도 해소 트리에서.
  const syntheticChildren = useMemo(() => {
    if (!canonicalDocument || !isSyntheticDescendantId(elementId)) return null;
    const children = getSyntheticDescendantChildren(elementId);
    if (children.length === 0) return null;
    return children
      .map(
        (child) =>
          canonicalNodeToElement(child, elementId, {
            pageId: null,
            layoutId: null,
          }) as PanelNode | null,
      )
      .filter((child): child is PanelNode => child !== null);
  }, [canonicalDocument, elementId]);
  return (
    index.childrenByParent.get(elementId) ?? syntheticChildren ?? EMPTY_ELEMENTS
  );
}

export function useCanonicalPropertyChildrenMap(): ReadonlyMap<
  string,
  PanelNode[]
> {
  return useCanonicalPropertyAggregateIndex().childrenByParent;
}
