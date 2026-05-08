import type { CompositionDocument } from "@composition/shared";

import { canonicalDocumentToFrameElementScopes } from "../../../../adapters/canonical/frameElementScope";
import type { Element } from "../../../../types/core/store.types";
import { visitCanonicalDocumentElements } from "../../../stores/canonical/canonicalElementsView";
import {
  rebuildPageIndex,
  type PageElementIndex,
} from "../../../stores/utils/elementIndexer";

export interface CanonicalSceneModel {
  childrenByParent: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
  frameElementScopes: ReturnType<typeof canonicalDocumentToFrameElementScopes>;
  pageIndex: PageElementIndex;
}

export function buildSceneElementMap(
  elements: Element[],
): Map<string, Element> {
  return new Map(elements.map((element) => [element.id, element]));
}

export function buildSceneChildrenByParent(
  elements: Element[],
): Map<string, Element[]> {
  const map = new Map<string, Element[]>();
  for (const element of elements) {
    if (element.deleted || !element.parent_id) continue;
    const list = map.get(element.parent_id);
    if (list) {
      list.push(element);
    } else {
      map.set(element.parent_id, [element]);
    }
  }
  return map;
}

export function buildCanonicalSceneModel(
  doc: CompositionDocument,
): CanonicalSceneModel {
  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  const elementsMap = buildSceneElementMap(elements);

  return {
    childrenByParent: buildSceneChildrenByParent(elements),
    elements,
    elementsMap,
    frameElementScopes: canonicalDocumentToFrameElementScopes(doc),
    pageIndex: rebuildPageIndex(elements, elementsMap),
  };
}
