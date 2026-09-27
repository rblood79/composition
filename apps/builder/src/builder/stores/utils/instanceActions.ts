/**
 * G.1 Instance Store Actions
 *
 * Master-Instance 시스템의 스토어 액션.
 * createInstance, detachInstance 등 인스턴스 생명주기 관리.
 *
 * Master propagation은 별도 액션이 불필요:
 * canonical ref/descendants shape를 renderer resolver가 매 render input에서 병합한다.
 *
 * @see docs/WASM_DOC_IMPACT_ANALYSIS.md §G.1
 */

import {
  canOperate,
  guardStoreOperation,
  notifyOperationRejected,
} from "../../domain/canOperate";
import type { Element } from "../../../types/core/store.types";
import type { ElementsState } from "../elements";
import {
  applyPropsPatch,
  mergePropsWithStyleDeep,
} from "../../../utils/component/instanceResolver";
import { historyManager } from "../history";
import {
  buildCanonicalInsertEvents,
  buildCanonicalReplaceEvents,
  captureCanonicalReplaceSources,
} from "../history/canonicalHistoryEvents";
import { createCompleteProps } from "./elementHelpers";
import {
  reportCanonicalNestingRejection,
  withoutRejectedElements,
} from "./canonicalNestingRejection";
import { buildIdPathContext } from "../../../adapters/canonical/idPath";
import {
  getEditingSemanticsImpactInstanceIds,
  isEditingSemanticsInstance,
  isEditingSemanticsOrigin,
  isSystemOwnedOrigin,
} from "../../utils/editingSemantics";
import { requestEditingSemanticsImpactConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import { getDB } from "../../../lib/db";
import { globalToast } from "../toast";
import {
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  getComponentDescendantsMirror,
  getComponentMasterReference,
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
} from "../../../adapters/canonical/componentSemanticsMirror";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../../adapters/canonical/frameMirror";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { getActiveCanonicalDocumentElementProjection } from "../canonical/canonicalElementsView";
import {
  createCustomIdAllocator,
  generateCustomId,
  getCustomIdBase,
} from "../../utils/idGeneration";
import {
  applyDescendantPatchToElement,
  getCanonicalRefChildSegments,
} from "../../../adapters/canonical/canonicalRefResolution";
import {
  mergeFillSizing,
  readPropsSchema,
  resolveTemplateBindingValues,
  substituteTemplateBindingsInProps,
} from "@composition/shared";

type CanonicalElementFields = {
  children?: unknown;
  reusable?: boolean;
  [COMPONENT_ROLE_MIRROR_FIELD]?: "master" | "instance";
  [COMPONENT_MASTER_ID_MIRROR_FIELD]?: string;
  [COMPONENT_OVERRIDES_MIRROR_FIELD]?: Record<string, unknown>;
  [COMPONENT_DESCENDANTS_MIRROR_FIELD]?: Record<string, unknown>;
  metadata?: { type?: string; [key: string]: unknown };
  ref?: unknown;
};

type CanonicalElement = Element & CanonicalElementFields;

const EMPTY_ELEMENTS: Element[] = [];
type InstanceActionSourceState = Omit<ElementsState, "elements"> & {
  elements: readonly Element[];
};

function asCanonicalElement(
  element: Element,
): Element & CanonicalElementFields {
  return element as Element & CanonicalElementFields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getElementProps(element: Element): Record<string, unknown> {
  return element.props ?? {};
}

function getRootOverrideProps(element: Element): Record<string, unknown> {
  return element.props ?? {};
}

function getCanonicalRef(element: Element): string | null {
  const ref = asCanonicalElement(element).ref;
  return typeof ref === "string" ? ref : null;
}

function removeRecordKey(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
  const { [key]: _removed, ...rest } = record;
  return rest;
}

function hasCanonicalOverridePayload(
  override: Record<string, unknown>,
): boolean {
  if (typeof override.type === "string") return true;
  if (Array.isArray(override.children)) return true;

  return Object.keys(propsFromCanonicalOverride(override)).length > 0;
}

function resetCanonicalOverrideRecordField(
  override: Record<string, unknown>,
  fieldKey: string,
): Record<string, unknown> | null {
  if (isRecord(override.props)) {
    const nextProps = removeRecordKey(override.props, fieldKey);
    if (!nextProps) return null;
    return { ...override, props: nextProps };
  }

  return removeRecordKey(override, fieldKey);
}

function findInstanceActionElement(
  elements: readonly Element[],
  elementId: string | null | undefined,
): Element | undefined {
  if (!elementId) return undefined;
  return elements.find((element) => element.id === elementId);
}

function getInstanceActionSourceElements(): readonly Element[] {
  return getActiveCanonicalDocumentElementProjection() ?? EMPTY_ELEMENTS;
}

function withInstanceActionSourceState(
  state: ElementsState | InstanceActionSourceState,
): InstanceActionSourceState {
  return { ...state, elements: getInstanceActionSourceElements() };
}

function resolveRefMaster(ref: string): Element | undefined {
  const elements = getInstanceActionSourceElements();
  const direct = findInstanceActionElement(elements, ref);
  if (direct) return direct;

  const { pathIdMap } = buildIdPathContext(elements);
  const pathId = pathIdMap.get(ref);
  const pathElement = findInstanceActionElement(elements, pathId);
  if (pathElement) return pathElement;

  return elements.find(
    (element) => element.customId === ref || element.componentName === ref,
  );
}

/** ADR-234 — ref 체인 깊이 상한 (Preview resolver `MAX_REF_CHAIN_DEPTH` 와 같은 값). */
const MAX_DETACH_REF_CHAIN_DEPTH = 8;

interface DetachMaster {
  /** 체인 끝 origin — 자식 · type · propsSchema 원천. */
  origin: Element;
  /** origin 위에 변형의 root props · 노드 필드를 안쪽 → 바깥 순서로 얹은 요소 (체인이 없으면 origin). */
  effective: Element;
  /** 변형들의 descendants 를 안쪽 → 바깥 순서로 합친 map (체인이 없으면 undefined). */
  patches: Record<string, unknown> | undefined;
}

/**
 * detach 의 master — 변형 (origin 의 reusable ref, ADR-234) 이면 체인 끝 origin 까지 따라가 변형의 root props ·
 * 노드 필드 · descendants 를 접는다 (Preview `resolveChainMaster`). ADR-150 detach 관찰 1 (2026-09-27): 종전엔 변형
 * 노드를 그대로 master 로 써 사본이 `type: "ref"` · ref 없는 노드로 남고 변형 descendants 가 빠졌다.
 * 순환 · 깊이 초과 · 끊긴 체인은 null.
 */
function resolveDetachMaster(ref: string): DetachMaster | null {
  const variants: Element[] = [];
  const seen = new Set<string>();
  let current = resolveRefMaster(ref);
  while (current && current.type === "ref") {
    if (seen.has(current.id) || seen.size >= MAX_DETACH_REF_CHAIN_DEPTH) {
      return null;
    }
    seen.add(current.id);
    variants.push(current);
    const next = getCanonicalRef(current);
    current = next ? resolveRefMaster(next) : undefined;
  }
  if (!current) return null;
  let effective: Element = current;
  let patches: Record<string, unknown> | undefined;
  for (let index = variants.length - 1; index >= 0; index -= 1) {
    const variant = variants[index]!;
    effective = applyDescendantPatchToElement(
      {
        ...effective,
        props: applyPropsPatch(
          getElementProps(effective),
          getRootOverrideProps(variant),
        ),
      },
      refNodeFieldPatch(variant),
    );
    patches = overlayDescendants(
      patches,
      getComponentDescendantsMirror(variant),
    );
  }
  return { origin: current, effective, patches };
}

function getSortedChildren(parentId: string): Element[] {
  return getInstanceActionSourceElements().filter(
    (element) => element.parent_id === parentId,
  );
}

function getComponentNameForElement(element: Element): string {
  return (
    element.componentName ?? element.customId ?? `${element.type} component`
  );
}

/**
 * detach 가 자식에 적용할 descendants patch. 경로 키가 먼저고, 옛 평면 키 (customId · componentName) 대체 조회는
 * 형제 중 segment 가 겹치지 않을 때만 한다 — 같은 segment 형제 (`Tag` · `Tag~2`) 가 있으면 두 번째부터 첫 형제의
 * patch 를 받는다 (ADR-150 LOW 재확인 2026-09-27).
 */
function getDescendantOverride(
  legacyOverrideMap: Record<string, unknown> | undefined,
  source: Element,
  relativePath: string,
  sharedSegment = false,
): Record<string, unknown> | undefined {
  if (!legacyOverrideMap) return undefined;
  const candidates = [
    relativePath,
    ...(sharedSegment ? [] : [source.customId, source.componentName]),
    source.id,
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    const override = legacyOverrideMap[candidate];
    if (isRecord(override)) return override;
  }
  return undefined;
}

/**
 * detach 의 중첩 ref 자식 descendants — ref 자신의 map 위에 바깥 instance map 의 `<ref 경로>/…` 키를 좁혀 얹는다
 * (Preview `resolveNestedRefChild` · `scopeInheritedDescendants` 와 같은 규칙: 둘 다 속성 patch 면 깊게 합치고, 아니면
 * 바깥이 이긴다). 바깥 map 의 나머지 키는 넘기지 않는다 — ADR-150 detach 후보 (2026-09-27): 종전엔 바깥 깊은 키를
 * 버려 Canvas 에서 한 중첩 항목 편집이 detach 뒤 사라졌고, ref 자신의 map 이 없으면 바깥 root map 이 그대로 넘어가
 * 같은 이름 자식에 새어 들었다.
 */
function scopeNestedRefDescendants(
  own: Record<string, unknown> | undefined,
  outer: Record<string, unknown> | undefined,
  refPath: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(own ?? {}) };
  const prefix = `${refPath}/`;
  for (const [path, patch] of Object.entries(outer ?? {})) {
    if (!path.startsWith(prefix)) continue;
    const key = path.slice(prefix.length);
    merged[key] = mergeDescendantPatch(merged[key], patch);
  }
  return merged;
}

/** 같은 경로의 두 patch — 둘 다 속성 patch 면 깊게 합치고, 아니면 바깥이 이긴다. */
function mergeDescendantPatch(ownPatch: unknown, patch: unknown): unknown {
  return isRecord(ownPatch) &&
    isRecord(patch) &&
    !("type" in ownPatch) &&
    !("type" in patch) &&
    !Array.isArray(patch.children)
    ? mergePropsWithStyleDeep(ownPatch, patch)
    : patch;
}

/** 안쪽 (변형) descendants 위에 바깥 map 을 같은 경로 규칙으로 얹는다 — 경로는 둘 다 origin 기준. */
function overlayDescendants(
  inner: Record<string, unknown> | undefined,
  outer: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!inner) return outer;
  if (!outer) return inner;
  const merged: Record<string, unknown> = { ...inner };
  for (const [path, patch] of Object.entries(outer)) {
    merged[path] = mergeDescendantPatch(merged[path], patch);
  }
  return merged;
}

/** ref 노드 자신의 노드 필드 (master 위에 얹는 값 — Preview `resolvedBase` 의 `...refNode` · `mergeFillSizing`). */
function refNodeFieldPatch(ref: Element): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (Array.isArray(ref.fills) && ref.fills.length > 0) patch.fills = ref.fills;
  if (ref.sizing) patch.sizing = ref.sizing;
  if (ref.responsive) patch.responsive = ref.responsive;
  if (typeof ref.enabled === "boolean") patch.enabled = ref.enabled;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * origin `propsSchema` 템플릿 (`{키}`) 의 바인딩 값 — detach 시점 instance 값으로 사본에 굳힌다 (ADR-148 · Preview
 * `_resolveRefNodeUncached` 와 같은 값). propsSchema 없는 origin 은 undefined (placeholder 원형 보존).
 */
function detachTemplateBindings(
  master: Element,
  resolvedProps: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const schema = readPropsSchema(master);
  return schema
    ? resolveTemplateBindingValues(schema, resolvedProps)
    : undefined;
}

function withDetachTemplateBindings(
  element: Element,
  bindings: Record<string, unknown> | undefined,
): Element {
  if (!bindings) return element;
  const props = getElementProps(element);
  const substituted = substituteTemplateBindingsInProps(props, bindings);
  return substituted === props ? element : { ...element, props: substituted };
}

function propsFromCanonicalOverride(
  override: Record<string, unknown>,
): Record<string, unknown> {
  const {
    children: _children,
    [COMPONENT_DESCENDANTS_MIRROR_FIELD]: _legacyOverrideMap,
    id: _id,
    metadata: _metadata,
    name: _name,
    ref: _ref,
    reusable: _reusable,
    type: _type,
    ...props
  } = override;
  return isRecord(override.props) ? override.props : props;
}

function stripCanonicalRuntimeFields(element: CanonicalElement): Element {
  const clone = { ...element } as CanonicalElement;
  delete clone.children;
  delete clone[COMPONENT_DESCENDANTS_MIRROR_FIELD];
  delete clone.metadata;
  delete clone.ref;
  return clone;
}

function persistElementsAfterInstanceMutation(_elements: Element[]): void {
  if (typeof indexedDB === "undefined") return;
  void (async () => {
    try {
      const db = await getDB();
      const canonical = useCanonicalDocumentStore.getState();
      const projectId = canonical.currentProjectId;
      const doc = projectId ? canonical.documents.get(projectId) : null;
      if (projectId && doc) {
        await db.documents.put(projectId, doc);
      }
    } catch (error) {
      console.warn(
        "⚠️ [IndexedDB] instance mutation 저장 중 오류 (메모리는 정상):",
        error,
      );
    }
  })();
}

/**
 * Canonical document 에 instance mutation 결과를 sync.
 *
 * **호출 순서 (현 잔존 패턴, ADR-122 §Residual)**: 본 함수의 caller 3곳
 * (`applyElementSnapshotBatch` / `createInstance` / `resetInstanceOverrideField`)
 * 는 `set` → 본 함수 → `_rebuildIndexes` 순서다. `_rebuildIndexes` 는 canonical
 * 우선 derive (elements.ts:430 `getCanonicalOrStoreElements`) 이므로 본 함수가
 * `_rebuildIndexes` 보다 먼저 호출되는 것은 stale derive race 회피에 필수다 —
 * 회귀: commits a859f8b97 + ee91020c4 가 그 race 만 우회 해소.
 *
 * 다만 이 순서는 ADR-122 HC #2 (`runtime mutation 은 canonical document 를 먼저
 * 갱신`) 의 **canonical 1차 (sync) → set → _rebuildIndexes** 를 충족하지 못하는
 * `set` 1차 잔존이다 (canonical-first invariant 아님). 호출 순서 reverse 정정은
 * history undo/redo + instance master/snapshot 영역 광범위로 회귀 위험 HIGH →
 * 후속 작업 분리. 상세는 `.claude/rules/state-management.md` 의 "Canonical sync
 * 호출 순서" 섹션 + § 잔존 영역 표 참조.
 */
/**
 * canonical 동기화. 중첩 규칙이 거부한 element id 를 돌려준다 — 호출자는 legacy
 * `elements` 배열에서 그 id 를 빼야 한다 (canonical 에 없는 유령이 배열에만 남는다).
 */
function syncInstanceElementsToCanonical(
  elements: Element[],
): ReadonlySet<string> {
  if (!areCanonicalMutationStoreActionsRegistered()) return new Set();
  const result = mergeElementsCanonicalPrimary(elements);
  return reportCanonicalNestingRejection(
    result,
    "syncInstanceElementsToCanonical",
  );
}

function createMaterializedElementFromOverride(
  override: Record<string, unknown>,
  fallback: Element,
  id: string,
  parentId: string | null,
  pageId: string | null | undefined,
): Element {
  return stripCanonicalRuntimeFields({
    ...fallback,
    id,
    type: typeof override.type === "string" ? override.type : fallback.type,
    parent_id: parentId,
    page_id: pageId ?? null,
    props: propsFromCanonicalOverride(override),
    reusable: undefined,
    [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
    componentName:
      typeof override.name === "string"
        ? override.name
        : fallback.componentName,
    // 교체 노드 (mode B · mode C 목록) 는 canonical 노드 — 노드 필드는 교체 노드 것만 (Preview `resolveNode(replacement)`
    //   와 같은 완전 교체). fallback (origin 자식) 의 숨김 · fills 등을 물려받지 않게 명시적으로 덮는다 (ADR-150 detach
    //   노드 필드 판독 LOW-1: 숨긴 origin 자식을 mode B 로 바꾸면 사본이 숨었다).
    fills: Array.isArray(override.fills) ? override.fills : undefined,
    sizing: isRecord(override.sizing) ? override.sizing : undefined,
    responsive: isRecord(override.responsive) ? override.responsive : undefined,
    enabled:
      typeof override.enabled === "boolean" ? override.enabled : undefined,
  } as Element);
}

function getCanonicalChildren(
  value: Record<string, unknown>,
): Record<string, unknown>[] {
  const children = value.children;
  if (!Array.isArray(children)) return [];
  return children.filter(isRecord);
}

function buildCanonicalDetachSnapshot(
  state: InstanceActionSourceState,
  refId: string,
  usedIds = new Set(
    getInstanceActionSourceElements().map((element) => element.id),
  ),
  // 사본은 origin 과 다른 사본의 customId 를 가져가지 않는다 — batch detach 는 할당기를 공유한다.
  allocateCustomId = createCustomIdAllocator(getInstanceActionSourceElements()),
): { elements: Element[]; previousElements: Element[] } | null {
  const sourceState = withInstanceActionSourceState(state);
  const refElement = findInstanceActionElement(sourceState.elements, refId);
  if (!refElement || refElement.type !== "ref") return null;

  const ref = getCanonicalRef(refElement);
  if (!ref) {
    console.warn("[Instance] canonical ref target not found:", refId);
    return null;
  }

  const detachMaster = resolveDetachMaster(ref);
  if (!detachMaster) {
    console.warn("[Instance] canonical ref master not found:", ref);
    return null;
  }
  // 변형 instance 면 master = 체인 끝 origin, 변형의 root 값 · descendants 는 instance 값 아래에 깐다.
  const { origin: master, effective: effectiveMaster } = detachMaster;

  const legacyDescendantMap = overlayDescendants(
    detachMaster.patches,
    getComponentDescendantsMirror(refElement),
  );
  const pageId = refElement.page_id ?? master.page_id ?? null;
  const createdChildren: Element[] = [];

  const nextId = (preferredId?: string) => {
    if (preferredId && !usedIds.has(preferredId)) {
      usedIds.add(preferredId);
      return preferredId;
    }
    let id = crypto.randomUUID();
    while (usedIds.has(id)) id = crypto.randomUUID();
    usedIds.add(id);
    return id;
  };

  // detach 로 새로 생긴 요소는 새 customId 를 받는다 (ADR-150 LOW 재확인 2026-09-27) — origin 자식 · 중첩 ref 의
  //   master 값을 그대로 옮기면 origin 과, 같은 origin 을 가리키는 형제 사본끼리 customId 가 겹친다 (ID 중복
  //   오류 · Preview/publish HTML id 중복). 번호 base 는 원래 노드 (중첩 ref 면 ref 자신) 의 customId 를 따른다.
  const pushCreated = (element: Element, source?: Element): Element => {
    const base =
      getCustomIdBase(source?.customId ?? undefined) ??
      getCustomIdBase(element.customId ?? undefined) ??
      element.type;
    const created = { ...element, customId: allocateCustomId(base) };
    createdChildren.push(created);
    return created;
  };

  // 형제 목록의 descendants 경로 segment — 편집기 · Canvas 와 같은 규칙 (`~N` 포함, ADR-150 후속 F3).
  const materializeChildren = (
    sources: readonly Element[],
    parentId: string,
    pathPrefix: string | null,
    activeLegacyDescendantMap: Record<string, unknown> | undefined,
    templateBindings: Record<string, unknown> | undefined,
  ) => {
    const segments = getCanonicalRefChildSegments(sources);
    const baseCounts = new Map<string, number>();
    for (const segment of segments) {
      const base = segment.replace(/~\d+$/, "");
      baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
    }
    sources.forEach((childSource, index) => {
      const segment = segments[index]!;
      materializeChild(
        childSource,
        parentId,
        pathPrefix ? `${pathPrefix}/${segment}` : segment,
        activeLegacyDescendantMap,
        (baseCounts.get(segment.replace(/~\d+$/, "")) ?? 0) > 1,
        templateBindings,
      );
    });
  };

  const materializeCanonicalNode = (
    source: Record<string, unknown>,
    parentId: string,
    templateBindings: Record<string, unknown> | undefined,
  ): Element => {
    const preferredId = typeof source.id === "string" ? source.id : undefined;
    const materializedId = nextId(preferredId);
    const type = typeof source.type === "string" ? source.type : "Box";
    const element = createMaterializedElementFromOverride(
      source,
      {
        id: materializedId,
        type,
        props: {},
        parent_id: parentId,
        page_id: pageId,
      } as Element,
      materializedId,
      parentId,
      pageId,
    );
    const created = pushCreated(
      withDetachTemplateBindings(element, templateBindings),
    );

    getCanonicalChildren(source).forEach((child) => {
      materializeCanonicalNode(child, created.id, templateBindings);
    });

    return created;
  };

  const materializeChild = (
    source: Element,
    parentId: string,
    relativePath: string,
    // 중첩 descendant 재귀는 현재 경로에서 해석한 legacy map을 이어받는다 (기본값 없음 — 중첩 ref 아래에서 바깥
    //   root map 으로 대체되면 안 된다).
    activeLegacyDescendantMap: Record<string, unknown> | undefined,
    sharedSegment: boolean,
    // 이 자식이 속한 ref 단계의 템플릿 바인딩 (중첩 ref 아래는 그 ref 의 값으로 바뀐다).
    templateBindings: Record<string, unknown> | undefined,
  ): Element => {
    const override = getDescendantOverride(
      activeLegacyDescendantMap,
      source,
      relativePath,
      sharedSegment,
    );
    const hasReplacement = Boolean(
      override && typeof override.type === "string",
    );
    const hasChildrenReplacement = Boolean(
      override && Array.isArray(override.children) && !hasReplacement,
    );
    if (hasReplacement && Array.isArray(override?.children)) {
      throw new Error(
        `[Instance] canonical slot override at "${relativePath}" violates 3-mode discriminator`,
      );
    }
    const nestedRef = !hasReplacement ? getCanonicalRef(source) : null;
    const nestedDetachMaster = nestedRef
      ? resolveDetachMaster(nestedRef)
      : null;
    const nestedMaster = nestedDetachMaster?.origin ?? null;
    const materializationSource = nestedMaster ?? source;
    const sourceOverrideProps = nestedMaster
      ? getRootOverrideProps(source)
      : {};
    const childDescendants = nestedMaster
      ? scopeNestedRefDescendants(
          overlayDescendants(
            nestedDetachMaster?.patches,
            getComponentDescendantsMirror(source),
          ),
          activeLegacyDescendantMap,
          relativePath,
        )
      : activeLegacyDescendantMap;
    const replacementId =
      hasReplacement && typeof override?.id === "string"
        ? override.id
        : undefined;
    const id = nextId(replacementId);
    // 중첩 ref 가 변형을 가리키면 변형 값을 얹은 origin 에서 시작한다.
    const baseSource = nestedDetachMaster?.effective ?? materializationSource;
    const baseProps = getElementProps(baseSource);
    const unpatched: CanonicalElement = {
      ...baseSource,
      id,
      parent_id: parentId,
      page_id: pageId,
      props: applyPropsPatch(baseProps, sourceOverrideProps),
      reusable: undefined,
      [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
      [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
    };
    // 중첩 ref 자신의 노드 필드 (fills · sizing · responsive · enabled) 를 master 위에, 그 위에 이 경로의 patch
    //   (mode A · mode C host) 를 — Canvas 해석기와 같은 함수 (노드 필드는 노드 필드로, 문자열 children 은 본문으로).
    //   ADR-150 detach 노드 필드 (2026-09-27): 종전엔 노드 필드를 props 에 섞어 넣고 본문 patch 를 버렸다.
    const refFields = nestedMaster ? refNodeFieldPatch(source) : null;
    const withRefFields = refFields
      ? applyDescendantPatchToElement(unpatched, refFields)
      : unpatched;
    const patched =
      override && !hasReplacement
        ? applyDescendantPatchToElement(withRefFields, override)
        : withRefFields;
    const element = stripCanonicalRuntimeFields(
      hasReplacement
        ? createMaterializedElementFromOverride(
            override!,
            source,
            id,
            parentId,
            pageId,
          )
        : patched,
    );

    // 템플릿 치환은 이 자식이 속한 ref 단계 값으로 — 중첩 ref 노드 자신은 바깥 값으로 치환하지 않는다 (Preview
    //   `substituteTemplateBindingsInChildren` 가 해석된 ref 에서 멈춘다). 그 아래 자식은 그 ref 의 값으로.
    const created = pushCreated(
      nestedMaster
        ? element
        : withDetachTemplateBindings(element, templateBindings),
      hasReplacement ? undefined : source,
    );
    const childBindings = nestedMaster
      ? detachTemplateBindings(nestedMaster, getElementProps(created))
      : templateBindings;

    if (hasReplacement) return created;
    if (hasChildrenReplacement) {
      ((override!.children as unknown[]) ?? []).forEach((childSource) => {
        if (isRecord(childSource)) {
          materializeCanonicalNode(childSource, created.id, templateBindings);
        }
      });
      return created;
    }
    materializeChildren(
      getSortedChildren(materializationSource.id),
      created.id,
      nestedMaster ? null : relativePath,
      childDescendants,
      childBindings,
    );
    if (nestedMaster) {
      // 중첩 ref 의 자기 자식 (TableView Row ref 의 Cell — ADR-241) 도 master 자식 뒤에 실체화한다. patch 는 바깥
      //   instance 의 `<ref>/<자기 자식>` 키만 (ref 자신의 map 은 master 자식 몫) — Preview `resolvedInstanceChildren`
      //   과 같은 범위 (ADR-150 detach 공백 2026-09-27: 셀이 전부 사라졌다).
      materializeChildren(
        getSortedChildren(source.id),
        created.id,
        null,
        scopeNestedRefDescendants(
          undefined,
          activeLegacyDescendantMap,
          relativePath,
        ),
        childBindings,
      );
    }
    return created;
  };

  const rootProps = applyPropsPatch(
    getElementProps(effectiveMaster),
    getRootOverrideProps(refElement),
  );
  const detachedRoot: Element = withFrameElementMirrorId(
    stripCanonicalRuntimeFields({
      ...effectiveMaster,
      ...refElement,
      // sizing · responsive 는 축 · tier 단위로 master 위에 — Preview `resolvedBase` 의 `mergeFillSizing`. ADR-150
      //   detach 관찰 2 (2026-09-27): 얕은 병합이라 instance 가 한 축만 써도 origin 의 다른 축 · tier 가 사라졌다.
      ...mergeFillSizing(effectiveMaster, refElement),
      id: refElement.id,
      type: master.type,
      parent_id: refElement.parent_id ?? null,
      page_id: refElement.page_id ?? master.page_id ?? null,
      props: rootProps,
      reusable: undefined,
      [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
      [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
      componentName: refElement.componentName ?? master.componentName,
    }),
    getFrameElementMirrorId(refElement),
  );
  const previousState = { ...refElement };

  materializeChildren(
    getSortedChildren(master.id),
    detachedRoot.id,
    null,
    legacyDescendantMap,
    detachTemplateBindings(master, rootProps),
  );

  const nextElements = [detachedRoot, ...createdChildren];

  return {
    elements: nextElements,
    previousElements: [previousState],
  };
}

function buildLegacyDetachSnapshot(
  instanceId: string,
): { elements: Element[]; previousElements: Element[] } | null {
  const sourceElements = getInstanceActionSourceElements();
  const instance = findInstanceActionElement(sourceElements, instanceId);
  if (!instance || !isComponentInstanceMirrorElement(instance)) return null;

  const masterRef = getComponentMasterReference(instance);
  const master = findInstanceActionElement(sourceElements, masterRef);

  let mergedProps: Record<string, unknown>;
  if (master) {
    // override 없음 → 빈 객체 (master props 유지). shared-cache 경로의
    // getInstanceOverrides 는 override 부재 시 instance.props 로 대체하므로
    // detach 확정 props 에는 사용하지 않는다.
    mergedProps = applyPropsPatch(
      master.props || {},
      getComponentOverridesMirror(instance) ?? {},
    );
  } else {
    mergedProps = {
      ...instance.props,
      ...(getComponentOverridesMirror(instance) ?? {}),
    };
  }

  const detachedInstance: CanonicalElement = {
    ...instance,
    props: mergedProps,
    [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    [COMPONENT_DESCENDANTS_MIRROR_FIELD]: undefined,
  };

  return {
    elements: [detachedInstance],
    previousElements: [{ ...instance }],
  };
}

function buildDetachSnapshot(
  state: ElementsState | InstanceActionSourceState,
  instanceId: string,
  usedIds?: Set<string>,
  allocateCustomId?: (base: string) => string,
): { elements: Element[]; previousElements: Element[] } | null {
  const sourceState = withInstanceActionSourceState(state);
  const instance = findInstanceActionElement(sourceState.elements, instanceId);
  if (instance?.type === "ref") {
    return buildCanonicalDetachSnapshot(
      sourceState,
      instanceId,
      usedIds,
      allocateCustomId,
    );
  }
  return buildLegacyDetachSnapshot(instanceId);
}

export function buildDetachSnapshotsForOrigins(
  state: ElementsState,
  origins: Element[],
  excludedElementIds: Set<string> = new Set(),
): { elements: Element[]; previousElements: Element[] } {
  const sourceState = withInstanceActionSourceState(state);
  const usedIds = new Set(sourceState.elements.map((element) => element.id));
  const allocateCustomId = createCustomIdAllocator(sourceState.elements);
  const seenInstanceIds = new Set<string>();
  const previousElements: Element[] = [];
  const elements: Element[] = [];

  for (const origin of origins) {
    // reusable 이면 origin 이다 — 다른 컴포넌트의 인스턴스이기도 한 노드
    // (dual) 도 자기 인스턴스를 갖는다. role 로 판정하면 instance 가 먼저 잡혀
    // 이 노드의 인스턴스들이 dangling ref 로 남는다.
    if (!isEditingSemanticsOrigin(origin)) continue;

    const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
      origin,
      sourceState.elements,
    );
    for (const instanceId of impactedInstanceIds) {
      if (seenInstanceIds.has(instanceId)) continue;
      if (excludedElementIds.has(instanceId)) continue;
      seenInstanceIds.add(instanceId);

      const snapshot = buildDetachSnapshot(
        sourceState,
        instanceId,
        usedIds,
        allocateCustomId,
      );
      if (!snapshot) {
        console.warn("[Instance] cannot auto-detach impacted instance:", {
          originId: origin.id,
          instanceId,
        });
        continue;
      }

      previousElements.push(...snapshot.previousElements);
      elements.push(...snapshot.elements);
    }
  }

  return { previousElements, elements };
}

function applyElementSnapshotBatch(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  elementId: string,
  previousElements: Element[],
  nextElements: Element[],
): void {
  const state = get();

  // ADR-122 HC#2 정합 순서로 재배열 (2026-07-15, §Residual 해소):
  // ① prev 캡처 (pre-mutation) → ② canonical sync 1차 → ③ replace event
  // entry (post-mutation 빌드 — detach 확장 subtree children 포함) → ④ set
  // (legacy mirror 2차) → ⑤ _rebuildIndexes
  const prevCaptures = captureCanonicalReplaceSources(
    previousElements.map((element) => element.id),
  );

  const rejectedIds = syncInstanceElementsToCanonical(nextElements);
  const acceptedElements = withoutRejectedElements(nextElements, rejectedIds);

  if (state.currentPageId) {
    historyManager.addEntry({
      type: "batch",
      elementId,
      elementIds: acceptedElements.map((element) => element.id),
      data: {
        canonicalEvents: buildCanonicalReplaceEvents(
          previousElements,
          acceptedElements,
          prevCaptures,
        ),
      },
    });
  }

  set((prevState) => {
    const removeIds = new Set(nextElements.map((element) => element.id));
    const sourceElements = getInstanceActionSourceElements();
    const retained = sourceElements.filter(
      (element) => !removeIds.has(element.id),
    );
    const updatedElements = [...retained, ...acceptedElements];
    const selectedElementProps = prevState.selectedElementId
      ? (() => {
          const selected = acceptedElements.find(
            (element) => element.id === prevState.selectedElementId,
          );
          return selected
            ? createCompleteProps(selected)
            : prevState.selectedElementProps;
        })()
      : prevState.selectedElementProps;
    return {
      elements: updatedElements,
      selectedElementProps,
      layoutVersion: prevState.layoutVersion + 1,
    };
  });
  get()._rebuildIndexes();
  const sourceElements = getInstanceActionSourceElements();
  const _persistedElements = nextElements.map(
    (element) =>
      findInstanceActionElement(sourceElements, element.id) ?? element,
  );
  persistElementsAfterInstanceMutation(_persistedElements);
}

/**
 * Instance 요소 생성
 *
 * master를 참조하는 새 instance element를 생성한다.
 * props는 비워두고, renderer resolver가 렌더링 시 master props를 병합.
 */
export function createInstance(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  masterRefId: string,
  parentId: string,
  pageId: string,
): Element | null {
  const state = withInstanceActionSourceState(get());
  const { elements: sourceElements } = state;
  const master = findInstanceActionElement(sourceElements, masterRefId);
  // 축 술어로 판정한다 (ADR-236 Phase 3 — role 우선순위 함수는 시각 마커 전용). dual 노드 (ADR-234
  //   상태 변형 `<origin>--<state>` = origin 의 ref + reusable) 는 state 층이지 배치 원본이 아니다 — 거부를
  //   명시한다 (종전에는 role 이 instance 를 먼저 골라 우연히 거부됐다).
  if (
    !master ||
    !isEditingSemanticsOrigin(master) ||
    isEditingSemanticsInstance(master)
  ) {
    console.warn("[Instance] master not found or not a master:", masterRefId);
    return null;
  }

  // ADR-116 G5-B P5-B: legacy override write site cleanup — empty Record 를
  // undefined 로 변경, 신규 legacy instance 는 IndexedDB 에 해당 field 자체를
  // 저장하지 않음 (read site 는 isRecord 검사 후 fallback 으로 안전).
  // legacy role 분기 자체는 ADR-111 P3 cleanup 영역.
  const instanceElement: CanonicalElement = {
    id: crypto.randomUUID(),
    type: master.type,
    customId: generateCustomId(master.type, sourceElements),
    props: {},
    parent_id: parentId,
    page_id: pageId,
    [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: masterRefId,
    [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
    componentName: master.componentName,
  };

  // ADR-040: elements 배열 추가 + 구조 변경이므로 _rebuildIndexes() 필수
  set((prevState) => ({
    elements: [...getInstanceActionSourceElements(), instanceElement],
    layoutVersion: prevState.layoutVersion + 1,
  }));
  // ADR-122 §Residual: set 1차 → sync → _rebuildIndexes (canonical-first 아님,
  // race 회피용 sync 선행) — syncInstanceElementsToCanonical JSDoc 참조
  const instanceRejectedIds = syncInstanceElementsToCanonical([
    instanceElement,
  ]);
  if (instanceRejectedIds.size > 0) {
    set((prevState) => ({
      elements: prevState.elements.filter(
        (element) => !instanceRejectedIds.has(element.id),
      ),
    }));
  }
  // 히스토리 — canonical insert event (sync 후 doc 조회 기반 빌드)
  if (state.currentPageId) {
    historyManager.addEntry({
      type: "add",
      elementId: instanceElement.id,
      data: {
        canonicalEvents: buildCanonicalInsertEvents([instanceElement]),
      },
    });
  }
  get()._rebuildIndexes();
  persistElementsAfterInstanceMutation([instanceElement]);

  return instanceElement;
}

/**
 * Instance를 독립 요소로 분리 (Detach)
 *
 * master props + instance patch를 병합하여 독립적인 props를 가진 일반 요소로 변환.
 * legacy instance marker 필드를 모두 제거.
 *
 * @returns detach 이전 상태 (undo 복원용)
 */
export function detachInstance(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  instanceId: string,
): { previousState: Element } | null {
  const state = withInstanceActionSourceState(get());
  // ADR-236 Phase 3 — 진입부 판정 (instance 만 · synthetic · projection · body).
  if (
    guardStoreOperation("detach", [instanceId], (id) =>
      findInstanceActionElement(state.elements, id),
    ).length === 0
  ) {
    return null;
  }
  const snapshot = buildDetachSnapshot(state, instanceId);
  if (!snapshot) {
    console.warn("[Instance] element is not an instance:", instanceId);
    return null;
  }

  applyElementSnapshotBatch(
    get,
    set,
    instanceId,
    snapshot.previousElements,
    snapshot.elements,
  );

  return { previousState: snapshot.previousElements[0] };
}

async function confirmOriginToggleImpact(
  origin: Element,
  impactedInstanceIds: string[],
  countDurationMs: number,
): Promise<boolean> {
  if (impactedInstanceIds.length === 0) return true;
  return requestEditingSemanticsImpactConfirmation({
    countDurationMs,
    impactedInstanceIds,
    instanceCount: impactedInstanceIds.length,
    originId: origin.id,
    originLabel: getComponentNameForElement(origin),
  });
}

function measureOriginImpact(
  origin: Element,
  elements: readonly Element[],
): { countDurationMs: number; impactedInstanceIds: string[] } {
  const startedAt = performance.now();
  const impactedInstanceIds = getEditingSemanticsImpactInstanceIds(
    origin,
    elements,
  );
  return {
    countDurationMs: performance.now() - startedAt,
    impactedInstanceIds,
  };
}

export async function toggleComponentOrigin(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  elementId: string,
  options: { beforeMutation?: () => void | Promise<void> } = {},
): Promise<{ elements: Element[]; previousElements: Element[] } | null> {
  const initialState = withInstanceActionSourceState(get());
  const element = findInstanceActionElement(initialState.elements, elementId);
  if (!element) return null;

  // ADR-236 Phase 3 — 진입부 판정. 생성 방향은 가드가 0 이라 body 가 reusable origin 이 될 수
  //   있었다 (E1). systemOwned 는 아래 전용 문구로 알린다.
  const verdict = canOperate("toggleOrigin", elementId, (id) =>
    findInstanceActionElement(initialState.elements, id),
  );
  if (!verdict.ok && verdict.reason !== "systemOwned") {
    notifyOperationRejected([verdict]);
    return null;
  }

  // 판정 축은 `reusable` 하나 — 인스턴스이면서 동시에 재사용 원본인 노드는
  // 여기서 원본 해제로 들어가야 한다 (role 판정 시 instance 가 먼저 잡혀
  // "다시 reusable 로 만들기" 로 되돌아가 해제 자체가 불가능했다).
  // Components 페이지의 system origin (상태 변형 포함) 은 해제하지 않는다 — 해제하면 팔레트
  // 배치 instance 와 상태 층이 원본을 잃는다 (삭제 가드와 같은 술어, ADR-228 Decision 4).
  if (isSystemOwnedOrigin(element)) {
    globalToast.info("componentAction.systemOriginLocked", {
      messageKey: "componentAction.systemOriginLocked",
    });
    return null;
  }

  if (!isEditingSemanticsOrigin(element)) {
    const nextElement: CanonicalElement = {
      ...element,
      componentName: getComponentNameForElement(element),
      reusable: true,
    };
    applyElementSnapshotBatch(get, set, elementId, [element], [nextElement]);
    return { previousElements: [element], elements: [nextElement] };
  }

  const t0Impact = measureOriginImpact(element, initialState.elements);
  const t0Confirmed = await confirmOriginToggleImpact(
    element,
    t0Impact.impactedInstanceIds,
    t0Impact.countDurationMs,
  );
  if (!t0Confirmed) return null;

  await options.beforeMutation?.();

  const latestState = withInstanceActionSourceState(get());
  const latestElement = findInstanceActionElement(
    latestState.elements,
    elementId,
  );
  if (!latestElement) return null;
  const t1Impact = measureOriginImpact(latestElement, latestState.elements);
  const impactChanged =
    t1Impact.impactedInstanceIds.length !==
      t0Impact.impactedInstanceIds.length ||
    t1Impact.impactedInstanceIds.some(
      (id, index) => id !== t0Impact.impactedInstanceIds[index],
    );

  if (impactChanged) {
    const t1Confirmed = await confirmOriginToggleImpact(
      latestElement,
      t1Impact.impactedInstanceIds,
      t1Impact.countDurationMs,
    );
    if (!t1Confirmed) return null;
  }

  const nextOrigin: CanonicalElement = {
    ...latestElement,
    [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
    reusable: false,
  };
  const usedIds = new Set(latestState.elements.map((current) => current.id));
  const allocateCustomId = createCustomIdAllocator(latestState.elements);
  const previousElements: Element[] = [latestElement];
  const nextElements: Element[] = [nextOrigin];

  for (const instanceId of t1Impact.impactedInstanceIds) {
    const snapshot = buildDetachSnapshot(
      latestState,
      instanceId,
      usedIds,
      allocateCustomId,
    );
    if (!snapshot) {
      console.warn("[Instance] cannot detach impacted instance:", instanceId);
      return null;
    }
    previousElements.push(...snapshot.previousElements);
    nextElements.push(...snapshot.elements);
  }

  applyElementSnapshotBatch(
    get,
    set,
    elementId,
    previousElements,
    nextElements,
  );
  return { previousElements, elements: nextElements };
}

/**
 * Instance override 필드를 제거한다.
 *
 * legacy instance는 root patch, canonical ref는 `props`를 root override
 * 저장소로 사용한다. canonical child override는
 * `descendantPath`가 지정된 경우 slot path 단위로 제거한다.
 */
export function resetInstanceOverrideField(
  get: () => ElementsState,
  set: (
    partial:
      | Partial<ElementsState>
      | ((state: ElementsState) => Partial<ElementsState>),
  ) => void,
  instanceId: string,
  fieldKey: string,
  descendantPath?: string,
): { previousState: Element } | null {
  const state = withInstanceActionSourceState(get());
  const { elements: sourceElements } = state;
  const instance = findInstanceActionElement(sourceElements, instanceId);
  if (!instance || !fieldKey) return null;

  const previousState = { ...instance };
  let nextElement: CanonicalElement | null = null;

  if (descendantPath && instance.type === "ref") {
    const legacyDescendantMap = getComponentDescendantsMirror(instance);
    const targetOverride = legacyDescendantMap?.[descendantPath];
    if (!isRecord(legacyDescendantMap) || !isRecord(targetOverride))
      return null;

    const nextOverride = resetCanonicalOverrideRecordField(
      targetOverride,
      fieldKey,
    );
    if (!nextOverride) return null;

    const nextLegacyDescendantMap = { ...legacyDescendantMap };
    if (hasCanonicalOverridePayload(nextOverride)) {
      nextLegacyDescendantMap[descendantPath] = nextOverride;
    } else {
      delete nextLegacyDescendantMap[descendantPath];
    }

    nextElement = {
      ...instance,
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: nextLegacyDescendantMap,
    } as Element;
  } else if (isComponentInstanceMirrorElement(instance)) {
    const overridePatch = getComponentOverridesMirror(instance) ?? {};
    const nextOverridePatch = removeRecordKey(overridePatch, fieldKey);
    if (!nextOverridePatch) return null;
    nextElement = {
      ...instance,
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: nextOverridePatch,
    };
  } else if (instance.type === "ref") {
    const props = instance.props ?? {};
    const nextProps = removeRecordKey(props, fieldKey);
    if (!nextProps) return null;
    nextElement = {
      ...instance,
      props: nextProps,
    };
  }

  if (!nextElement) return null;

  if (state.selectedElementId === instanceId) {
    state._cancelHydrateSelectedProps();
  }

  if (state.currentPageId) {
    // replace event 쌍 (pre-mutation 모드) — override/descendants mirror field
    // 변경은 props update event 로 표현 불가. canonical sync (아래
    // syncInstanceElementsToCanonical) 전 호출이므로 prev 는 현재 doc 에서,
    // next 는 nextElement 로부터 빌드된다.
    historyManager.addEntry({
      type: "update",
      elementId: instanceId,
      data: {
        canonicalEvents: buildCanonicalReplaceEvents(
          [previousState],
          [nextElement],
        ),
      },
    });
  }

  set((prevState) => {
    const sourceElements = getInstanceActionSourceElements();
    const idx = sourceElements.findIndex((el) => el.id === instanceId);
    const nextElements =
      idx >= 0 ? sourceElements.with(idx, nextElement) : [...sourceElements];
    const nextElementsMap = new Map(
      nextElements.map((element) => [element.id, element]),
    );
    nextElementsMap.set(instanceId, nextElement);
    return {
      elements: nextElements,
      elementsMap: nextElementsMap,
      selectedElementProps:
        prevState.selectedElementId === instanceId
          ? createCompleteProps(nextElement)
          : prevState.selectedElementProps,
      layoutVersion: prevState.layoutVersion + 1,
    };
  });
  // ADR-122 §Residual: set 1차 → sync → _rebuildIndexes (canonical-first 아님,
  // race 회피용 sync 선행) — syncInstanceElementsToCanonical JSDoc 참조
  const nextRejectedIds = syncInstanceElementsToCanonical([nextElement]);
  if (nextRejectedIds.size > 0) {
    set((prevState) => ({
      elements: prevState.elements.filter(
        (element) => !nextRejectedIds.has(element.id),
      ),
    }));
  }
  get()._rebuildIndexes();
  const persistedSourceElements = getInstanceActionSourceElements();
  const _persistedElement =
    findInstanceActionElement(persistedSourceElements, instanceId) ??
    nextElement;
  persistElementsAfterInstanceMutation([_persistedElement]);

  return { previousState };
}
