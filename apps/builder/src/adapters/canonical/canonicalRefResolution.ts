import {
  mergeFillSizing,
  readPropsSchema,
  isBoundListOwnerProps,
  SECTION_TYPES,
  resolveSectionItemKey,
  STATIC_LIST_FAMILY_BY_OWNER,
  resolveTemplateBindingValues,
  substituteTemplateBindingsInChildren,
  substituteTemplateBindingsInProps,
  resolveGroupExpandedDisclosureIds,
  hasStateTemplateSyntax,
} from "@composition/shared";

import { applyPropsPatch, composePropsPatches } from "./instanceResolver";
import {
  buildReferenceIndex,
  resolveReference,
} from "../../utils/component/referenceResolution";
import type { LegacyElementMirrorFields } from "./legacyElementFields";
import { isRenderProjectionId } from "../../builder/projection/renderProjectionIds";
import { createPopoverChildFilter } from "./popoverContent";
import {
  buildStateLayerSet,
  omitOwnedKeys,
  readForcedVariantStates,
  readInstanceOwnedKeys,
  resolveActiveStateLayer,
  STATE_LAYER_ORDER,
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
    ...(master.sizing || master.responsive || node.sizing || node.responsive
      ? mergeFillSizing(master, node)
      : {}),
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

const withoutVariantMarksCache = new WeakMap<object, object>();

/** 결과는 metadata 객체마다 공유 (ADR-234 G4 — 선택 상태 origin 의 instance 마다 새로 만들었다). */
function withoutVariantMarks(
  metadata: NonNullable<CanonicalRefResolvableNode["metadata"]>,
): CanonicalRefResolvableNode["metadata"] {
  const hit = withoutVariantMarksCache.get(metadata);
  if (hit) return hit as CanonicalRefResolvableNode["metadata"];
  const { variant: _variant, variantOf: _variantOf, ...rest } = metadata;
  withoutVariantMarksCache.set(metadata, rest);
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

/**
 * ADR-234 G4 — ref instance 하나의 해석 결과 (재사용 단위): 해석된 root · 이 instance 가 더한 synthetic
 * 노드 (추가 순서) · 자식 목록 (`null` 자리 = 그 instance 자기 자식 — 재사용 때 지금 목록에서 채운다).
 */
export interface RefInstanceResolution<T extends CanonicalRefResolvableNode> {
  root: T;
  appended: readonly T[];
  childLists: ReadonlyArray<readonly [string, ReadonlyArray<T | null>]>;
}

/**
 * ADR-234 G4 — 연속 해석의 instance 결과 재사용. 호출자는 **입력이 같을 때만** (같은 canonical 문서 · 같은
 * scene 옵션 — breakpoint · collection window 처럼 projection 노드만 바꾸는 입력 제외) `previous` 를 넘긴다.
 * 이번 호출의 결과는 `next` 에 적는다.
 */
export interface CanonicalRefTreeReuse<T extends CanonicalRefResolvableNode> {
  previous: ReadonlyMap<string, RefInstanceResolution<T>> | null;
  next: Map<string, RefInstanceResolution<T>>;
  /**
   * ADR-237 G4 — 문서가 바뀌어도 쓰는 leaf instance 재사용 (자기 · 조상 3 · origin 체인 · 상태 변형의 canonical
   * 노드가 같으면 이전 해석 결과). 호출자는 scene 옵션 (collections · 프로젝트 변수 · breakpoint) 이 같을 때만
   * `leafPrevious` 를 넘긴다.
   */
  leafPrevious?: ReadonlyMap<string, LeafRefResolution<T>> | null;
  leafNext?: Map<string, LeafRefResolution<T>>;
}

/**
 * ADR-237 G4 — 자기 자식 없는 ref instance 하나의 해석 결과 + 그 결과가 읽은 canonical 노드 (동일성 비교).
 * ADR-238 G4 — origin 자식이 있는 instance (항목 origin 의 Label · Icon …) 도: 합성 자손 기록 (`record`) 을 함께
 * 두고 재사용 때 다시 싣는다.
 */
export interface LeafRefResolution<T extends CanonicalRefResolvableNode> {
  root: T;
  deps: readonly unknown[];
  record?: RefInstanceResolution<T> | null;
}

/** scene 노드면 원본 canonical 노드 (편집 안 된 부분은 문서가 바뀌어도 같은 객체), 아니면 자기. */
function canonicalIdentity(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  return (node as { sourceNode?: unknown }).sourceNode ?? node;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** 바인딩 목록 (행 = projection) 이 있는 결과는 재사용하지 않는다 — 해석 뒤 projection 단계가 synthetic
 *  목록 틀 props 를 제자리에 채우고, 그 값은 breakpoint 에 따라 바뀐다. */
function hasCollectionData<T extends CanonicalRefResolvableNode>(
  node: T,
): boolean {
  const props = node.props;
  if (!props) return false;
  return (
    props.items !== undefined ||
    props.dataBinding !== undefined ||
    props.columnMapping !== undefined ||
    isBoundListOwnerProps(props)
  );
}

function recordRefInstanceResolution<T extends CanonicalRefResolvableNode>(
  element: T,
  startLength: number,
  elementsMap: Map<string, T>,
  childrenMap: Map<string, T[]>,
  elements: T[],
): RefInstanceResolution<T> | null {
  const root = elementsMap.get(element.id);
  if (!root || root === element || hasCollectionData(root)) return null;
  const appended = elements.slice(startLength);
  if (appended.some(hasCollectionData)) return null;
  const prefix = `${element.id}/`;
  const childLists: Array<readonly [string, ReadonlyArray<T | null>]> = [];
  for (const id of [element.id, ...appended.map((node) => node.id)]) {
    const list = childrenMap.get(id);
    if (!list) continue;
    childLists.push([
      id,
      list.map((child) => (child.id.startsWith(prefix) ? child : null)),
    ]);
  }
  return { root, appended, childLists };
}

function replayRefInstanceResolution<T extends CanonicalRefResolvableNode>(
  record: RefInstanceResolution<T>,
  elementsMap: Map<string, T>,
  childrenMap: Map<string, T[]>,
  elements: T[],
): void {
  for (const node of record.appended) {
    elements.push(node);
    elementsMap.set(node.id, node);
  }
  for (const [id, pattern] of record.childLists) {
    const own = (childrenMap.get(id) ?? []).filter(
      (child) => !pattern.includes(child),
    );
    let ownIndex = 0;
    const next: T[] = [];
    for (const slot of pattern) {
      if (slot) next.push(slot);
      else if (ownIndex < own.length) next.push(own[ownIndex++]!);
    }
    while (ownIndex < own.length) next.push(own[ownIndex++]!);
    childrenMap.set(id, next);
  }
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

const patchPropsCache = new WeakMap<object, Record<string, unknown>>();

/** descendants patch → props patch. 결과는 patch 객체마다 공유 (불변 입력 — ADR-234 G4: 정적 목록 항목의
 *  label patch 를 build 마다 다시 분해했다). 호출자는 결과를 고치지 않는다. */
function propsFromDescendantPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const hit = patchPropsCache.get(patch);
  if (hit) return hit;
  const props = computePropsFromDescendantPatch(patch);
  patchPropsCache.set(patch, props);
  return props;
}

function computePropsFromDescendantPatch(
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
  lookupResult?: (ref: string) => T | undefined,
): void {
  const syntheticChildren: T[] = [];
  // 결과 map 조회 — 해석 호출 단위 조회가 오면 그것 (id 우선 · legacy 색인), 없으면 선형 탐색 (종전).
  const lookupOverrideMaster =
    lookupResult ??
    ((target: string) =>
      resolveCanonicalRefMaster(target, resultElementsMap.values()));

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
          lookupResult,
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
      // scene 문맥 (ref 가 scene 노드) 이면 mode C 자식도 원본 canonical 노드를 `sourceNode` 로 — Skia 입력
      //   (`rendererInput` projection index) 이 모든 scene 노드의 sourceNode 를 읽는다 (ADR-234 live: 정적 목록
      //   instance 의 Slot "+" 항목에서 `sourceNode.id` undefined 로 캔버스가 멈췄다).
      ...((refElement as { sourceNode?: unknown }).sourceNode
        ? { sourceNode: child }
        : {}),
    } as T;

    const overrideRef = getCanonicalRefTarget(syntheticChild);
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
      withItemSelectionFlag(
        overrideStateLayer
          ? applyStateLayerToResolved(
              resolvedChildBase,
              overrideStateLayer,
              syntheticChild,
            )
          : resolvedChildBase,
        resolvedChildBase,
        resultElementsMap,
      ),
      templateBindings,
    );
    if (resolvedChildBase !== syntheticChild) {
      markResolvedRef(resolvedChild);
      registerStateOwnSource(resolvedChild, syntheticChild);
    }

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
          ...(lookupResult ? { lookupMaster: lookupResult, lookupResult } : {}),
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
        lookupResult,
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
  /** ADR-234 G4 — 결과 map 조회 (mode C 자식의 origin · 상태 층). 없으면 결과 map 선형 탐색. */
  lookupResult?: (ref: string) => T | undefined;
  /** ADR-238 G4 — instance 직계 합성 자식 필터 (`false` = 실체화하지 않는다 · popover 내용). */
  keepChild?: (sourceChild: T, patchProps: Record<string, unknown>) => boolean;
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
  const sourceChildren = sourceChildrenMap.get(sourceParent.id);
  // 자식 없는 source (leaf label 등) — 할 일 없음 (ADR-234 G4: 항목마다 방문 집합을 복제했다).
  if (!sourceChildren || sourceChildren.length === 0) return;

  const nextVisitedSourceIds = new Set(visitedSourceIds);
  nextVisitedSourceIds.add(sourceParent.id);
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
    if (
      pathPrefix === "" &&
      context.keepChild &&
      !context.keepChild(sourceChild, patchProps)
    ) {
      return;
    }
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
      const nestedStateInput = {
        ...resolvedNestedBase,
        parentId: syntheticParentId,
        parent_id: syntheticParentId,
      } as T;
      const nestedStateLayer = resolveCanvasStateLayer(
        nestedMaster.id,
        nestedStateInput,
        resultElementsMap,
        lookupMaster,
      );
      const nestedOwnSource = {
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
      } as unknown as T;
      const resolvedNestedLayered = nestedStateLayer
        ? applyStateLayerToResolved(
            resolvedNestedBase,
            nestedStateLayer,
            nestedOwnSource,
          )
        : resolvedNestedBase;
      const resolvedNested = withItemSelectionFlag(
        resolvedNestedLayered,
        nestedStateInput,
        resultElementsMap,
      );
      const syntheticNested = registerStateOwnSource(
        markResolvedRef({
          ...resolvedNested,
          id: syntheticId,
          parentId: syntheticParentId,
          parent_id: syntheticParentId,
          reusable: undefined,
        } as T),
        nestedOwnSource,
      );

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
          context.lookupResult,
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
            lookupResult: context.lookupResult,
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
          context.lookupResult,
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

    // ADR-234 G4 — 유효 `enabled: false` 인 자식은 만들지 않는다 (scene 이 해석 뒤 subtree 째 빼는 노드 —
    //   `pruneDisabledSceneNodes`). 정적 Tag instance 500 개가 숨긴 Icon · Avatar 1,000 개를 만들고 버렸다.
    const effectiveEnabled =
      patch && typeof patch.enabled === "boolean"
        ? patch.enabled
        : (sourceChild as { enabled?: unknown }).enabled;
    if (effectiveEnabled === false) return;

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
        context.lookupResult,
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
    // origin 자식 → instance 자기 자식 순 (Preview resolver `[...origin, ...instance]` 와 같은 순서 —
    //   ADR-234 3d: ListBox instance "+" 항목은 origin 항목 뒤).
    resultChildrenMap.set(syntheticParentId, [
      ...syntheticChildren,
      ...preservedChildren,
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

/** ADR-234 Phase 3 — 정적 목록 항목 type → 선택을 소유한 조상 type. */
const ITEM_SELECTION_OWNER: Readonly<Record<string, string>> = {
  Tab: "Tabs",
  Tag: "TagGroup",
  ListBoxItem: "ListBox",
  GridListItem: "GridList",
};

/** owner 의 선택 key (`selectedKey ?? defaultSelectedKey` · `selectedKeys ?? defaultSelectedKeys`) 에 key 가 있나. */
function isOwnerSelectedKey(
  ownerProps: Record<string, unknown>,
  key: string,
): boolean {
  const keys = ownerProps.selectedKeys ?? ownerProps.defaultSelectedKeys;
  if (Array.isArray(keys)) return keys.map(String).includes(key);
  if (keys === "all") return true;
  const single = ownerProps.selectedKey ?? ownerProps.defaultSelectedKey;
  return single != null && String(single) === key;
}

export function resolveCanvasVariantState<T extends CanonicalRefResolvableNode>(
  element: T,
  elementsMap: Map<string, T>,
): ActiveVariantStates {
  const forced = readForcedVariantStates(element) ?? {};
  const props = getNodeProps(element);
  let selected = forced.selected;
  // ADR-234 Phase 3 — 정적 목록 항목 (TabList 의 Tab · TagList 의 Tag) 은 owner 의 선택 key 가 정본이다.
  //   항목 origin 은 선택 상태라 `_isSelected: true` 를 갖고 instance 가 그것을 상속하므로 자기 값보다
  //   먼저 본다.
  const ownerType =
    selected === undefined ? ITEM_SELECTION_OWNER[element.type] : undefined;
  const selectionOwner = ownerType
    ? findAncestor(element, elementsMap, (node) => node.type === ownerType)
    : undefined;
  if (selected === undefined && selectionOwner) {
    // ADR-238 Phase 2 — section 안 항목: section instance 가 상속한 항목은 section key 접두 (Preview RAC key 와 같은 함수).
    const parentId = getParentId(element);
    const parent = parentId ? elementsMap.get(parentId) : undefined;
    const section =
      parent && SECTION_TYPES.has(parent.type)
        ? {
            id: parent.id,
            props: getNodeProps(parent),
            ref: (parent as { ref?: unknown }).ref,
          }
        : null;
    selected = isOwnerSelectedKey(
      getNodeProps(selectionOwner),
      resolveSectionItemKey(props, element.id, section),
    );
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
  // ADR-237 Phase 2 · 3 — 위치에 따른 상태 (그룹 단일 펼침 · Breadcrumbs 마지막 = 현재) 는 형제가 다 모인 뒤에만
  //   알 수 있다 (합성 자식은 순서대로 결과 map 에 들어간다). 여기서는 강제 (Components 변형) · 자기 의도
  //   (`isExpanded` 부재 = 펼침) 만 — 위치 상태는 해석 끝 `applyPositionalStateLayers` 가 최종 자식 목록으로 얹는다.
  const expanded =
    forced.expanded ??
    (element.type === "Disclosure" ? props.isExpanded !== false : undefined);
  const current = forced.current === true;
  return {
    selected,
    disabled,
    ...(forced.hovered ? { hovered: true } : {}),
    ...(forced.pressed ? { pressed: true } : {}),
    ...(forced.focusVisible ? { focusVisible: true } : {}),
    ...(expanded !== undefined ? { expanded } : {}),
    ...(current ? { current: true } : {}),
  };
}

/**
 * ADR-237 G4 — leaf ref instance 의 해석이 읽는 canonical 노드 목록 (동일성 비교 키). leaf 가 아니면 (자기 자식 ·
 * origin 자식 · 끊긴 체인) null. 읽는 것: 자기 · origin 체인 (변형 포함) · 체인 끝 origin 의 상태 변형 · 조상 3
 * (선택 owner · RadioGroup value · disabled 그룹 · 위치 상태 부모 — `resolveCanvasVariantState` 의 조상 범위).
 */
function readLeafDeps<T extends CanonicalRefResolvableNode>(
  element: T,
  elementsMap: Map<string, T>,
  sourceChildrenMap: Map<string, T[]>,
  lookupMaster: (ref: string) => T | undefined,
  chainDepsByRef: Map<string, readonly unknown[] | null>,
): unknown[] | null {
  if ((sourceChildrenMap.get(element.id)?.length ?? 0) > 0) return null;
  // `{{ }}` 템플릿 (ADR-214) 을 쓰는 노드는 scene 층이 조상 상태 정의로 props 를 해석한다 — 재사용 대상 밖.
  if ((element as { stateDeps?: unknown }).stateDeps) return null;
  const ref = getCanonicalRefTarget(element);
  if (!ref) return null;
  // 체인 (origin 까지) · origin 의 상태 변형 의존은 ref 대상마다 한 번 — 같은 origin 을 가리키는 항목 수백 개가
  //   같은 조회를 반복했다. leaf 가 아닌 체인 (origin 자식 있음 · 끊김) 은 null 로 기억한다.
  let chainDeps = chainDepsByRef.get(ref);
  if (chainDeps === undefined) {
    chainDeps = readChainLeafDeps(ref, sourceChildrenMap, lookupMaster);
    chainDepsByRef.set(ref, chainDeps);
  }
  if (!chainDeps) return null;
  const ownProps = (canonicalIdentity(element) as { props?: unknown })?.props;
  if (ownProps && hasStateTemplateSyntax(ownProps as Record<string, unknown>)) {
    return null;
  }
  const deps: unknown[] = [canonicalIdentity(element), ...chainDeps];
  // 조상: 상태 해석이 값을 읽는 type (선택 owner · RadioGroup · disabled 그룹) 만 노드 동일성, 나머지는 id · type
  //   (편집 경로의 body · page 가 바뀌어도 무효화하지 않는다 — 위치 상태는 해석 뒤 후처리가 따로 본다).
  let parentId = getParentId(element);
  for (let depth = 0; depth < 3; depth += 1) {
    const parent = parentId ? elementsMap.get(parentId) : undefined;
    if (!parent) {
      deps.push(null);
      break;
    }
    deps.push(
      STATE_ANCESTOR_TYPES.has(parent.type)
        ? canonicalIdentity(parent)
        : `${parent.id}\u0000${parent.type}`,
    );
    parentId = getParentId(parent);
  }
  return deps;
}

function readChainLeafDeps<T extends CanonicalRefResolvableNode>(
  ref: string,
  sourceChildrenMap: Map<string, T[]>,
  lookupMaster: (ref: string) => T | undefined,
): readonly unknown[] | null {
  const deps: unknown[] = [];
  let current: T | undefined;
  let next: string | null = ref;
  for (let depth = 0; next && depth < 8; depth += 1) {
    current = lookupMaster(next);
    if (!current) return null;
    deps.push(canonicalIdentity(current));
    next = isCanonicalRefElement(current) ? getCanonicalRefTarget(current) : null;
  }
  if (!current || isCanonicalRefElement(current)) return null;
  const origin = current;
  // ADR-238 G4 — origin 자식이 있어도 그 subtree 에 ref · `{{ }}` 템플릿이 없으면 재사용한다: origin canonical
  //   노드는 불변 트리라 자손이 바뀌면 동일성이 바뀐다 (deps 의 origin 항목). ref 가 있으면 다른 origin 을 읽는다.
  const originNode = canonicalIdentity(origin) as
    | { children?: unknown[] }
    | undefined;
  if (
    !originSubtreeReusable(
      originNode?.children,
      sourceChildrenMap.get(origin.id),
    )
  ) {
    return null;
  }
  for (const name of STATE_LAYER_ORDER) {
    deps.push(canonicalIdentity(lookupMaster(`${origin.id}--${name}`)));
  }
  return deps;
}

/** `resolveCanvasVariantState` · `withItemSelectionFlag` 가 조상에서 값을 읽는 type. */
const STATE_ANCESTOR_TYPES: ReadonlySet<string> = new Set([
  ...DISABLING_GROUP_TYPES,
  ...Object.values(ITEM_SELECTION_OWNER),
  "RadioGroup",
  // ADR-238 — section 안 항목의 key · 선택은 section `props.id` 를 읽는다.
  ...SECTION_TYPES,
]);

/**
 * origin 자식 subtree 가 재사용 가능한가 — ref 노드 (다른 origin 을 읽는다) · `{{ }}` 템플릿 (scene 층이 조상
 * 상태로 해석) 이 없어야 한다. canonical 자식 (있으면) 과 평탄 자식 (canonical 이 없는 입력) 을 본다.
 */
function originSubtreeReusable(
  canonicalChildren: unknown[] | undefined,
  flatChildren: readonly unknown[] | undefined,
): boolean {
  const stack: unknown[] = [
    ...(Array.isArray(canonicalChildren) ? canonicalChildren : []),
  ];
  if (!Array.isArray(canonicalChildren) && (flatChildren?.length ?? 0) > 0) {
    return false; // 평탄 입력은 subtree 동일성을 보증하지 못한다 — 재사용하지 않는다.
  }
  while (stack.length > 0) {
    const node = stack.pop() as
      | { type?: unknown; ref?: unknown; props?: unknown; children?: unknown }
      | undefined;
    if (!node || typeof node !== "object") continue;
    if (node.type === "ref" || typeof node.ref === "string") return false;
    if (
      node.props &&
      typeof node.props === "object" &&
      hasStateTemplateSyntax(node.props as Record<string, unknown>)
    ) {
      return false;
    }
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return true;
}

/**
 * ADR-237 — 상태 층을 얹은 해석 결과 → 그 instance 의 자기 patch 원천 (`applyStateLayerToResolved` 의 ownSource).
 * 위치 상태 후처리가 같은 소유 키로 층을 다시 얹는다. 결과 객체는 재사용 기록 (`reuse`) 으로 다음 build 에도
 * 그대로 돌아오므로 모듈 수명 WeakMap.
 */
const stateOwnSourceByResolved = new WeakMap<object, object>();

/** 위치 상태 후처리 대상 type — 그 밖의 해석 결과는 기록하지 않는다 (정적 목록 항목 500 개 · G4). */
const POSITIONAL_STATE_TYPES: ReadonlySet<string> = new Set([
  "Disclosure",
  "Breadcrumb",
]);

function registerStateOwnSource<T extends object>(resolved: T, own: object): T {
  if (POSITIONAL_STATE_TYPES.has((resolved as { type?: string }).type ?? "")) {
    stateOwnSourceByResolved.set(resolved, own);
  }
  return resolved;
}

/**
 * ADR-237 Phase 2 · 3 — 위치에 따른 상태 층 (형제가 다 모인 최종 자식 목록 기준):
 * - DisclosureGroup `allowsMultipleExpanded:false` 에서 첫 후보가 아닌 Disclosure → 접힘 (RAC 그룹 상태머신 ·
 *   layout · chevron 과 같은 SSOT `resolveGroupExpandedDisclosureIds`).
 * - Breadcrumbs 의 마지막 Breadcrumb → 현재 (RAC 위치 규칙 · paint `resolveBreadcrumbItemContext` 와 같다).
 * 켜진 층 전체를 다시 합성해 해석 결과 위에 얹는다 — 이미 얹힌 층은 같은 값이라 그대로, 위치 층만 더해진다.
 * 결과는 새 객체로 교체한다 (재사용 기록의 객체는 고치지 않는다 — 다음 build 에서 위치가 바뀌면 다시 계산).
 */
function applyPositionalStateLayers<T extends CanonicalRefResolvableNode>(
  elements: T[],
  elementsMap: Map<string, T>,
  childrenMap: Map<string, T[]>,
  lookupMaster: (ref: string) => T | undefined,
): void {
  let elementIndex: Map<string, number> | null = null;
  const replace = (parentId: string, index: number, next: T) => {
    const kids = [...childrenMap.get(parentId)!];
    const previous = kids[index]!;
    kids[index] = next;
    childrenMap.set(parentId, kids);
    elementsMap.set(next.id, next);
    elementIndex ??= new Map(elements.map((node, i) => [node.id, i]));
    const at = elementIndex.get(previous.id);
    if (at !== undefined) elements[at] = next;
  };
  const relayer = (
    parentId: string,
    index: number,
    extra: Partial<ActiveVariantStates>,
  ) => {
    const kid = childrenMap.get(parentId)![index]!;
    const node = elementsMap.get(kid.id) ?? kid;
    if (!isResolvedRefNode(node)) return;
    let origin: T | undefined = node;
    for (let depth = 0; depth < 8; depth += 1) {
      const ref = (origin as { ref?: unknown }).ref;
      if (typeof ref !== "string") break;
      const next = lookupMaster(ref);
      if (!next) break;
      origin = next;
      if (origin.type !== "ref") break;
    }
    if (!origin || origin === node || origin.type === "ref") return;
    const set = cachedStateLayerSet(origin.id, lookupMaster);
    if (!set) return;
    const layer = resolveActiveStateLayer(set, {
      ...resolveCanvasVariantState(node, elementsMap),
      ...extra,
    });
    if (!layer) return;
    const own = (stateOwnSourceByResolved.get(node) ?? rawRefSource(node)) as T;
    const next = markResolvedRef(applyStateLayerToResolved(node, layer, own));
    registerStateOwnSource(next, own);
    replace(parentId, index, next);
  };
  for (const [parentId, kids] of childrenMap) {
    const parent = elementsMap.get(parentId);
    if (parent?.type === "DisclosureGroup") {
      const current = kids.map((kid) => elementsMap.get(kid.id) ?? kid);
      const expandedIds = resolveGroupExpandedDisclosureIds(
        getNodeProps(parent),
        current.map((node) => ({
          id: node.id,
          type: node.type,
          props: getNodeProps(node),
        })),
      );
      current.forEach((node, index) => {
        if (
          node.type === "Disclosure" &&
          getNodeProps(node).isExpanded !== false &&
          !expandedIds.has(node.id)
        ) {
          relayer(parentId, index, { expanded: false });
        }
      });
    } else if (parent?.type === "Breadcrumbs") {
      let last = -1;
      kids.forEach((kid, index) => {
        if ((elementsMap.get(kid.id) ?? kid).type === "Breadcrumb")
          last = index;
      });
      if (last >= 0) relayer(parentId, last, { current: true });
    }
  }
}

/**
 * ADR-234 G4 — origin 의 상태 층 집합은 한 번의 해석 안에서 같다. 해석 호출마다 새로 만드는 `lookupMaster`
 * 를 키로 호출 단위 캐시 (정적 목록 항목 instance 500 개가 같은 origin 을 가리키면 집합을 500 번 만들었다).
 */
const stateLayerSetCache = new WeakMap<
  (ref: string) => unknown,
  Map<string, ReturnType<typeof buildStateLayerSet>>
>();

function cachedStateLayerSet<T extends CanonicalRefResolvableNode>(
  originId: string,
  lookupMaster: (ref: string) => T | undefined,
): ReturnType<typeof buildStateLayerSet> {
  let byOrigin = stateLayerSetCache.get(lookupMaster);
  if (!byOrigin) {
    byOrigin = new Map();
    stateLayerSetCache.set(lookupMaster, byOrigin);
  }
  if (byOrigin.has(originId)) return byOrigin.get(originId)!;
  const set = buildStateLayerSet(
    originId,
    (id) =>
      lookupMaster(id) as unknown as
        import("@composition/shared").CanonicalNode | undefined,
  );
  byOrigin.set(originId, set);
  return set;
}

/** origin 의 상태 변형 층 중 지금 켜진 것의 합성. 변형이 없거나 켜진 층이 없으면 null. */
function resolveCanvasStateLayer<T extends CanonicalRefResolvableNode>(
  originId: string,
  resolved: T,
  elementsMap: Map<string, T>,
  lookupMaster: (ref: string) => T | undefined,
): StateLayer | null {
  const set = cachedStateLayerSet(originId, lookupMaster);
  if (!set) return null;
  return resolveActiveStateLayer(
    set,
    resolveCanvasVariantState(resolved, elementsMap),
  );
}

/**
 * ADR-234 Phase 3 — 선택 표시를 `isSelected` 로 그리는 목록 항목 (Skia `listbox_item` · `gridlist_card` shell —
 * projection 행이 싣던 값). owner (ListBox · GridList) 안의 정적 항목에만 owner key 로 싣는다.
 */
const SELECTION_FLAG_ITEM_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "GridListItem",
]);

function withItemSelectionFlag<T extends CanonicalRefResolvableNode>(
  resolved: T,
  stateInput: T,
  elementsMap: Map<string, T>,
): T {
  if (!SELECTION_FLAG_ITEM_TYPES.has(resolved.type)) return resolved;
  const ownerType = ITEM_SELECTION_OWNER[resolved.type];
  if (
    !ownerType ||
    !findAncestor(stateInput, elementsMap, (node) => node.type === ownerType)
  ) {
    return resolved;
  }
  const selected =
    resolveCanvasVariantState(stateInput, elementsMap).selected === true;
  const props = getNodeProps(resolved);
  if ((props.isSelected === true) === selected) return resolved;
  return { ...resolved, props: { ...props, isSelected: selected } } as T;
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
  reuse?: CanonicalRefTreeReuse<T>;
  /**
   * ADR-238 G4 — instance 실체화에서 popover 내용 (Select · ComboBox 의 선택 안 된 항목 · Menu 항목) 을 건너뛴다.
   * scene build 만 켠다 (Canvas 는 트리거만 그린다 — `popoverContent.ts`).
   */
  prunePopoverContent?: boolean;
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
  //   ADR-234 G4 — legacy 참조 폴백도 호출 단위 색인 하나 (상태 층 집합이 없는 변형 id 를 origin 마다 최대
  //   6 번 묻는데, 매번 문서 전체를 훑어 항목 수 × 문서 크기로 늘었다).
  let referenceIndex: Map<string, T> | null = null;
  const lookupMaster = (ref: string): T | undefined => {
    const direct = input.elementsMap.get(ref);
    if (direct) return direct;
    referenceIndex ??= buildReferenceIndex(input.elementsMap.values());
    return referenceIndex.get(ref);
  };
  // 결과 map 조회 (mode C 자식 — 종전 결과 map 선형 탐색과 같은 대상, id 우선). 색인은 id 만 싣고 값은
  //   지금 결과 map 에서 — 해석으로 바뀐 노드를 읽는다.
  let resultIndex: Map<string, T> | null = null;
  const lookupResult = (ref: string): T | undefined => {
    const direct = elementsMap.get(ref);
    if (direct) return direct;
    resultIndex ??= buildReferenceIndex(elementsMap.values());
    const id = resultIndex.get(ref)?.id;
    return id ? elementsMap.get(id) : undefined;
  };
  const indexById = new Map<string, number>();
  elements.forEach((candidate, index) => indexById.set(candidate.id, index));
  const replaceResolvedRoot = (element: T, resolvedRoot: T) => {
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
  };

  // ADR-237 — 자기 자식이 있는 instance (합성 자식이 배열 끝에 붙어 형제 순서가 어긋나는 부모).
  const mixedChildParents = new Set<string>();
  const chainDepsByRef = new Map<string, readonly unknown[] | null>();
  for (const element of input.elements) {
    if (!isCanonicalRefElement(element)) continue;
    if ((sourceChildrenMap.get(element.id)?.length ?? 0) > 0) {
      mixedChildParents.add(element.id);
    }
    const reused = input.reuse?.previous?.get(element.id);
    if (reused) {
      replaceResolvedRoot(element, reused.root);
      replayRefInstanceResolution(reused, elementsMap, childrenMap, elements);
      input.reuse!.next.set(element.id, reused);
      // 같은 문서 재사용이면 leaf 기록도 그대로 유효하다 (읽은 canonical 노드가 같다) — 다음 편집이 쓰도록 넘긴다.
      const carried = input.reuse!.leafPrevious?.get(element.id);
      if (carried) input.reuse!.leafNext?.set(element.id, carried);
      continue;
    }
    // ADR-237 G4 — leaf instance (자기 자식 · origin 자식 없음) 는 문서가 바뀌어도 읽은 canonical 노드가 같으면
    //   이전 해석을 쓴다 (편집한 owner 밖 정적 목록 항목 수백 개를 매 편집 다시 해석했다).
    const leafDeps = input.reuse?.leafNext
      ? readLeafDeps(
          element,
          elementsMap,
          sourceChildrenMap,
          lookupMaster,
          chainDepsByRef,
        )
      : null;
    if (leafDeps) {
      const leafReused = input.reuse!.leafPrevious?.get(element.id);
      if (leafReused && sameDeps(leafReused.deps, leafDeps)) {
        replaceResolvedRoot(element, leafReused.root);
        if (leafReused.record) {
          replayRefInstanceResolution(
            leafReused.record,
            elementsMap,
            childrenMap,
            elements,
          );
        }
        input.reuse!.leafNext!.set(element.id, leafReused);
        continue;
      }
    }
    const startLength = elements.length;
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
    const resolvedRootLayered = stateLayer
      ? applyStateLayerToResolved(
          resolvedRootBase,
          stateLayer,
          rawRefSource(element),
        )
      : resolvedRootBase;
    const resolvedRoot =
      resolvedRootLayered !== element
        ? withItemSelectionFlag(
            resolvedRootLayered,
            resolvedRootBase,
            elementsMap,
          )
        : resolvedRootLayered;
    if (resolvedRoot !== element) {
      markResolvedRef(resolvedRoot);
      registerStateOwnSource(resolvedRoot, rawRefSource(element));
      replaceResolvedRoot(element, resolvedRoot);
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
        lookupResult,
        patchOwners: [
          { owner: element, mountPath: "" },
          ...stateLayerOwner(element, stateLayer),
          ...chain.intermediates.map((owner) => ({ owner, mountPath: "" })),
        ],
        ...(input.prunePopoverContent
          ? {
              keepChild:
                createPopoverChildFilter(
                  chain.origin.type,
                  getNodeProps(resolvedRoot),
                  (id) => sourceChildrenMap.get(id) ?? [],
                ) ?? undefined,
            }
          : {}),
      },
    );
    dropBoundListStaticItems(
      element.id,
      chain.origin.type,
      getNodeProps(resolvedRoot),
      elementsMap,
      childrenMap,
      elements,
    );
    if (input.reuse) {
      const record = recordRefInstanceResolution(
        element,
        startLength,
        elementsMap,
        childrenMap,
        elements,
      );
      if (record) input.reuse.next.set(element.id, record);
      // leaf 재사용 기록 — 합성 자손이 있으면 (origin 자식) 그 기록째. 기록이 없으면 (해석 변화 없음 · 바인딩 행)
      //   재사용하지 않는다.
      if (leafDeps && record) {
        input.reuse.leafNext!.set(element.id, {
          root: resolvedRoot,
          deps: leafDeps,
          record: record.appended.length > 0 ? record : null,
        });
      }
    }
  }

  // ADR-237 — 위치 상태 (그룹 단일 펼침 · Breadcrumbs 마지막 = 현재) 는 최종 자식 목록으로.
  applyPositionalStateLayers(elements, elementsMap, childrenMap, lookupMaster);
  if (mixedChildParents.size > 0) {
    alignSiblingOrderToChildrenMap(elements, childrenMap, mixedChildParents);
  }
  return { childrenMap, elements, elementsMap };
}

/**
 * ADR-237 Phase 4 live — 결과 배열의 형제 순서를 최종 자식 목록 (`childrenMap`) 에 맞춘다.
 *
 * 합성 자식 (instance 가 상속한 origin 자식) 은 해석 중 배열 **끝** 에 붙어, 같은 부모의 원본 자식 (instance 자기
 * 자식 — Slot "+" 항목) 보다 뒤에 온다. 부모별 자식 목록은 `[origin 자식, 자기 자식]` 인데 layout 입력
 * (`buildPageChildrenMap`) 은 배열 순서로 부모별 목록을 만들어 자기 자식을 맨 앞에 배치했다 (Preview resolver 는
 * `[...origin, ...instance]` — 두 leg 발산). 각 부모의 자식이 차지한 배열 칸 안에서만 순서를 바꾼다 — 다른 부모
 * 사이의 상대 순서는 그대로.
 */
function alignSiblingOrderToChildrenMap<T extends CanonicalRefResolvableNode>(
  elements: T[],
  childrenMap: Map<string, T[]>,
  parentIds: ReadonlySet<string>,
): void {
  const rank = new Map<string, number>();
  for (const parentId of parentIds) {
    childrenMap.get(parentId)?.forEach((kid, index) => rank.set(kid.id, index));
  }
  const slotsByParent = new Map<string, number[]>();
  elements.forEach((element, index) => {
    const parentId = getParentId(element);
    if (!parentId || !parentIds.has(parentId) || !rank.has(element.id)) return;
    const slots = slotsByParent.get(parentId);
    if (slots) slots.push(index);
    else slotsByParent.set(parentId, [index]);
  });
  for (const slots of slotsByParent.values()) {
    if (slots.length < 2) continue;
    const members = slots.map((index) => elements[index]!);
    let sorted = true;
    for (let i = 1; i < members.length; i += 1) {
      if (rank.get(members[i - 1]!.id)! > rank.get(members[i]!.id)!) {
        sorted = false;
        break;
      }
    }
    if (sorted) continue;
    members.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    slots.forEach((index, i) => {
      elements[index] = members[i]!;
    });
  }
}

/**
 * ADR-234 Phase 3 — 바인딩 목록 owner instance 는 origin 의 정적 항목 자식을 펼치지 않는다 (행 = 데이터 +
 * 항목 템플릿 — scene projection). Preview resolver 도 같은 표 (`STATIC_LIST_FAMILY_BY_OWNER`) 로 거른다.
 */
function dropBoundListStaticItems<T extends CanonicalRefResolvableNode>(
  rootId: string,
  originType: string,
  rootProps: Record<string, unknown>,
  elementsMap: Map<string, T>,
  childrenMap: Map<string, T[]>,
  elements: T[],
): void {
  const family = STATIC_LIST_FAMILY_BY_OWNER[originType];
  if (!family || !isBoundListOwnerProps(rootProps)) return;
  const listId =
    family.listType === null
      ? rootId
      : childrenMap.get(rootId)?.find((child) => child.type === family.listType)
          ?.id;
  if (!listId) return;
  const listChildren = childrenMap.get(listId) ?? [];
  const items = listChildren.filter((child) => child.type === family.itemType);
  if (items.length === 0) return;
  for (const item of items) {
    removeSyntheticDescendantElements(
      item.id,
      elementsMap,
      childrenMap,
      elements,
    );
    elementsMap.delete(item.id);
    childrenMap.delete(item.id);
    const index = elements.indexOf(item);
    if (index >= 0) elements.splice(index, 1);
  }
  childrenMap.set(
    listId,
    listChildren.filter((child) => child.type !== family.itemType),
  );
}
