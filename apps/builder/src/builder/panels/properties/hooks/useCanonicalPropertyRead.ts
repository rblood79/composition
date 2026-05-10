import { useMemo } from "react";
import { useStore } from "../../../stores";
import { useCanonicalElements } from "../../../stores/canonical/canonicalElementsView";
import type { PanelNode } from "../../panelNode";

const EMPTY_CHILDREN: PanelNode[] = [];
const EMPTY_ELEMENTS: PanelNode[] = [];

function buildChildrenMap(elements: PanelNode[]): Map<string, PanelNode[]> {
  const map = new Map<string, PanelNode[]>();
  for (const element of elements) {
    if (element.deleted || !element.parent_id) continue;
    const children = map.get(element.parent_id);
    if (children) {
      children.push(element);
    } else {
      map.set(element.parent_id, [element]);
    }
  }
  return map;
}

function buildElementsMap(elements: PanelNode[]): Map<string, PanelNode> {
  return new Map(elements.map((element) => [element.id, element]));
}

function useCanonicalPropertySourceElements(): PanelNode[] {
  const canonicalElements = useCanonicalElements();
  const storeElements = useStore((state) => {
    if (canonicalElements) return EMPTY_ELEMENTS;
    const { elements: legacyElements } = state;
    return legacyElements ?? EMPTY_ELEMENTS;
  });

  return canonicalElements ?? storeElements;
}

export function useCanonicalPropertyElements(): PanelNode[] {
  return useCanonicalPropertySourceElements();
}

export function useCanonicalPropertyElement(
  elementId: string,
): PanelNode | undefined {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    return sourceElements.find((candidate) => candidate.id === elementId);
  }, [elementId, sourceElements]);
}

export function useCanonicalPropertyElementsMap(): ReadonlyMap<
  string,
  PanelNode
> {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    return buildElementsMap(sourceElements);
  }, [sourceElements]);
}

export function useCanonicalPropertyChildren(elementId: string): PanelNode[] {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    if (sourceElements.length === 0) return EMPTY_CHILDREN;
    return sourceElements.filter(
      (element) => !element.deleted && element.parent_id === elementId,
    );
  }, [elementId, sourceElements]);
}

export function useCanonicalPropertyChildrenMap(): ReadonlyMap<
  string,
  PanelNode[]
> {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    return buildChildrenMap(sourceElements);
  }, [sourceElements]);
}
