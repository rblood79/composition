import { useMemo } from "react";
import { useStore } from "../../../stores";
import { getActiveCanonicalElementById } from "../../../stores/canonical/canonicalElementsView";
import { useActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import type { PanelNode } from "../../panelNode";
import {
  getCanonicalPropertyReadIndex,
  getLegacyPropertyReadIndex,
  type CanonicalPropertyReadIndex,
} from "./canonicalPropertyReadIndex";

const EMPTY_ELEMENTS: PanelNode[] = [];

function useCanonicalPropertyAggregateIndex(): CanonicalPropertyReadIndex {
  const canonicalDocument = useActiveCanonicalDocument();
  const storeElements = useStore((state) => {
    if (canonicalDocument) return EMPTY_ELEMENTS;
    const { elements: legacyElements } = state;
    return legacyElements ?? EMPTY_ELEMENTS;
  });

  return canonicalDocument
    ? getCanonicalPropertyReadIndex(canonicalDocument)
    : getLegacyPropertyReadIndex(storeElements);
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
  const storeElement = useStore((state) => {
    if (canonicalDocument) return undefined;
    return (state.elements ?? EMPTY_ELEMENTS).find(
      (candidate) => candidate.id === elementId,
    );
  });

  return canonicalDocument ? canonicalElement : storeElement;
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
