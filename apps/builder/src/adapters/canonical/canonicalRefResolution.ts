import {
  mergeFillSizing,
  readPropsSchema,
  resolveStaticItemKey,
  resolveTemplateBindingValues,
  substituteTemplateBindingsInChildren,
  substituteTemplateBindingsInProps,
} from "@composition/shared";

import { applyPropsPatch, composePropsPatches } from "./instanceResolver";
import { resolveReference } from "../../utils/component/referenceResolution";
import type { LegacyElementMirrorFields } from "./legacyElementFields";
import { isRenderProjectionId } from "../../builder/projection/renderProjectionIds";
import {
  buildStateLayerSet,
  omitOwnedKeys,
  readForcedVariantStates,
  readInstanceOwnedKeys,
  resolveActiveStateLayer,
  type ActiveVariantStates,
  type StateLayer,
} from "../../builder/components/stateVariantLayers";

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
  sizing?: import("@composition/shared").FillAxes;
  responsive?: import("@composition/shared").ElementResponsiveConfig;
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

/**
 * ADR-234 Phase 3 — `resolveCanonicalRefTree` 가 해석을 끝낸 ref 노드 표식 (symbol — 직렬화 · 패널 표면에
 * 안 나온다, spread 로는 따라간다). 페인트 경로 (`StoreRenderBridge.buildNodeForElement`) 는 scene 노드를
 * 다시 `resolveCanonicalRefElement` 에 넣는데, 해석된 props 를 patch 로 master 위에 다시 얹으면 상태 층 ·
 * instance `null` 이 지운 키 (휴지 Tab 의 `_isSelected`) 를 master 값이 되살린다.
 */
const RESOLVED_REF_MARK = Symbol.for("composition.adr234.resolvedRef");

function markResolvedRef<T extends object>(node: T): T {
  (node as Record<symbol, unknown>)[RESOLVED_REF_MARK] = true;
  return node;
}

export function isResolvedRefNode(node: unknown): boolean {
  return Boolean(
    node &&
    typeof node === "object" &&
    (node as Record<symbol, unknown>)[RESOLVED_REF_MARK] === true,
  );
}

export function resolveCanonicalRefElement<
  T extends CanonicalRefResolvableNode,
>(node: T, nodes: Iterable<T>, knownMaster?: T): T {
  if (!isCanonicalRefElement(node)) return node;
  if (isResolvedRefNode(node)) return node;

  const ref = getCanonicalRefTarget(node)!;
  const master = knownMaster ?? resolveCanonicalRefMaster(ref, nodes);
  if (!master) return node;

  const {
    componentRole: _componentRole,
    descendants: _descendants,
    masterId: _masterId,
    overrides: _overrides,
    props: _props,
    ref: _ref,
    reusable: ownReusable,
    type: _type,
    ...refFieldOverrides
  } = node as T & CanonicalRefFields & LegacyElementMirrorFields;

  const mergedProps = applyPropsPatch(
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
    // ADR-234: origin 의 상태 표식 (`metadata.variant` — 선택 가능한 가족 origin = selected) 은 그
    //   origin 을 Components 페이지에 그리는 표식이다 — 자기 metadata 가 없는 instance 로 새면 모든
    //   instance 가 강제 선택으로 그려진다.
    ...(master.metadata &&
    "variant" in master.metadata &&
    !(node as { metadata?: unknown }).metadata
      ? { metadata: withoutVariantMarks(master.metadata) }
      : {}),
    ...refFieldOverrides,
    ...mergeFillSizing(master, node),
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
    // 원본의 `reusable` 은 넘기지 않되 (모든 인스턴스가 원본으로 읽히면 안 된다)
    // 인스턴스 **자신의** 승격은 보존한다 — ADR-199 R7. 통째로 지우면 dual
    // 노드(ref + 자기 reusable)가 캔버스 표면에서 원본으로 안 읽혀 "컴포넌트
    // 만들기" 라는 no-op 진입점이 뜬다 (패널은 canonical 을 직접 읽어 정상,
    // 두 표면이 같은 노드에 반대 라벨을 띄웠다 — 2026-08-30 live 실측).
    reusable: ownReusable === true ? true : undefined,
  } as T;
}

function withoutVariantMarks(
  metadata: NonNullable<CanonicalRefResolvableNode["metadata"]>,
): CanonicalRefResolvableNode["metadata"] {
  const { variant: _variant, variantOf: _variantOf, ...rest } = metadata;
  return rest;
}

export function resolveCanonicalRefElementsMap<
  T extends CanonicalRefResolvableNode,
>(elementsMap: Map<string, T>): Map<string, T> {
  let changed = false;
  const elements = Array.from(elementsMap.values());
  const resolvedEntries = Array.from(elementsMap.entries()).map(
    ([id, element]) => {
      // ADR-228 G4: id 참조는 map 조회 (선형 탐색은 legacy 참조 폴백).
      const ref = getCanonicalRefTarget(element);
      const known = ref ? elementsMap.get(ref) : undefined;
      const resolved = resolveCanonicalRefElement(element, elements, known);
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

/**
 * ADR-229 Phase 0 — descendants patch 의 소유자 스택.
 *
 * 조합 origin 의 자식이 다른 origin 의 ref (Form 안 TextField · Toolbar 안 Button) 이면
 * 그 자식 아래 노드의 patch 는 두 층에서 온다 — 조합 자식 ref 자신의 `descendants`
 * (nested master 기준 상대 path) 와 바깥 instance 의 `descendants` (instance 기준 전체
 * path). 적용 순서는 nested master props → 조합 자식 patch → 바깥 instance patch (바깥이
 * 이긴다). 스택은 `[바깥 instance, 안쪽 ref, …]` 순으로 쌓고 안쪽부터 합친다.
 */
type DescendantPatchOwner<T extends CanonicalRefResolvableNode> = {
  owner: T;
  /** owner 가 바깥 instance 기준 어느 path 에 실체화됐는가 (바깥 instance 자신은 ""). */
  mountPath: string;
};

function relativeDescendantPath(
  path: string,
  mountPath: string,
): string | null {
  if (!mountPath) return path;
  const prefix = `${mountPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

function getStackedDescendantPatch<T extends CanonicalRefResolvableNode>(
  owners: readonly DescendantPatchOwner<T>[],
  path: string,
): Record<string, unknown> | null {
  let merged: Record<string, unknown> | null = null;
  for (let index = owners.length - 1; index >= 0; index -= 1) {
    const { owner, mountPath } = owners[index]!;
    const relative = relativeDescendantPath(path, mountPath);
    if (relative === null) continue;
    const patch = getDescendantPatch(owner, relative);
    if (!patch) continue;
    // ADR-234: patch 끼리 합성 — `null` (삭제 표기) 보존 (리뷰 round 2 h1).
    merged = merged ? composePropsPatches(merged, patch) : patch;
  }
  return merged;
}

function propsFromDescendantPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const {
    children,
    descendants: _descendants,
    id: _id,
    fills: _fills,
    sizing: _sizing,
    responsive: _responsive,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    enabled: _enabled,
    ...props
  } = patch;
  if (isRecord(patch.props)) return patch.props;
  if (children !== undefined && !Array.isArray(children)) {
    props.children = children;
  }
  return props;
}

/** ADR-234 — descendants patch 의 `enabled` 는 노드 필드로 싣는다 (props 아님). */
function patchEnabledField(patch: Record<string, unknown> | null | undefined): {
  enabled?: boolean;
} {
  return patch && typeof patch.enabled === "boolean"
    ? { enabled: patch.enabled }
    : {};
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
    sizing: _sizing,
    responsive: _responsive,
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
    props: applyPropsPatch(getNodeProps(element), patchProps),
    ...mergeFillSizing(element, patch),
    ...(Array.isArray(patch.fills) ? { fills: patch.fills } : {}),
    ...patchEnabledField(patch),
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

    const overrideRef = getCanonicalRefTarget(syntheticChild);
    const lookupOverrideMaster = (target: string) =>
      resolveCanonicalRefMaster(target, resultElementsMap.values());
    const overrideMaster = overrideRef
      ? lookupOverrideMaster(overrideRef)
      : undefined;
    const resolvedChildBase = isCanonicalRefElement(syntheticChild)
      ? resolveCanonicalRefElement(
          syntheticChild,
          resultElementsMap.values(),
          overrideMaster,
        )
      : syntheticChild;
    // ADR-234 Phase 3 — mode C 로 채운 목록 틀의 항목 instance (Slot "+" 가 instance 에 넣은 Tab) 도
    //   실행 중 상태 층 (선택 = 조상 Tabs key). 부모 (synthetic 목록 틀) 는 이미 결과 map 에 있다.
    const overrideStateLayer =
      overrideMaster && resolvedChildBase !== syntheticChild
        ? resolveCanvasStateLayer(
            overrideMaster.id,
            resolvedChildBase,
            resultElementsMap,
            lookupOverrideMaster,
          )
        : null;
    const resolvedChild = withTemplateBindings(
      overrideStateLayer
        ? applyStateLayerToResolved(
            resolvedChildBase,
            overrideStateLayer,
            syntheticChild,
          )
        : resolvedChildBase,
      templateBindings,
    );
    if (resolvedChildBase !== syntheticChild) markResolvedRef(resolvedChild);

    resultElements.push(resolvedChild);
    resultElementsMap.set(syntheticId, resolvedChild);
    syntheticChildren.push(resolvedChild);

    if (overrideRef && overrideMaster) {
      // 중첩 ref 는 자신의 origin propsSchema 기준으로 새 바인딩을 산출한다.
      materializeSyntheticDescendants(
        syntheticChild,
        overrideMaster,
        syntheticId,
        sourceChildrenMap,
        resultElementsMap,
        resultChildrenMap,
        resultElements,
        resolveMasterTemplateBindings(
          overrideMaster,
          getNodeProps(resolvedChild),
        ),
        "",
        new Set(),
        {
          patchOwners: [
            { owner: syntheticChild, mountPath: "" },
            ...stateLayerOwner(syntheticChild, overrideStateLayer),
          ],
        },
      );
      return;
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

type MaterializeContext<T extends CanonicalRefResolvableNode> = {
  /** origin 조회 (ADR-228 G4 — map 우선). 없으면 result map 선형 탐색. */
  lookupMaster?: (ref: string) => T | undefined;
  /** ADR-229 — descendants patch 소유자 스택 (바깥 instance 가 [0]). 없으면 refElement 하나. */
  patchOwners?: readonly DescendantPatchOwner<T>[];
};

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
  context: MaterializeContext<T> = {},
): void {
  if (visitedSourceIds.has(sourceParent.id)) return;

  const nextVisitedSourceIds = new Set(visitedSourceIds);
  nextVisitedSourceIds.add(sourceParent.id);
  const sourceChildren = sourceChildrenMap.get(sourceParent.id) ?? [];
  const syntheticChildren: T[] = [];
  const patchOwners: readonly DescendantPatchOwner<T>[] =
    context.patchOwners ?? [{ owner: refElement, mountPath: "" }];
  const lookupMaster =
    context.lookupMaster ??
    ((ref: string) =>
      resolveCanonicalRefMaster(ref, resultElementsMap.values()));

  sourceChildren.forEach((sourceChild) => {
    // render projection(`projection:` prefix — collection rows/cells/spacer/remainder, page-frame)은
    //   owner 노드에서 파생되는 scene 산출물이지 master 의 저작 자식이 아니다. master 의 projection
    //   을 인스턴스로 복제하면 인스턴스가 자기 props 로 만든 projection 과 **이중**으로 그려진다
    //   (2026-08-26 실측: palette ListBox ref 인스턴스가 origin items 3행을 추가 렌더 — Skia owner
    //   320 = 164 + 156, DOM 164). 인스턴스의 projection 은 scene builder 가 resolved props 로
    //   별도 산출하므로 여기서는 건너뛴다.
    if (isRenderProjectionId(sourceChild.id)) return;
    const segment = getCanonicalRefPathSegment(sourceChild);
    const path = pathPrefix ? `${pathPrefix}/${segment}` : segment;
    const patch = getStackedDescendantPatch(patchOwners, path);
    const syntheticId = `${refElement.id}/${path}`;
    const patchProps = patch ? propsFromDescendantPatch(patch) : {};
    const patchedType =
      patch && typeof patch.type === "string" ? patch.type : sourceChild.type;
    const existingSyntheticChild = resultElementsMap.get(syntheticId);

    // ADR-229 Phase 0 — 조합 origin 의 자식이 다른 origin 의 ref 면 (일반 source-child 경로)
    //   그 origin 을 여기서 해소한다. 종전에는 override.children (mode C) 경로만 nested master
    //   를 해소하고 이 경로는 `type:"ref"` 를 그대로 복제했다 (리뷰 h1 · F5). mode B (patch.type)
    //   교체는 ref 가 아니게 되므로 아래 일반 경로로 둔다. origin 이 없거나 순환이면 (visited)
    //   종전처럼 미해소 복제 — 다음 로드에서 origin 이 생기면 자연히 해소된다.
    //   판정은 `type` 이 아니라 ref 대상의 존재다 — scene 층 (`buildCanvasSceneGraph`, ADR-161)
    //   은 ref 노드의 `type` 을 이미 master type 으로 바꾸고 `.ref` 만 남긴다 (live 실측: type 으로
    //   판정하면 Form instance 안 TextField ref 가 자식 0 인 빈 상자로 그려졌다).
    const sourceChildRef =
      patch && typeof patch.type === "string"
        ? undefined
        : getCanonicalRefTarget(sourceChild);
    const nestedMaster = sourceChildRef
      ? lookupMaster(sourceChildRef)
      : undefined;
    if (
      sourceChildRef &&
      nestedMaster &&
      !existingSyntheticChild &&
      !nextVisitedSourceIds.has(nestedMaster.id)
    ) {
      // nested master props → 조합 자식 patch (자식 ref 자신의 props — 바깥 origin 의 `{키}`
      //   치환은 여기까지) → 바깥 instance patch. 그 다음 nested master 의 자식은 nested master
      //   의 propsSchema 로 재바인딩한다 — 바깥 origin 의 바인딩이 안쪽 placeholder 를 잡으면 안 된다.
      // 자식 ref 자신의 patch + 바깥 patch — 아직 patch 끼리 (nested master 에 적용 전).
      const ownProps = composePropsPatches(
        getNodeProps(sourceChild),
        patchProps,
      );
      const nestedRefNode = {
        ...sourceChild,
        id: syntheticId,
        parentId: syntheticParentId,
        pageId: getPageId(refElement) ?? getPageId(sourceChild),
        layoutId: getLayoutId(refElement) ?? getLayoutId(sourceChild),
        parent_id: syntheticParentId,
        page_id: getPageId(refElement) ?? getPageId(sourceChild),
        layout_id: getLayoutId(refElement) ?? getLayoutId(sourceChild),
        props: templateBindings
          ? substituteTemplateBindingsInProps(ownProps, templateBindings)
          : ownProps,
        ...mergeFillSizing(sourceChild, patch ?? {}),
        ...(patch && Array.isArray(patch.fills) ? { fills: patch.fills } : {}),
        ...patchEnabledField(patch),
        reusable: undefined,
      } as T;
      const resolvedNestedBase = resolveCanonicalRefElement(
        nestedRefNode,
        resultElementsMap.values(),
        nestedMaster,
      );
      // ADR-234 Phase 2 — 조합 origin 안 자식 ref (RadioGroup 안 Radio …) 도 실행 중 상태 층. 부모
      //   (그룹) 는 이미 결과 map 에 있어 그룹 value · disabled 를 읽는다.
      const nestedStateLayer = resolveCanvasStateLayer(
        nestedMaster.id,
        {
          ...resolvedNestedBase,
          parentId: syntheticParentId,
          parent_id: syntheticParentId,
        },
        resultElementsMap,
        lookupMaster,
      );
      const resolvedNested = nestedStateLayer
        ? applyStateLayerToResolved(resolvedNestedBase, nestedStateLayer, {
            // 소유 키 = 자식 ref 자신의 patch + 바깥 instance patch (둘 다 상태 층보다 위).
            props: composePropsPatches(
              getNodeProps(rawRefSource(sourceChild)),
              patchProps,
            ),
            fills:
              patch && Array.isArray(patch.fills)
                ? patch.fills
                : (rawRefSource(sourceChild) as { fills?: unknown }).fills,
            enabled:
              patch && typeof patch.enabled === "boolean"
                ? patch.enabled
                : (rawRefSource(sourceChild) as { enabled?: unknown }).enabled,
          } as unknown as T)
        : resolvedNestedBase;
      const syntheticNested = markResolvedRef({
        ...resolvedNested,
        id: syntheticId,
        parentId: syntheticParentId,
        parent_id: syntheticParentId,
        reusable: undefined,
      } as T);

      resultElements.push(syntheticNested);
      resultElementsMap.set(syntheticId, syntheticNested);
      syntheticChildren.push(syntheticNested);

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
          nestedMaster,
          syntheticId,
          sourceChildrenMap,
          resultElementsMap,
          resultChildrenMap,
          resultElements,
          resolveMasterTemplateBindings(
            nestedMaster,
            getNodeProps(syntheticNested),
          ),
          path,
          nextVisitedSourceIds,
          {
            lookupMaster,
            patchOwners: [
              ...patchOwners,
              { owner: sourceChild, mountPath: path },
              ...stateLayerOwner(sourceChild, nestedStateLayer, path),
            ],
          },
        );
      }
      return;
    }

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
          context,
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
            applyPropsPatch(getNodeProps(sourceChild), patchProps),
            templateBindings,
          )
        : applyPropsPatch(getNodeProps(sourceChild), patchProps),
      ...mergeFillSizing(sourceChild, patch ?? {}),
      ...(patch && Array.isArray(patch.fills) ? { fills: patch.fills } : {}),
      ...patchEnabledField(patch),
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
        context,
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

/**
 * ADR-234 Phase 2 — Canvas 유효 상태 (selected · disabled). hover/pressed/focus 는 Preview 소관
 * (ADR-150 A1 철회 판정) — 변형 노드 자신 (Components 페이지) 만 `metadata.variant` 로 강제한다.
 *
 * - selected: 강제 상태 → (Tab) 조상 Tabs `selectedKey ?? defaultSelectedKey` 와 자기 key
 *   (`resolveStaticItemKey`) 매칭 → 자기 `isSelected` / `_isSelected` → 조상 RadioGroup `value` 매칭.
 * - disabled: 강제 상태 → 자기 `isDisabled` / `disabled` → 조상 그룹의 `isDisabled` (3단계).
 */
const DISABLING_GROUP_TYPES = new Set([
  "RadioGroup",
  "CheckboxGroup",
  "ToggleButtonGroup",
  "TagGroup",
  "Tabs",
  "ListBox",
  "GridList",
]);

function findAncestor<T extends CanonicalRefResolvableNode>(
  element: T,
  elementsMap: Map<string, T>,
  match: (node: T) => boolean,
  maxDepth = 3,
): T | undefined {
  let parentId = getParentId(element);
  for (let depth = 0; parentId && depth < maxDepth; depth += 1) {
    const parent = elementsMap.get(parentId);
    if (!parent) return undefined;
    if (match(parent)) return parent;
    parentId = getParentId(parent);
  }
  return undefined;
}

export function resolveCanvasVariantState<T extends CanonicalRefResolvableNode>(
  element: T,
  elementsMap: Map<string, T>,
): ActiveVariantStates {
  const forced = readForcedVariantStates(element) ?? {};
  const props = getNodeProps(element);
  let selected = forced.selected;
  // ADR-234 Phase 3 — TabList 의 정적 Tab 은 Tabs 의 선택 key 가 정본이다. 항목 origin 은 선택 상태라
  //   `_isSelected: true` 를 갖고 instance 가 그것을 상속하므로 자기 값보다 먼저 본다.
  const tabsOwner =
    selected === undefined && element.type === "Tab"
      ? findAncestor(element, elementsMap, (node) => node.type === "Tabs")
      : undefined;
  if (selected === undefined && tabsOwner) {
    const tabsProps = getNodeProps(tabsOwner);
    const key = tabsProps.selectedKey ?? tabsProps.defaultSelectedKey;
    selected =
      key != null && key === resolveStaticItemKey(props, element.id);
  }
  if (selected === undefined) {
    if (props.isSelected === true || props._isSelected === true) {
      selected = true;
    } else if (element.type === "Radio") {
      const group = findAncestor(
        element,
        elementsMap,
        (node) => node.type === "RadioGroup",
      );
      const groupValue = group ? getNodeProps(group).value : undefined;
      selected =
        typeof groupValue === "string" && groupValue !== ""
          ? groupValue === props.value
          : false;
    } else {
      selected = false;
    }
  }
  const disabled =
    forced.disabled ??
    (props.isDisabled === true ||
      props.disabled === true ||
      Boolean(
        findAncestor(
          element,
          elementsMap,
          (node) =>
            DISABLING_GROUP_TYPES.has(node.type) &&
            getNodeProps(node).isDisabled === true,
        ),
      ));
  return {
    selected,
    disabled,
    ...(forced.hovered ? { hovered: true } : {}),
    ...(forced.pressed ? { pressed: true } : {}),
    ...(forced.focusVisible ? { focusVisible: true } : {}),
  };
}

/** origin 의 상태 변형 층 중 지금 켜진 것의 합성. 변형이 없거나 켜진 층이 없으면 null. */
function resolveCanvasStateLayer<T extends CanonicalRefResolvableNode>(
  originId: string,
  resolved: T,
  elementsMap: Map<string, T>,
  lookupMaster: (ref: string) => T | undefined,
): StateLayer | null {
  const set = buildStateLayerSet(
    originId,
    (id) =>
      lookupMaster(id) as unknown as
        import("@composition/shared").CanonicalNode | undefined,
  );
  if (!set) return null;
  return resolveActiveStateLayer(
    set,
    resolveCanvasVariantState(resolved, elementsMap),
  );
}

/** props patch 중 삭제 표기 (`null`) 만 — top-level · style 한 단계. 없으면 null. */
function deletionOnlyPatch(
  props: Record<string, unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null) out[key] = null;
  }
  if (isRecord(props.style)) {
    const style: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props.style)) {
      if (value === null) style[key] = null;
    }
    if (Object.keys(style).length > 0) out.style = style;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * ADR-234 Phase 3 — scene 노드는 ref 의 props 를 origin 위에 이미 접어 두어 (`resolveSceneRefChain`) ref 자기
 * `null` (삭제 표기) 이 소비된 뒤다. 그 props 를 patch 로 master 에 다시 얹으면 지운 키를 master 값이
 * 되살린다 (휴지 Tab 변형의 `_isSelected: null` → origin 의 true). ref 자기 삭제 표기를 해석 뒤에 한 번 더.
 */
function reapplyOwnDeletions<T extends CanonicalRefResolvableNode>(
  resolved: T,
  ownSource: T,
  input: T,
): T {
  if (resolved === input || ownSource === input) return resolved;
  const deletions = deletionOnlyPatch(getNodeProps(ownSource));
  if (!deletions) return resolved;
  return {
    ...resolved,
    props: applyPropsPatch(getNodeProps(resolved), deletions),
  } as T;
}

/**
 * scene 노드는 ref instance 의 props 를 origin 위에 이미 접어 둔다 (ADR-228 scene merge) — instance 가
 * **직접 저장한** 키를 알려면 원본 canonical 노드 (`sourceNode`) 를 본다. scene 밖 입력은 그 자신.
 */
function rawRefSource<T extends CanonicalRefResolvableNode>(element: T): T {
  const source = (element as { sourceNode?: unknown }).sourceNode as
    T | undefined;
  return source && source.type === "ref" ? source : element;
}

/**
 * 해석이 끝난 instance 에 켜진 상태 층을 얹는다 — instance 자기 patch 키 (`readInstanceOwnedKeys`) 는
 * 층이 건드리지 않는다 (instance 가 최종 층, review round 1 m4). 해석 결과에 scene 층이 실은 값
 * (projection 입력 등) 은 그대로 남는다.
 */
function applyStateLayerToResolved<T extends CanonicalRefResolvableNode>(
  resolved: T,
  layer: StateLayer,
  ownSource: T,
): T {
  const own = readInstanceOwnedKeys(
    ownSource as unknown as import("@composition/shared").CanonicalNode,
  );
  const patch = omitOwnedKeys(layer.props, own);
  const ownEnabled = (ownSource as { enabled?: unknown }).enabled;
  return {
    ...resolved,
    ...(patch ? { props: applyPropsPatch(getNodeProps(resolved), patch) } : {}),
    ...(layer.fills !== undefined && !own.fills ? { fills: layer.fills } : {}),
    ...(layer.enabled !== undefined && typeof ownEnabled !== "boolean"
      ? { enabled: layer.enabled }
      : {}),
  } as T;
}

/** 상태 층의 자손 patch 를 patch 소유자 스택에 넣을 가짜 소유자 (없으면 빈 배열). */
function stateLayerOwner<T extends CanonicalRefResolvableNode>(
  owner: T,
  layer: StateLayer | null,
  mountPath = "",
): DescendantPatchOwner<T>[] {
  if (!layer?.descendants) return [];
  return [
    {
      owner: {
        id: `${owner.id}::state-layer`,
        type: owner.type,
        descendants: layer.descendants,
      } as unknown as T,
      mountPath,
    },
  ];
}

/** ADR-234 — ref 체인 깊이 상한 (Preview resolver `MAX_REF_CHAIN_DEPTH` 와 같은 값). */
const MAX_REF_ELEMENT_CHAIN_DEPTH = 8;

/**
 * ADR-234 Phase 1 — master 에서 체인 끝 origin 까지.
 * - `origin`: 체인 끝 (ref 아님) — 자식 · propsSchema 출처
 * - `intermediates`: [직접 master, …, origin 바로 앞] — descendants patch 소유자 (바깥 → 안쪽)
 * - `effectiveMaster`: 직접 master 를 체인 위에 접은 요소 (root props · type 출처). 체인이 없으면
 *   직접 master 그대로.
 * 순환 · 깊이 초과 · 끊긴 체인은 null.
 */
function resolveRefElementChain<T extends CanonicalRefResolvableNode>(
  directMaster: T,
  nodes: Iterable<T>,
  lookupMaster: (ref: string) => T | undefined,
): { origin: T; intermediates: T[]; effectiveMaster: T } | null {
  const intermediates: T[] = [];
  const seen = new Set<string>();
  let current: T | undefined = directMaster;
  while (current && isCanonicalRefElement(current)) {
    if (seen.has(current.id) || seen.size >= MAX_REF_ELEMENT_CHAIN_DEPTH) {
      return null;
    }
    seen.add(current.id);
    intermediates.push(current);
    const next: string | null = getCanonicalRefTarget(current);
    current = next ? lookupMaster(next) : undefined;
  }
  if (!current) return null;
  const origin = current;
  let effective: T = origin;
  for (let index = intermediates.length - 1; index >= 0; index -= 1) {
    effective = resolveCanonicalRefElement(
      intermediates[index]!,
      nodes,
      effective,
    );
  }
  return { origin, intermediates, effectiveMaster: effective };
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

  // ADR-228 G4: 팔레트 배치가 전부 ref 라 instance 수 × 노드 수의 선형 탐색이 O(n²) 였다
  //   (600 instance × 850 노드 × 3 pass — page-switch p95 +4 ms 실측). origin 은 id 로 참조되므로
  //   map 조회를 먼저 하고, legacy 참조 (customId · name) 만 선형 탐색으로 떨어진다. 같은 origin
  //   은 한 번만 찾는다.
  const masterCache = new Map<string, T | undefined>();
  const lookupMaster = (ref: string): T | undefined => {
    if (masterCache.has(ref)) return masterCache.get(ref);
    const master =
      input.elementsMap.get(ref) ??
      resolveCanonicalRefMaster(ref, input.elementsMap.values());
    masterCache.set(ref, master);
    return master;
  };
  const indexById = new Map<string, number>();
  elements.forEach((candidate, index) => indexById.set(candidate.id, index));

  for (const element of input.elements) {
    if (!isCanonicalRefElement(element)) continue;
    const ref = getCanonicalRefTarget(element);
    const directMaster = ref ? lookupMaster(ref) : undefined;
    // ADR-234 Phase 1 — master 가 다시 ref (변형) 면 체인을 따라간다: root props 는 접힌 체인 master
    //   위에, 자식은 체인 끝 origin 의 자식을 [instance, 변형, …] patch 스택으로 실체화한다.
    const chain = directMaster
      ? resolveRefElementChain(
          directMaster,
          input.elementsMap.values(),
          lookupMaster,
        )
      : null;
    if (directMaster && !chain) continue; // 순환 · 깊이 초과 · 끊긴 체인 = broken ref
    const master = chain?.effectiveMaster;
    const resolvedRootBase = reapplyOwnDeletions(
      resolveCanonicalRefElement(element, input.elementsMap.values(), master),
      rawRefSource(element),
      element,
    );
    // ADR-234 Phase 2 — 실행 중 상태 층 (selected · disabled). instance 자기 patch 가 마지막에 이기도록
    //   층을 master 에 얹은 뒤 instance 를 다시 연다. 자손 층은 patch 소유자 스택 (instance 다음).
    const stateLayer =
      chain && master && resolvedRootBase !== element
        ? resolveCanvasStateLayer(
            chain.origin.id,
            resolvedRootBase,
            elementsMap,
            lookupMaster,
          )
        : null;
    const resolvedRoot = stateLayer
      ? applyStateLayerToResolved(
          resolvedRootBase,
          stateLayer,
          rawRefSource(element),
        )
      : resolvedRootBase;
    if (resolvedRoot !== element) {
      markResolvedRef(resolvedRoot);
      elementsMap.set(element.id, resolvedRoot);
      const index = indexById.get(element.id) ?? -1;
      if (index >= 0) elements[index] = resolvedRoot;
      // ADR-234 Phase 3 — 부모의 자식 목록도 같은 객체로 (scene `sceneChildrenByParent` 를 읽는
      //   소비자가 해석 전 props — 상태 층 전 — 를 보지 않게).
      const parentId = getParentId(element);
      const siblings = parentId ? childrenMap.get(parentId) : undefined;
      const siblingIndex = siblings?.indexOf(element) ?? -1;
      if (siblings && siblingIndex >= 0) {
        const nextSiblings = [...siblings];
        nextSiblings[siblingIndex] = resolvedRoot;
        childrenMap.set(parentId!, nextSiblings);
      }
    }

    if (!ref || !chain) continue;

    materializeSyntheticDescendants(
      element,
      chain.origin,
      element.id,
      sourceChildrenMap,
      elementsMap,
      childrenMap,
      elements,
      // ADR-148 Phase 2 — origin 이 propsSchema 를 선언한 reusable 에 한해 `{키}` 치환.
      resolveMasterTemplateBindings(chain.origin, getNodeProps(resolvedRoot)),
      "",
      new Set(),
      {
        lookupMaster,
        patchOwners: [
          { owner: element, mountPath: "" },
          ...stateLayerOwner(element, stateLayer),
          ...chain.intermediates.map((owner) => ({ owner, mountPath: "" })),
        ],
      },
    );
  }

  return { childrenMap, elements, elementsMap };
}
