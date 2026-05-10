import { mergePropsWithStyleDeep } from "./instanceResolver";
import { resolveReference } from "../../utils/component/referenceResolution";
import type { LegacyElementMirrorFields } from "./legacyElementFields";

export type CanonicalRefResolvableNode = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
  parentId?: string | null;
  pageId?: string | null;
  layoutId?: string | null;
  customId?: string | null;
  componentName?: string | null;
  name?: string;
  reusable?: boolean;
  deleted?: boolean;
  slot?: false | string[];
  metadata?: {
    componentName?: unknown;
    customId?: unknown;
    [key: string]: unknown;
  };
};

type CanonicalRefFields = {
  descendants?: unknown;
  metadata?: { [key: string]: unknown };
  ref?: unknown;
};

type OverrideNode = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asCanonicalRefFields<T extends CanonicalRefResolvableNode>(
  node: T,
): T & CanonicalRefFields {
  return node as T & CanonicalRefFields;
}

function getNodeProps<T extends CanonicalRefResolvableNode>(
  node: T,
): Record<string, unknown> {
  return node.props ?? {};
}

function getRefOverrideProps<T extends CanonicalRefResolvableNode>(
  node: T,
): Record<string, unknown> {
  const legacyOverrides = (node as T & LegacyElementMirrorFields).overrides;
  if (isRecord(legacyOverrides)) return legacyOverrides;
  return node.props ?? {};
}

function getParentId<T extends CanonicalRefResolvableNode>(
  node: T,
): string | null {
  return node.parentId ?? node.parent_id ?? null;
}

function getPageId<T extends CanonicalRefResolvableNode>(
  node: T,
): string | null {
  return node.pageId ?? node.page_id ?? null;
}

function getLayoutId<T extends CanonicalRefResolvableNode>(
  node: T,
): string | null {
  return node.layoutId ?? node.layout_id ?? null;
}

export function isCanonicalRefElement<T extends CanonicalRefResolvableNode>(
  node: T | undefined,
): boolean {
  return getCanonicalRefTarget(node) !== null;
}

export function getCanonicalRefTarget<T extends CanonicalRefResolvableNode>(
  node: T | undefined,
): string | null {
  if (!node) return null;
  const ref = asCanonicalRefFields(node).ref;
  if (typeof ref === "string" && ref.length > 0) return ref;

  const masterId = (node as T & LegacyElementMirrorFields).masterId;
  return typeof masterId === "string" && masterId.length > 0 ? masterId : null;
}

export function resolveCanonicalRefMaster<T extends CanonicalRefResolvableNode>(
  ref: string,
  nodes: Iterable<T>,
): T | undefined {
  return resolveReference(ref, nodes);
}

export function resolveCanonicalRefElement<
  T extends CanonicalRefResolvableNode,
>(node: T, nodes: Iterable<T>): T {
  if (!isCanonicalRefElement(node)) return node;

  const ref = getCanonicalRefTarget(node)!;
  const master = resolveCanonicalRefMaster(ref, nodes);
  if (!master) return node;

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
  } = node as T & CanonicalRefFields & LegacyElementMirrorFields;

  return {
    ...master,
    ...refFieldOverrides,
    id: node.id,
    customId: node.customId,
    parentId: getParentId(node),
    pageId: getPageId(node) ?? getPageId(master),
    layoutId: getLayoutId(node),
    parent_id: getParentId(node),
    page_id: getPageId(node) ?? getPageId(master),
    layout_id: getLayoutId(node),
    props: mergePropsWithStyleDeep(
      getNodeProps(master),
      getRefOverrideProps(node),
    ),
    ref,
    name: node.name ?? master.name,
    componentName: node.componentName ?? master.componentName,
    reusable: undefined,
  } as T;
}

export function resolveCanonicalRefElementsMap<
  T extends CanonicalRefResolvableNode,
>(elementsMap: Map<string, T>): Map<string, T> {
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

export type ResolvedCanonicalRefTree<T extends CanonicalRefResolvableNode> = {
  childrenMap: Map<string, T[]>;
  elements: T[];
  elementsMap: Map<string, T>;
};

function getStableSegment<T extends CanonicalRefResolvableNode>(
  node: T,
): string {
  return node.customId ?? node.componentName ?? node.name ?? node.id;
}

function buildChildrenMapFromElements<T extends CanonicalRefResolvableNode>(
  elements: Iterable<T>,
): Map<string, T[]> {
  const childrenMap = new Map<string, T[]>();
  for (const element of elements) {
    const parentId = getParentId(element);
    if (!parentId) continue;
    const children = childrenMap.get(parentId);
    if (children) {
      children.push(element);
    } else {
      childrenMap.set(parentId, [element]);
    }
  }

  return childrenMap;
}

function getDescendantPatch<T extends CanonicalRefResolvableNode>(
  refElement: T,
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

function applyDescendantPatchToElement<T extends CanonicalRefResolvableNode>(
  element: T,
  patch: Record<string, unknown> | null,
): T {
  if (!patch) return element;
  const patchProps = propsFromDescendantPatch(patch);
  const patchedType =
    typeof patch.type === "string" && patch.type.length > 0
      ? patch.type
      : element.type;

  return {
    ...element,
    type: patchedType,
    props: mergePropsWithStyleDeep(getNodeProps(element), patchProps),
  } as T;
}

function replaceResultElement<T extends CanonicalRefResolvableNode>(
  element: T,
  resultElementsMap: Map<string, T>,
  resultElements: T[],
): T {
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

function removeSyntheticDescendantElements<
  T extends CanonicalRefResolvableNode,
>(
  syntheticParentId: string,
  resultElementsMap: Map<string, T>,
  resultChildrenMap: Map<string, T[]>,
  resultElements: T[],
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

function materializeOverrideChildren<T extends CanonicalRefResolvableNode>(
  refElement: T,
  overrideChildren: unknown[],
  syntheticParentId: string,
  sourceChildrenMap: Map<string, T[]>,
  resultElementsMap: Map<string, T>,
  resultChildrenMap: Map<string, T[]>,
  resultElements: T[],
  pathPrefix: string,
): void {
  const syntheticChildren: T[] = [];

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
      parentId: syntheticParentId,
      pageId: getPageId(refElement),
      layoutId: getLayoutId(refElement),
      parent_id: syntheticParentId,
      page_id: getPageId(refElement),
      layout_id: getLayoutId(refElement),
      props: getOverrideNodeProps(child),
      ...(name ? { name } : {}),
      ...(name ? { componentName: name } : {}),
      ...(ref ? { ref } : {}),
      ...(descendants ? { descendants } : {}),
      ...(slot !== undefined ? { slot } : {}),
    } as T;

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

function materializeSyntheticDescendants<T extends CanonicalRefResolvableNode>(
  refElement: T,
  sourceParent: T,
  syntheticParentId: string,
  sourceChildrenMap: Map<string, T[]>,
  resultElementsMap: Map<string, T>,
  resultChildrenMap: Map<string, T[]>,
  resultElements: T[],
  pathPrefix = "",
  visitedSourceIds: Set<string> = new Set(),
): void {
  if (visitedSourceIds.has(sourceParent.id)) return;

  const nextVisitedSourceIds = new Set(visitedSourceIds);
  nextVisitedSourceIds.add(sourceParent.id);
  const sourceChildren = sourceChildrenMap.get(sourceParent.id) ?? [];
  const syntheticChildren: T[] = [];

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
      parentId: syntheticParentId,
      pageId: getPageId(refElement) ?? getPageId(sourceChild),
      layoutId: getLayoutId(refElement) ?? getLayoutId(sourceChild),
      parent_id: syntheticParentId,
      page_id: getPageId(refElement) ?? getPageId(sourceChild),
      layout_id: getLayoutId(refElement) ?? getLayoutId(sourceChild),
      props: mergePropsWithStyleDeep(getNodeProps(sourceChild), patchProps),
      reusable: undefined,
    } as T;

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

export function resolveCanonicalRefTree<
  T extends CanonicalRefResolvableNode,
>(input: {
  childrenMap?: Map<string, T[]> | null;
  elements: T[];
  elementsMap: Map<string, T>;
}): ResolvedCanonicalRefTree<T> {
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
