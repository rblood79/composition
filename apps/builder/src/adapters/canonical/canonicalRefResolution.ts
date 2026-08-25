import {
  readPropsSchema,
  resolveTemplateBindingValues,
  substituteTemplateBindingsInChildren,
  substituteTemplateBindingsInProps,
} from "@composition/shared";

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

/**
 * Reusable descendant의 canonical path segment SSOT.
 * DOM, Skia, commit adapter가 customId/componentName/name/id를 서로 다르게
 * 선택하면 같은 semantic target이 한 renderer에서만 갱신되므로 resolver와
 * presentation projection이 이 helper를 공유한다.
 */
export function getCanonicalRefPathSegment<
  T extends Pick<CanonicalRefResolvableNode, "id"> & {
    customId?: string | null;
    componentName?: string | null;
    name?: string;
  },
>(node: T): string {
  return node.customId || node.componentName || node.name || node.id;
}

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

type CanonicalRefDescendantOwner = CanonicalRefResolvableNode & {
  descendants?: Record<string, Record<string, unknown>>;
};

export function getCanonicalRefDescendantOverride(
  node: CanonicalRefResolvableNode,
  pathKey: string,
): Record<string, unknown> | null {
  const override = (node as CanonicalRefDescendantOwner).descendants?.[pathKey];
  return isRecord(override) ? override : null;
}

export function withCanonicalRefDescendantFills<
  T extends CanonicalRefResolvableNode,
>(node: T, pathKey: string, fills: readonly unknown[]): T {
  const owner = node as T & CanonicalRefDescendantOwner;
  return {
    ...node,
    descendants: {
      ...(owner.descendants ?? {}),
      [pathKey]: {
        ...(owner.descendants?.[pathKey] ?? {}),
        fills,
      },
    },
  } as T;
}

export function withCanonicalRefDescendantStylePatch<
  T extends CanonicalRefResolvableNode,
>(node: T, pathKey: string, patch: Readonly<Record<string, unknown>>): T {
  const owner = node as T & CanonicalRefDescendantOwner;
  const current = owner.descendants?.[pathKey];
  const currentStyle = isRecord(current?.style) ? current.style : {};
  return {
    ...node,
    descendants: {
      ...(owner.descendants ?? {}),
      [pathKey]: {
        ...(current ?? {}),
        style: { ...currentStyle, ...patch },
      },
    },
  } as T;
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

  const mergedProps = mergePropsWithStyleDeep(
    getNodeProps(master),
    getRefOverrideProps(node),
  );

  // ADR-148 Phase 2 — nested children consumer 축 치환 (propsSchema gate).
  //   resolved root 는 `{...master}` 로 origin 의 nested `children` 을 물려받고 Preview
  //   `CanonicalNodeRenderer` 가 이를 직접 렌더한다. flat synthetic 축(resolveCanonicalRefTree)
  //   만 치환하면 CSS↔Skia 발산 — 두 축 모두 같은 바인딩으로 치환한다. 인스턴스가 자체
  //   children 을 갖는 경우(override children) 그 배열이 유효 소비 대상이므로 그쪽을 치환.
  const schema = readPropsSchema(master);
  const bindings = schema
    ? resolveTemplateBindingValues(schema, mergedProps)
    : undefined;
  const nodeChildren = (node as { children?: unknown }).children;
  const masterChildren = (master as { children?: unknown }).children;
  const effectiveChildren = Array.isArray(nodeChildren)
    ? nodeChildren
    : masterChildren;
  const substitutedChildren =
    bindings && Array.isArray(effectiveChildren)
      ? substituteTemplateBindingsInChildren(effectiveChildren, bindings)
      : undefined;

  return {
    ...master,
    ...refFieldOverrides,
    ...(substitutedChildren !== undefined
      ? { children: substitutedChildren }
      : {}),
    id: node.id,
    customId: node.customId,
    parentId: getParentId(node),
    pageId: getPageId(node) ?? getPageId(master),
    layoutId: getLayoutId(node),
    parent_id: getParentId(node),
    page_id: getPageId(node) ?? getPageId(master),
    layout_id: getLayoutId(node),
    props: mergedProps,
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
    fills: _fills,
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
    fills: _fills,
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

/**
 * ADR-148 Phase 2 — 템플릿 바인딩 치환 (propsSchema gate).
 *
 * origin root 가 `metadata.propsSchema` 를 선언한 reusable 에 한해, resolved instance
 * root props(origin 기본 + override merge) 를 schema 키로 좁힌 바인딩을 산출한다.
 * propsSchema 미선언 origin(ListBox 계열 — placeholder 가 row-data 바인딩)은 undefined
 * 를 반환해 synthetic 자식의 `{키}` 를 원형 보존한다.
 */
function resolveMasterTemplateBindings<T extends CanonicalRefResolvableNode>(
  master: T,
  resolvedRootProps: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const schema = readPropsSchema(master);
  if (!schema) return undefined;
  return resolveTemplateBindingValues(schema, resolvedRootProps);
}

function withTemplateBindings<T extends CanonicalRefResolvableNode>(
  element: T,
  templateBindings: Record<string, unknown> | undefined,
): T {
  if (!templateBindings) return element;
  const props = getNodeProps(element);
  const substituted = substituteTemplateBindingsInProps(
    props,
    templateBindings,
  );
  return substituted === props
    ? element
    : ({ ...element, props: substituted } as T);
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
    ...(Array.isArray(patch.fills) ? { fills: patch.fills } : {}),
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
  templateBindings?: Record<string, unknown>,
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
          templateBindings,
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

    const resolvedChild = withTemplateBindings(
      isCanonicalRefElement(syntheticChild)
        ? resolveCanonicalRefElement(syntheticChild, resultElementsMap.values())
        : syntheticChild,
      templateBindings,
    );

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
        // 중첩 ref 는 자신의 origin propsSchema 기준으로 새 바인딩을 산출한다.
        materializeSyntheticDescendants(
          syntheticChild,
          master,
          syntheticId,
          sourceChildrenMap,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
          resolveMasterTemplateBindings(master, getNodeProps(resolvedChild)),
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
        templateBindings,
      );
    }
  });

  if (syntheticChildren.length > 0) {
    const syntheticChildIds = new Set(
      syntheticChildren.map((child) => child.id),
    );
    const existingChildren = resultChildrenMap.get(syntheticParentId) ?? [];
    const preservedChildren = existingChildren.filter(
      (child) => !syntheticChildIds.has(child.id),
    );
    resultChildrenMap.set(syntheticParentId, [
      ...preservedChildren,
      ...syntheticChildren,
    ]);
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
  templateBindings?: Record<string, unknown>,
  pathPrefix = "",
  visitedSourceIds: Set<string> = new Set(),
): void {
  if (visitedSourceIds.has(sourceParent.id)) return;

  const nextVisitedSourceIds = new Set(visitedSourceIds);
  nextVisitedSourceIds.add(sourceParent.id);
  const sourceChildren = sourceChildrenMap.get(sourceParent.id) ?? [];
  const syntheticChildren: T[] = [];

  sourceChildren.forEach((sourceChild) => {
    const segment = getCanonicalRefPathSegment(sourceChild);
    const path = pathPrefix ? `${pathPrefix}/${segment}` : segment;
    const patch = getDescendantPatch(refElement, path);
    const syntheticId = `${refElement.id}/${path}`;
    const patchProps = patch ? propsFromDescendantPatch(patch) : {};
    const patchedType =
      patch && typeof patch.type === "string" ? patch.type : sourceChild.type;
    const existingSyntheticChild = resultElementsMap.get(syntheticId);

    if (existingSyntheticChild) {
      const patchedExistingChild = withTemplateBindings(
        applyDescendantPatchToElement(existingSyntheticChild, patch),
        templateBindings,
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
          templateBindings,
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
          templateBindings,
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
      props: templateBindings
        ? substituteTemplateBindingsInProps(
            mergePropsWithStyleDeep(getNodeProps(sourceChild), patchProps),
            templateBindings,
          )
        : mergePropsWithStyleDeep(getNodeProps(sourceChild), patchProps),
      ...(patch && Array.isArray(patch.fills) ? { fills: patch.fills } : {}),
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
        templateBindings,
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
        templateBindings,
        path,
        nextVisitedSourceIds,
      );
    }
  });

  if (syntheticChildren.length > 0) {
    const syntheticChildIds = new Set(
      syntheticChildren.map((child) => child.id),
    );
    const existingChildren = resultChildrenMap.get(syntheticParentId) ?? [];
    const preservedChildren = existingChildren.filter(
      (child) => !syntheticChildIds.has(child.id),
    );
    resultChildrenMap.set(syntheticParentId, [
      ...preservedChildren,
      ...syntheticChildren,
    ]);
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
      // ADR-148 Phase 2 — origin 이 propsSchema 를 선언한 reusable 에 한해 `{키}` 치환.
      resolveMasterTemplateBindings(master, getNodeProps(resolvedRoot)),
    );
  }

  return { childrenMap, elements, elementsMap };
}
