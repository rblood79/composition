import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { FieldOrigin } from "@composition/shared";
import { getActiveCanonicalElementById } from "../../../stores/canonical/canonicalElementsView";
import {
  subscribeCanonicalStore,
  useActiveCanonicalDocument,
} from "../../../stores/canonical/canonicalElementsBridge";
import {
  getFirstProjectableNodeLookupByReference,
  getLastProjectableNodeById,
} from "../../../stores/canonical/canonicalTraversalHelpers";
import { getCanonicalRefTarget } from "../../../utils/canonicalRefResolution";
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
      undefined
    );
  }, [canonicalDocument, elementId]);

  return canonicalElement;
}

function readCanonicalPropertyElementType(elementId: string): string | null {
  if (!elementId) return null;
  const node = getLastProjectableNodeById(elementId);
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

function readCanonicalPropertyValue(
  elementId: string,
  origin: FieldOrigin,
  key: string,
  baseValue: unknown,
): unknown {
  const node = getLastProjectableNodeById(elementId);
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

  return Object.hasOwn(props, key) ? props[key] : baseValue;
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

export function useCanonicalPropertyElementsMap(): ReadonlyMap<
  string,
  PanelNode
> {
  return useCanonicalPropertyAggregateIndex().elementsById;
}

export function useCanonicalPropertyChildren(elementId: string): PanelNode[] {
  return (
    useCanonicalPropertyAggregateIndex().childrenByParent.get(elementId) ??
    EMPTY_ELEMENTS
  );
}

export function useCanonicalPropertyChildrenMap(): ReadonlyMap<
  string,
  PanelNode[]
> {
  return useCanonicalPropertyAggregateIndex().childrenByParent;
}
