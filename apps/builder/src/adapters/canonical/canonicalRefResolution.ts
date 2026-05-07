import type { Element } from "../../types/core/store.types";
import { mergePropsWithStyleDeep } from "./instanceResolver";
import { resolveReference } from "../../utils/component/referenceResolution";
import type { LegacyElementMirrorFields } from "./legacyElementFields";

type CanonicalRefFields = {
  descendants?: unknown;
  metadata?: { [key: string]: unknown };
  ref?: unknown;
};

type OverrideNode = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asCanonicalRefFields(element: Element): Element & CanonicalRefFields {
  return element as Element & CanonicalRefFields;
}

function getElementProps(element: Element): Record<string, unknown> {
  return element.props ?? {};
}

function getRefOverrideProps(element: Element): Record<string, unknown> {
  const legacyOverrides = (element as Element & LegacyElementMirrorFields)
    .overrides;
  if (isRecord(legacyOverrides)) return legacyOverrides;
  return element.props ?? {};
}

export function isCanonicalRefElement(element: Element | undefined): boolean {
  return getCanonicalRefTarget(element) !== null;
}

export function getCanonicalRefTarget(
  element: Element | undefined,
): string | null {
  if (!element) return null;
  const ref = asCanonicalRefFields(element).ref;
  if (typeof ref === "string" && ref.length > 0) return ref;

  const masterId = (element as Element & LegacyElementMirrorFields).masterId;
  return typeof masterId === "string" && masterId.length > 0 ? masterId : null;
}

export function resolveCanonicalRefMaster(
  ref: string,
  elements: Iterable<Element>,
): Element | undefined {
  return resolveReference(ref, elements);
}

export function resolveCanonicalRefElement(
  element: Element,
  elements: Iterable<Element>,
): Element {
  if (!isCanonicalRefElement(element)) return element;

  const ref = getCanonicalRefTarget(element)!;
  const master = resolveCanonicalRefMaster(ref, elements);
  if (!master) return element;

  const {
    componentRole: _componentRole,
    descendants: _descendants,
    masterId: _masterId,
    overrides: _overrides,
    props: _props,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    ...refFieldOverrides
  } = element as Element & CanonicalRefFields & LegacyElementMirrorFields;

  return {
    ...master,
    ...refFieldOverrides,
    id: element.id,
    customId: element.customId,
    parent_id: element.parent_id ?? null,
    page_id: element.page_id ?? master.page_id ?? null,
    layout_id: element.layout_id ?? null,
    props: mergePropsWithStyleDeep(
      getElementProps(master),
      getRefOverrideProps(element),
    ),
    ref,
    componentName: element.componentName ?? master.componentName,
    reusable: undefined,
  } as Element;
}

export function resolveCanonicalRefElementsMap(
  elementsMap: Map<string, Element>,
): Map<string, Element> {
  let changed = false;
  const elements = Array.from(elementsMap.values());
  const resolvedEntries = Array.from(elementsMap.entries()).map(
    ([id, element]) => {
      const resolved = resolveCanonicalRefElement(element, elements);
      if (resolved !== element) changed = true;
      return [id, resolved] as const;
    },
  );

  return changed ? new Map(resolvedEntries) : elementsMap;
}

export type ResolvedCanonicalRefTree = {
  childrenMap: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
};

function getStableSegment(element: Element): string {
  return element.customId ?? element.componentName ?? element.id;
}

function buildChildrenMapFromElements(
  elements: Iterable<Element>,
): Map<string, Element[]> {
  const childrenMap = new Map<string, Element[]>();
  for (const element of elements) {
    if (!element.parent_id) continue;
    const children = childrenMap.get(element.parent_id);
    if (children) {
      children.push(element);
    } else {
      childrenMap.set(element.parent_id, [element]);
    }
  }

  return childrenMap;
}

function getDescendantPatch(
  refElement: Element,
  path: string,
): Record<string, unknown> | null {
  const descendants = asCanonicalRefFields(refElement).descendants;
  if (!isRecord(descendants)) return null;
  const patch = descendants[path];
  return isRecord(patch) ? patch : null;
}

function propsFromDescendantPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const {
    children,
    descendants: _descendants,
    id: _id,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    ...props
  } = patch;
  if (isRecord(patch.props)) return patch.props;
  if (children !== undefined && !Array.isArray(children)) {
    props.children = children;
  }
  return props;
}

function getOverrideNodeSegment(node: OverrideNode, index: number): string {
  const customId = node.customId;
  if (typeof customId === "string" && customId) return customId;

  const id = node.id;
  if (typeof id === "string" && id) return id;

  const name = node.name;
  if (typeof name === "string" && name) return name;

  return `child-${index}`;
}

function getOverrideNodeProps(node: OverrideNode): Record<string, unknown> {
  const {
    children: _children,
    customId: _customId,
    descendants: _descendants,
    id: _id,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    slot: _slot,
    type: _type,
    ...props
  } = node;

  return isRecord(node.props) ? node.props : props;
}

function getOverrideNodeSlot(node: OverrideNode): false | string[] | undefined {
  const slot = node.slot;
  return slot === false || Array.isArray(slot) ? slot : undefined;
}

function applyDescendantPatchToElement(
  element: Element,
  patch: Record<string, unknown> | null,
): Element {
  if (!patch) return element;
  const patchProps = propsFromDescendantPatch(patch);
  const patchedType =
    typeof patch.type === "string" && patch.type.length > 0
      ? patch.type
      : element.type;

  return {
    ...element,
    type: patchedType,
    props: mergePropsWithStyleDeep(getElementProps(element), patchProps),
  } as Element;
}

function replaceResultElement(
  element: Element,
  resultElementsMap: Map<string, Element>,
  resultElements: Element[],
): Element {
  resultElementsMap.set(element.id, element);
  const index = resultElements.findIndex(
    (candidate) => candidate.id === element.id,
  );
  if (index >= 0) {
    resultElements[index] = element;
  } else {
    resultElements.push(element);
  }
  return element;
}

function removeSyntheticDescendantElements(
  syntheticParentId: string,
  resultElementsMap: Map<string, Element>,
  resultChildrenMap: Map<string, Element[]>,
  resultElements: Element[],
): void {
  const idPrefix = `${syntheticParentId}/`;
  for (let index = resultElements.length - 1; index >= 0; index -= 1) {
    const element = resultElements[index];
    if (!element?.id.startsWith(idPrefix)) continue;
    resultElements.splice(index, 1);
    resultElementsMap.delete(element.id);
    resultChildrenMap.delete(element.id);
  }

  for (const [parentId, children] of resultChildrenMap.entries()) {
    if (parentId.startsWith(idPrefix)) {
      resultChildrenMap.delete(parentId);
      continue;
    }
    const nextChildren = children.filter(
      (child) => !child.id.startsWith(idPrefix),
    );
    if (nextChildren.length !== children.length) {
      resultChildrenMap.set(parentId, nextChildren);
    }
  }
}

function materializeOverrideChildren(
  refElement: Element,
  overrideChildren: unknown[],
  syntheticParentId: string,
  sourceChildrenMap: Map<string, Element[]>,
  resultElementsMap: Map<string, Element>,
  resultChildrenMap: Map<string, Element[]>,
  resultElements: Element[],
  pathPrefix: string,
): void {
  const syntheticChildren: Element[] = [];

  overrideChildren.forEach((child, index) => {
    if (!isRecord(child)) return;

    const segment = getOverrideNodeSegment(child, index);
    const syntheticId = `${syntheticParentId}/${segment}`;
    const existingSyntheticChild = resultElementsMap.get(syntheticId);

    if (existingSyntheticChild) {
      syntheticChildren.push(existingSyntheticChild);
      const nestedChildren = child.children;
      if (Array.isArray(nestedChildren)) {
        removeSyntheticDescendantElements(
          syntheticId,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
        );
        const nextPath = pathPrefix ? `${pathPrefix}/${segment}` : segment;
        materializeOverrideChildren(
          refElement,
          nestedChildren,
          syntheticId,
          sourceChildrenMap,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
          nextPath,
        );
      }
      return;
    }

    const type = typeof child.type === "string" ? child.type : "frame";
    const name = typeof child.name === "string" ? child.name : undefined;
    const ref = typeof child.ref === "string" ? child.ref : undefined;
    const descendants = isRecord(child.descendants)
      ? child.descendants
      : undefined;
    const slot = getOverrideNodeSlot(child);
    const syntheticChild = {
      id: syntheticId,
      customId: typeof child.id === "string" ? child.id : segment,
      type,
      parent_id: syntheticParentId,
      page_id: refElement.page_id ?? null,
      layout_id: refElement.layout_id ?? null,
      props: getOverrideNodeProps(child),
      ...(name ? { componentName: name } : {}),
      ...(ref ? { ref } : {}),
      ...(descendants ? { descendants } : {}),
      ...(slot !== undefined ? { slot } : {}),
    } as Element;

    const resolvedChild = isCanonicalRefElement(syntheticChild)
      ? resolveCanonicalRefElement(syntheticChild, resultElementsMap.values())
      : syntheticChild;

    resultElements.push(resolvedChild);
    resultElementsMap.set(syntheticId, resolvedChild);
    syntheticChildren.push(resolvedChild);

    const syntheticRef = getCanonicalRefTarget(syntheticChild);
    if (syntheticRef) {
      const master = resolveCanonicalRefMaster(
        syntheticRef,
        resultElementsMap.values(),
      );
      if (master) {
        materializeSyntheticDescendants(
          syntheticChild,
          master,
          syntheticId,
          sourceChildrenMap,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
        );
        return;
      }
    }

    const nestedChildren = child.children;
    if (Array.isArray(nestedChildren)) {
      const nextPath = pathPrefix ? `${pathPrefix}/${segment}` : segment;
      materializeOverrideChildren(
        refElement,
        nestedChildren,
        syntheticId,
        sourceChildrenMap,
        resultElementsMap,
        resultChildrenMap,
        resultElements,
        nextPath,
      );
    }
  });

  if (syntheticChildren.length > 0) {
    resultChildrenMap.set(syntheticParentId, syntheticChildren);
  }
}

function materializeSyntheticDescendants(
  refElement: Element,
  sourceParent: Element,
  syntheticParentId: string,
  sourceChildrenMap: Map<string, Element[]>,
  resultElementsMap: Map<string, Element>,
  resultChildrenMap: Map<string, Element[]>,
  resultElements: Element[],
  pathPrefix = "",
  visitedSourceIds: Set<string> = new Set(),
): void {
  if (visitedSourceIds.has(sourceParent.id)) return;

  const nextVisitedSourceIds = new Set(visitedSourceIds);
  nextVisitedSourceIds.add(sourceParent.id);
  const sourceChildren = sourceChildrenMap.get(sourceParent.id) ?? [];
  const syntheticChildren: Element[] = [];

  sourceChildren.forEach((sourceChild, index) => {
    const segment = getStableSegment(sourceChild);
    const path = pathPrefix ? `${pathPrefix}/${segment}` : segment;
    const patch = getDescendantPatch(refElement, path);
    const syntheticId = `${refElement.id}/${path}`;
    const patchProps = patch ? propsFromDescendantPatch(patch) : {};
    const patchedType =
      patch && typeof patch.type === "string" ? patch.type : sourceChild.type;
    const existingSyntheticChild = resultElementsMap.get(syntheticId);

    if (existingSyntheticChild) {
      const patchedExistingChild = applyDescendantPatchToElement(
        existingSyntheticChild,
        patch,
      );
      replaceResultElement(
        patchedExistingChild,
        resultElementsMap,
        resultElements,
      );
      syntheticChildren.push(patchedExistingChild);
      if (patch && Array.isArray(patch.children)) {
        removeSyntheticDescendantElements(
          syntheticId,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
        );
        materializeOverrideChildren(
          refElement,
          patch.children,
          syntheticId,
          sourceChildrenMap,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
          path,
        );
      } else {
        materializeSyntheticDescendants(
          refElement,
          sourceChild,
          syntheticId,
          sourceChildrenMap,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
          path,
          nextVisitedSourceIds,
        );
      }
      return;
    }

    const syntheticChild = {
      ...sourceChild,
      id: syntheticId,
      type: patchedType,
      parent_id: syntheticParentId,
      page_id: refElement.page_id ?? sourceChild.page_id ?? null,
      layout_id: refElement.layout_id ?? sourceChild.layout_id ?? null,
      props: mergePropsWithStyleDeep(getElementProps(sourceChild), patchProps),
      reusable: undefined,
    } as Element;

    resultElements.push(syntheticChild);
    resultElementsMap.set(syntheticId, syntheticChild);
    syntheticChildren.push(syntheticChild);

    if (patch && Array.isArray(patch.children)) {
      removeSyntheticDescendantElements(
        syntheticId,
        resultElementsMap,
        resultChildrenMap,
        resultElements,
      );
      materializeOverrideChildren(
        refElement,
        patch.children,
        syntheticId,
        sourceChildrenMap,
        resultElementsMap,
        resultChildrenMap,
        resultElements,
        path,
      );
    } else {
      materializeSyntheticDescendants(
        refElement,
        sourceChild,
        syntheticId,
        sourceChildrenMap,
        resultElementsMap,
        resultChildrenMap,
        resultElements,
        path,
        nextVisitedSourceIds,
      );
    }
  });

  if (syntheticChildren.length > 0) {
    resultChildrenMap.set(syntheticParentId, syntheticChildren);
  }
}

export function resolveCanonicalRefTree(input: {
  childrenMap?: Map<string, Element[]> | null;
  elements: Element[];
  elementsMap: Map<string, Element>;
}): ResolvedCanonicalRefTree {
  const sourceChildrenMap =
    input.childrenMap ??
    buildChildrenMapFromElements(input.elementsMap.values());
  const elements = [...input.elements];
  const elementsMap = new Map(input.elementsMap);
  const childrenMap = new Map(input.childrenMap ?? sourceChildrenMap);

  for (const element of input.elements) {
    if (!isCanonicalRefElement(element)) continue;
    const resolvedRoot = resolveCanonicalRefElement(
      element,
      input.elementsMap.values(),
    );
    if (resolvedRoot !== element) {
      elementsMap.set(element.id, resolvedRoot);
      const index = elements.findIndex(
        (candidate) => candidate.id === element.id,
      );
      if (index >= 0) elements[index] = resolvedRoot;
    }

    const ref = getCanonicalRefTarget(element);
    if (!ref) continue;
    const master = resolveCanonicalRefMaster(ref, input.elementsMap.values());
    if (!master) continue;

    materializeSyntheticDescendants(
      element,
      master,
      element.id,
      sourceChildrenMap,
      elementsMap,
      childrenMap,
      elements,
    );
  }

  return { childrenMap, elements, elementsMap };
}
