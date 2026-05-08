import { useMemo } from "react";
import { useStore } from "../../../stores";
import { useCanonicalElements } from "../../../stores/canonical/canonicalElementsView";
import type { Element } from "../../../../types/core/store.types";

const EMPTY_CHILDREN: Element[] = [];
const EMPTY_ELEMENTS: Element[] = [];

function buildChildrenMap(elements: Element[]): Map<string, Element[]> {
  const map = new Map<string, Element[]>();
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

function buildElementsMap(elements: Element[]): Map<string, Element> {
  return new Map(elements.map((element) => [element.id, element]));
}

function useCanonicalPropertySourceElements(): Element[] {
  const canonicalElements = useCanonicalElements();
  const storeElements = useStore((state) => {
    if (canonicalElements) return EMPTY_ELEMENTS;
    const { elements: legacyElements } = state;
    return legacyElements ?? EMPTY_ELEMENTS;
  });

  return canonicalElements ?? storeElements;
}

export function useCanonicalPropertyElements(): Element[] {
  return useCanonicalPropertySourceElements();
}

export function useCanonicalPropertyElement(
  elementId: string,
): Element | undefined {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    return sourceElements.find((candidate) => candidate.id === elementId);
  }, [elementId, sourceElements]);
}

export function useCanonicalPropertyElementsMap(): ReadonlyMap<
  string,
  Element
> {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    return buildElementsMap(sourceElements);
  }, [sourceElements]);
}

export function useCanonicalPropertyChildren(elementId: string): Element[] {
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
  Element[]
> {
  const sourceElements = useCanonicalPropertySourceElements();

  return useMemo(() => {
    return buildChildrenMap(sourceElements);
  }, [sourceElements]);
}
