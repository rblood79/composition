import { useMemo } from "react";
import { getActiveCanonicalElementById } from "../../../stores/canonical/canonicalElementsView";
import { useActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
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
