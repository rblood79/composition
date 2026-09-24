import { mergeFillSizing } from "@composition/shared";
/**
 * @fileoverview Canonical Document Resolver — ADR-903 Phase 2 Stream A
 *
 * 핵심 계약: resolveCanonicalDocument 단일 진입점.
 * Preview(DOM+CSS) 와 Skia(Canvas) 두 consumer 가 **동일 함수로 동일 ResolvedNode 트리**를
 * 받는 것이 ADR-903 Decision 의 본질 가치 ("대칭의 정의").
 *
 * 처리 순서 (ADR-903 Hard Constraint #3, P0 박제):
 *   ref resolve → descendants apply → slot contract validate → resolved tree
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 */

import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";
import type {
  CompositionDocument,
  CanonicalNode,
  RefNode,
  DescendantOverride,
  ResolvedNode,
  ResolverCache,
  ResolverCacheKey,
  ImportResolverContext,
} from "@composition/shared";

import {
  isBoundListOwnerProps,
  readPropsSchema,
  resolveTemplateBindingValues,
  STATIC_LIST_FAMILY_BY_OWNER,
  substituteTemplateBindingsInChildren,
} from "@composition/shared";

import {
  mergePropsWithStyleDeep,
  resolveCanonicalRefProps,
  resolveCanonicalDescendantOverride,
} from "@/utils/component/instanceResolver";
import {
  matchesReference,
  resolveReference,
} from "@/utils/component/referenceResolution";

// Stream B 가 실제 구현체를 export 한다.
// 본 stream 은 시그니처만 사용 — stub 은 Phase 2 Gate 통과 전까지 throw.
import {
  computeDescendantsFingerprint,
  computeSlotBindingFingerprint,
} from "./cache";
import { parseCompositionImportReference } from "./importNamespace";
import {
  isSlotCandidateAllowed,
  isSlotContractItem,
} from "../../builder/components/slotHostPolicy";
import {
  buildStateLayerSet,
  readInstanceOwnedKeys,
  STATE_LAYERS_PROP,
  type StateLayerProjection,
} from "../../builder/components/stateVariantLayers";

export type { ImportResolverContext } from "@composition/shared";

type SlotHostNode = CanonicalNode & { slot?: false | string[] };

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 문서 top-level children 전체를 resolve 하여 ResolvedNode 배열 반환.
 *
 * @param doc  전체 CompositionDocument (reusable 원본 조회 포함)
 * @param cache 선택적 ResolverCache. Preview / Skia 공유 인스턴스 전달 권장 (Gate G2 (a))
 * @returns doc.children 의 resolved 트리 (non-ref 노드는 그대로 통과, ref 노드는 fully resolved)
 */
export function resolveCanonicalDocument(
  doc: CompositionDocument,
  cache?: ResolverCache,
  imports?: ImportResolverContext,
): ResolvedNode[] {
  return doc.children
    .map((node) => resolveNode(node, doc, cache, imports))
    .filter(isResolvedEnabled);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 단일 노드를 resolve 한다.
 * - `type === "ref"` → resolveRefNode
 * - 그 외 → 자식 재귀 + slot contract 검증 (slot host)
 */
function resolveNode(
  node: CanonicalNode,
  doc: CompositionDocument,
  cache?: ResolverCache,
  imports?: ImportResolverContext,
): ResolvedNode {
  if (node.type === "ref") {
    return resolveRefNode(node as RefNode, doc, cache, imports);
  }
  return resolveFrameOrPlain(node, doc, cache, imports);
}

/**
 * (Step 1) ref resolve + (Step 2) descendants apply + (Step 4) resolved tree 산출.
 *
 * 캐싱 단위: ref 노드. hit → 즉시 반환. miss → resolve 후 cache.set.
 */
function resolveRefNode(
  refNode: RefNode,
  doc: CompositionDocument,
  cache?: ResolverCache,
  imports?: ImportResolverContext,
): ResolvedNode {
  // ── 캐시 조회 ─────────────────────────────────────────────────────────────
  if (cache) {
    // slot children fingerprint 는 ref root 기준이므로 refNode.children 사용
    const slotChildren = refNode.children as CanonicalNode[] | undefined;
    const key: ResolverCacheKey = [
      getResolverDocumentVersion(doc, imports),
      refNode.id,
      computeDescendantsFingerprint(
        refNode.descendants as Record<string, unknown> | undefined,
      ),
      computeSlotBindingFingerprint(slotChildren),
    ];
    const hit = cache.get(key);
    if (hit) return hit;

    const resolved = _resolveRefNodeUncached(refNode, doc, cache, imports);
    cache.set(key, resolved);
    return resolved;
  }

  return _resolveRefNodeUncached(refNode, doc, cache, imports);
}

/**
 * 실제 ref resolve 로직 (캐시 lookup/set 제외).
 */
function _resolveRefNodeUncached(
  refNode: RefNode,
  doc: CompositionDocument,
  cache: ResolverCache | undefined,
  imports: ImportResolverContext | undefined,
  chain: RefChainContext = ROOT_REF_CHAIN,
): ResolvedNode {
  // ── Step 1: reusable master lookup ────────────────────────────────────────
  const directMaster = findReusableMaster(doc, refNode.ref, imports);

  if (!directMaster) {
    // broken ref: warn 1회 + 원본 ref 노드 그대로 반환 (_resolvedFrom 미주입)
    console.warn(
      `[ADR-903] resolveCanonicalDocument: broken ref — master "${refNode.ref}" not found. node id: "${refNode.id}"`,
    );
    return nodeToResolved(refNode);
  }

  // ADR-234 Phase 1 — master 가 다시 ref (변형 = origin 의 reusable ref) 면 master 를 먼저 해석해
  //   그 결과를 master 로 쓴다 (origin 구조 + 변형 patch). 순환 · 깊이 초과는 broken ref 경로.
  const master = resolveChainMaster(
    directMaster,
    refNode,
    doc,
    cache,
    imports,
    chain,
  );
  if (!master) return nodeToResolved(refNode);

  // ── Step 1 continued: master + refNode props 머지 ────────────────────────
  const resolvedProps = resolveCanonicalRefProps(master, refNode);

  // master 의 resolved 기반 노드 구성 (type 은 master 기준)
  //
  // metadata 계약:
  //  - type: refNode.metadata.type 우선 (page ref 의 "legacy-page" 등 instance 식별자 보존)
  //          refNode metadata 없으면 master.metadata.type fallback
  //  - resolved props 는 ResolvedNode.props 에만 저장
  //  - refNode 의 나머지 page 식별 필드 (pageId, slug, layoutId 등) 보존
  //
  // Why: resolver 가 master.metadata.type 으로 덮어쓰면 "legacy-layout" 등 master 타입이
  //      인스턴스의 "legacy-page" 식별자를 소실시켜 App.tsx page filter 에서 miss 됨.
  const importedMasterMetadata = getImportedMasterMetadata(master.metadata);
  const refMetadata = getResolverRefMetadata(refNode.metadata);
  const resolvedBase: CanonicalNode = {
    ...master,
    ...refNode,
    ...mergeFillSizing(master, refNode),
    // type 은 ref 자체를 유지하지 않고, master 타입으로 "열어준다"
    // NOTE: ResolvedNode 에는 _resolvedFrom 이 있으므로 원본 추적 가능.
    //       여기서는 refNode.id 를 그대로 유지 (인스턴스 identity 보존).
    id: refNode.id,
    type: master.type,
    props: resolvedProps,
    metadata: {
      // refNode 의 instance-level metadata 를 base 로 (page 식별자 등 보존)
      ...refMetadata,
      ...importedMasterMetadata,
      // type 결정: refNode 우선 (page/legacy-page 식별자) → master fallback
      type:
        (refNode.metadata?.type as string | undefined) ??
        (master.metadata?.type as string | undefined) ??
        "legacy-element-props",
    },
  };

  // ── Step 2: descendants 3-mode apply ──────────────────────────────────────
  const resolvedOriginChildren = applyDescendantsToTree(
    master.children ?? [],
    refNode.descendants,
    doc,
    cache,
    imports,
    "",
  );
  const resolvedInstanceChildren = (refNode.children ?? []).map((child) =>
    resolveNode(child, doc, cache, imports),
  );
  // ADR-148 Phase 2 — 템플릿 바인딩 `{키}` 치환 (propsSchema gate).
  //   origin 이 metadata.propsSchema 를 선언한 reusable 에 한해, resolved instance root
  //   props(= origin 기본 + override merge)를 schema 키로 좁힌 바인딩으로 자식 placeholder
  //   를 치환한다. builder Skia 축(resolveCanonicalRefTree)과 동일 계약 — 한쪽만 치환하면
  //   CSS↔Skia 발산. 미선언 origin(ListBox 계열 row-data 바인딩)은 원형 보존.
  // 체인 중간 master 는 치환하지 않는다 — placeholder 를 체인 끝 instance 의 값이 채워야 한다.
  const propsSchema = chain.skipTemplateBindings
    ? undefined
    : readPropsSchema(master);
  const templateBindings = propsSchema
    ? resolveTemplateBindingValues(propsSchema, resolvedProps)
    : undefined;
  const mergedChildren = [
    ...dropBoundListStaticItems(
      master.type,
      resolvedProps as Record<string, unknown>,
      resolvedOriginChildren,
    ),
    ...resolvedInstanceChildren,
  ].filter(isResolvedEnabled);
  const resolvedChildren = templateBindings
    ? (substituteTemplateBindingsInChildren(
        mergedChildren,
        templateBindings,
      ) as ResolvedNode[])
    : mergedChildren;

  // ── Step 4: ResolvedNode 산출 (메타 필드 주입) ────────────────────────────
  const overrideFields = collectOverrideFields(refNode);
  // ADR-234 Phase 2 — 상태 변형 층 (render-only). Canvas (`resolveCanonicalRefTree`) 와 같은 층
  //   집합 · 같은 순서 — DOM 은 유효 상태를 정적으로 고르지 않고 `CanonicalNodeRenderer` 가 RAC render
  //   props (style · children 함수) 로 켜진 층을 겹친다. 층이 비면 (seed 그대로) 싣지 않는다.
  const stateOriginId =
    directMaster.type === "ref"
      ? findChainEndMaster(directMaster, doc, imports)?.id
      : directMaster.id;
  const stateLayerSet = stateOriginId
    ? buildStateLayerSet(stateOriginId, (id) =>
        findReusableMaster(doc, id, imports),
      )
    : null;
  const stateLayers: StateLayerProjection | null =
    stateLayerSet && Object.keys(stateLayerSet.layers).length > 0
      ? { set: stateLayerSet, own: readInstanceOwnedKeys(refNode) }
      : null;
  const resolved: ResolvedNode = {
    ...resolvedBase,
    ...(stateLayers
      ? { props: { ...resolvedProps, [STATE_LAYERS_PROP]: stateLayers } }
      : {}),
    children: resolvedChildren,
    _resolvedFrom: directMaster.id,
    ...(overrideFields.length > 0 ? { _overrides: overrideFields } : {}),
  };
  if (hasSlotContract(resolvedBase)) {
    validateSlotContract(resolvedBase, resolved, doc, imports);
  }

  return resolved;
}

/**
 * ADR-234 Phase 3 — 바인딩 목록 owner instance 는 origin 의 정적 항목 자식을 싣지 않는다 (행 = 데이터 + 항목
 * 템플릿). Canvas `resolveCanonicalRefTree` 와 같은 표 (`STATIC_LIST_FAMILY_BY_OWNER`).
 */
function dropBoundListStaticItems(
  originType: string,
  props: Record<string, unknown>,
  children: ResolvedNode[],
): ResolvedNode[] {
  const family = STATIC_LIST_FAMILY_BY_OWNER[originType];
  if (!family || !isBoundListOwnerProps(props)) return children;
  const withoutItems = (nodes: ResolvedNode[]) =>
    nodes.filter((node) => node.type !== family.itemType);
  if (family.listType === null) return withoutItems(children);
  return children.map((child) =>
    child.type === family.listType && child.children
      ? { ...child, children: withoutItems(child.children as ResolvedNode[]) }
      : child,
  );
}

/**
 * (Step 2) master children 서브트리에 descendants override 를 적용한다.
 *
 * path 는 slash 구분 stable id path:
 *   `""` → 현재 레벨 기준 id 직접 매핑
 *   `"ok-button/label"` → "ok-button" 노드 하위 "label" 자식
 *
 * 3-mode 판정:
 *   - mode B (`type` 존재) → 서브트리 완전 교체
 *   - mode C (`children` 존재 + `type` 없음) → children 배열 교체
 *   - mode A (위 둘 다 없음) → 속성 patch
 *   - 복수 조건 → throw (silent merge 금지)
 */
function applyDescendantsToTree(
  children: CanonicalNode[],
  descendants: Record<string, DescendantOverride> | undefined,
  doc: CompositionDocument,
  cache: ResolverCache | undefined,
  imports: ImportResolverContext | undefined,
  parentPath: string,
): ResolvedNode[] {
  return children
    .map((child): ResolvedNode => {
      // path 키는 두 규약이 공존한다 — canonical 스키마의 **id path** (`"Box/Slot"`, page-frame slot fill 이
      //   `convertPageLayout` 로 만든다) 와 builder Skia/store 축의 **segment path** (`getCanonicalRefPathSegment`
      //   — canonical 노드는 name → id; synthetic id · Properties/Styles 쓰기 키). ADR-229 Phase 2 (live
      //   실측): name 을 가진 조합 자식 (Form 의 "ButtonGroup" · "TextField/Name") 의 patch 를 Preview 만
      //   못 읽었다 — id 를 먼저 보고 segment 로도 맞춘다 (name 이 없으면 둘은 같다).
      const idPath = parentPath ? `${parentPath}/${child.id}` : child.id;
      const segment = getCanonicalRefPathSegment(child);
      const segmentPath = parentPath ? `${parentPath}/${segment}` : segment;
      const currentPath =
        descendants && Object.prototype.hasOwnProperty.call(descendants, idPath)
          ? idPath
          : segmentPath;

      if (
        descendants &&
        Object.prototype.hasOwnProperty.call(descendants, currentPath)
      ) {
        const override = descendants[currentPath]!;
        return applyOverrideToNode(
          child,
          override,
          currentPath,
          doc,
          cache,
          imports,
          descendants,
        );
      }

      // 매칭 없음 — ref 자식은 자체 master 로 재귀 resolve. ADR-229: 바깥 instance 의
      // 깊은 path patch (`<자식 ref path>/<nested master 자식>`) 는 그 ref 의 범위로 좁혀 넘긴다.
      if (child.type === "ref") {
        return resolveNestedRefChild(
          child as RefNode,
          undefined,
          descendants,
          idPath === segmentPath ? idPath : [idPath, segmentPath],
          doc,
          cache,
          imports,
        );
      }

      return resolveFrameOrPlain(
        child,
        doc,
        cache,
        imports,
        descendants,
        currentPath,
      );
    })
    .filter(isResolvedEnabled);
}

/**
 * ADR-229 Phase 0 — 조합 origin 의 자식 ref (origin 안 instance) 를 바깥 instance 문맥에서 해소한다.
 *
 * 바깥 instance 의 `descendants` 중 `<이 ref 의 path>/…` 로 시작하는 항목을 이 ref 의 범위로
 * 좁혀 (상대 path) 자식 ref 자신의 `descendants` 위에 얹는다 — nested master → 조합 자식
 * patch → 바깥 instance patch 순 (builder Skia 축 `getStackedDescendantPatch` 와 같은 계약).
 * 바깥 문맥이 관여하면 (mode A patch 또는 좁힌 항목 존재) 같은 자식 id 가 instance 마다 다른
 * 결과를 내므로 id 기준 cache 를 우회한다. 관여 0 이면 종전 경로 (cache 포함).
 */
function resolveNestedRefChild(
  child: RefNode,
  override: DescendantOverride | undefined,
  inheritedDescendants: Record<string, DescendantOverride> | undefined,
  currentPath: string | readonly string[],
  doc: CompositionDocument,
  cache: ResolverCache | undefined,
  imports: ImportResolverContext | undefined,
): ResolvedNode {
  const scoped = scopeInheritedDescendants(inheritedDescendants, currentPath);
  if (!override && !scoped) {
    return resolveRefNode(child, doc, cache, imports);
  }
  const ownDescendants = child.descendants ?? {};
  const mergedDescendants: Record<string, DescendantOverride> = {
    ...ownDescendants,
  };
  for (const [path, outer] of Object.entries(scoped ?? {})) {
    const own = ownDescendants[path];
    mergedDescendants[path] =
      own &&
      !("type" in outer) &&
      !Array.isArray(outer.children) &&
      !("type" in own)
        ? (mergePropsWithStyleDeep(
            own as Record<string, unknown>,
            outer as Record<string, unknown>,
          ) as DescendantOverride)
        : outer;
  }
  const effective: RefNode = {
    ...child,
    ...(Object.keys(mergedDescendants).length > 0
      ? { descendants: mergedDescendants }
      : {}),
  };
  return _resolveRefNodeUncached(effective, doc, cache, imports);
}

function scopeInheritedDescendants(
  descendants: Record<string, DescendantOverride> | undefined,
  currentPath: string | readonly string[],
): Record<string, DescendantOverride> | undefined {
  if (!descendants) return undefined;
  const prefixes = (
    typeof currentPath === "string" ? [currentPath] : currentPath
  ).map((path) => `${path}/`);
  let scoped: Record<string, DescendantOverride> | undefined;
  for (const [path, override] of Object.entries(descendants)) {
    const prefix = prefixes.find((candidate) => path.startsWith(candidate));
    if (!prefix) continue;
    (scoped ??= {})[path.slice(prefix.length)] = override;
  }
  return scoped;
}

/**
 * 단일 노드에 descendants override 를 적용한다 (3-mode discriminator).
 */
function applyOverrideToNode(
  child: CanonicalNode,
  override: DescendantOverride,
  pathKey: string,
  doc: CompositionDocument,
  cache: ResolverCache | undefined,
  imports: ImportResolverContext | undefined,
  inheritedDescendants?: Record<string, DescendantOverride>,
): ResolvedNode {
  const hasType = "type" in override && override.type !== undefined;
  // ADR-229: mode C 는 **배열** children 만이다 — Text/Label 의 `children` 문자열 patch 는 mode A
  //   props patch (builder Skia 축 `propsFromDescendantPatch` 와 같은 판정). 문자열을 mode C 로
  //   읽으면 `.map` 크래시.
  const hasChildren = Array.isArray(override.children);

  // 복수 조건 위반 체크 (type + children 동시 존재)
  if (hasType && hasChildren) {
    throw new Error(
      `[ADR-903] descendants override at "${pathKey}" violates 3-mode discriminator (silent merge 금지)`,
    );
  }

  // mode B: node replacement (type 존재) → 서브트리 완전 교체
  if (hasType) {
    const replacementNode = override as CanonicalNode;
    return resolveNode(replacementNode, doc, cache, imports);
  }

  // mode C: children replacement (children 존재 + type 없음)
  if (hasChildren) {
    const childrenOverride = (override as { children: CanonicalNode[] })
      .children;
    const resolvedChildren = childrenOverride
      .map((c) => resolveNode(c, doc, cache, imports))
      .filter(isResolvedEnabled);
    const resolved: ResolvedNode = {
      ...nodeToResolved(child),
      children: resolvedChildren,
      _overrides: ["children"],
    };
    // mode C 가 slot host children 을 교체한 경우 slot contract 검증
    if (hasSlotContract(child)) {
      validateSlotContract(child, resolved, doc, imports);
    }
    return resolved;
  }

  // mode A: 속성 patch — resolveCanonicalDescendantOverride 경유
  const patched = resolveCanonicalDescendantOverride(
    child,
    { [pathKey]: override },
    pathKey,
  );
  // ADR-229 Phase 0 — patch 대상이 조합 origin 의 자식 ref (Toolbar 안 Button) 면 patch 를
  //   얹은 뒤에도 그 ref 의 origin 으로 열어야 한다. 종전에는 `resolveFrameOrPlain` 이
  //   `type:"ref"` 를 그대로 두어 Preview 가 미해소 노드를 받았다 (Skia 축 F5 와 같은 결함).
  if (patched.type === "ref") {
    const resolvedRef = resolveNestedRefChild(
      patched as RefNode,
      override,
      inheritedDescendants,
      pathKey,
      doc,
      cache,
      imports,
    );
    return {
      ...resolvedRef,
      _overrides: [
        ...(resolvedRef._overrides ?? []),
        ...Object.keys(override as Record<string, unknown>),
      ],
    };
  }
  // 조상 속성 patch와 더 깊은 자식 patch는 동시에 적용되어야 한다.
  const resolved = resolveFrameOrPlain(
    patched,
    doc,
    cache,
    imports,
    inheritedDescendants,
    pathKey,
  );
  return {
    ...resolved,
    _overrides: [
      ...(resolved._overrides ?? []),
      ...Object.keys(override as Record<string, unknown>),
    ],
  };
}

/**
 * 일반(non-ref) 노드를 resolve 한다.
 * - 자식 재귀
 * - slot host 이면 slot contract validate (Step 3)
 *
 * `inheritedDescendants` / `pathPrefix` 는 ref 컨텍스트 내부에서 하향 전달용.
 */
function resolveFrameOrPlain(
  node: CanonicalNode,
  doc: CompositionDocument,
  cache: ResolverCache | undefined,
  imports?: ImportResolverContext,
  inheritedDescendants?: Record<string, DescendantOverride>,
  pathPrefix?: string,
): ResolvedNode {
  const resolvedChildren =
    node.children && node.children.length > 0
      ? applyDescendantsToTree(
          node.children,
          inheritedDescendants,
          doc,
          cache,
          imports,
          pathPrefix ?? node.id,
        )
      : node.children?.map((c) => nodeToResolved(c));

  const base = nodeToResolved(node);
  const result: ResolvedNode = {
    ...base,
    ...(resolvedChildren !== undefined ? { children: resolvedChildren } : {}),
  };

  // Step 3: slot contract validate
  if (hasSlotContract(node)) {
    validateSlotContract(node, result, doc, imports);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Slot Contract Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * slot host 의 `slot` 이 string[] 일 때 children 의 reusable id 범위 검증.
 *
 * pencil 공식: slot 은 추천 목록 — hard error 아님.
 * warning 만 emit 하고 계속 진행.
 */
function validateSlotContract(
  frame: SlotHostNode,
  resolved: ResolvedNode,
  doc: CompositionDocument,
  imports?: ImportResolverContext,
): void {
  if (!Array.isArray(frame.slot) || frame.slot.length === 0) return;

  const children = resolved.children ?? [];

  for (const child of children) {
    // ADR-237 — 그룹의 Label · Toolbar Separator 는 항목이 아니다 (추천 목록 대조 밖).
    if (!isSlotContractItem(frame, child)) continue;
    const refId = child._resolvedFrom ?? child.id;
    const matchesDeclaredSlot = frame.slot.some((reference) =>
      matchesResolvedSlotChildReference(child, reference, doc, imports),
    );
    const matchesSharedPolicy = isSlotCandidateAllowed(frame, child);
    if (!matchesDeclaredSlot || !matchesSharedPolicy) {
      console.warn(
        `[ADR-903] slot contract: host "${frame.id}" slot=${JSON.stringify(frame.slot)} — child "${refId}" is outside recommended slot range (non-blocking)`,
      );
    }
  }
}

function hasSlotContract(node: CanonicalNode): node is SlotHostNode {
  return Array.isArray((node as SlotHostNode).slot);
}

function matchesResolvedSlotChildReference(
  child: ResolvedNode,
  reference: string,
  doc: CompositionDocument,
  imports?: ImportResolverContext,
): boolean {
  if (matchesReference(child, reference)) return true;

  if (!child._resolvedFrom) return false;

  const master = findReusableMaster(doc, child._resolvedFrom, imports);
  return master ? matchesReference(master, reference) : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADR-234 Phase 1 — ref 체인 · enabled
// ─────────────────────────────────────────────────────────────────────────────

/** 체인 깊이 상한 — 변형 (1) + 변형의 변형 여유. 넘으면 broken ref 와 같은 경고 경로. */
export const MAX_REF_CHAIN_DEPTH = 8;

type RefChainContext = {
  /** 지금 해석 중인 ref 노드 id 들 (순환 감지). */
  readonly visiting: readonly string[];
  /** 체인 중간 master 해석 — 템플릿 바인딩 치환을 체인 끝으로 미룬다. */
  readonly skipTemplateBindings?: boolean;
};

const ROOT_REF_CHAIN: RefChainContext = { visiting: [] };

/**
 * `enabled` (ADR-234): 부재 = 상속 · false = 숨김 · true = 표시. resolved 노드의 값은 이미 체인
 * (`{...master, ...ref}`) · descendants patch 를 지난 유효값이다 — 여기서는 false 만 뺀다. 조상이
 * 빠지면 subtree 전체가 빠진다 (자식은 방문되지 않는다).
 */
export function isResolvedEnabled(node: { enabled?: unknown }): boolean {
  return node.enabled !== false;
}

/**
 * master 가 `type: "ref"` (reusable ref — 변형) 면 먼저 해석한 결과를 master 로 쓴다. 결과는
 * origin 의 type · 구조 + 변형 patch 이고 id 는 변형 id (descendants path 규약 유지). metadata 는
 * 체인 끝 origin 위에 변형 자신의 것 (propsSchema 는 origin 에서 온다).
 */
function resolveChainMaster(
  master: CanonicalNode,
  refNode: RefNode,
  doc: CompositionDocument,
  cache: ResolverCache | undefined,
  imports: ImportResolverContext | undefined,
  chain: RefChainContext,
): CanonicalNode | undefined {
  if (master.type !== "ref") return master;
  const visiting = [...chain.visiting, refNode.id];
  if (visiting.includes(master.id) || visiting.length >= MAX_REF_CHAIN_DEPTH) {
    console.warn(
      `[ADR-234] resolveCanonicalDocument: broken ref — ref chain cycle or depth > ${MAX_REF_CHAIN_DEPTH} at "${master.id}". node id: "${refNode.id}"`,
    );
    return undefined;
  }
  const resolved = _resolveRefNodeUncached(
    master as RefNode,
    doc,
    cache,
    imports,
    { visiting, skipTemplateBindings: true },
  );
  if (resolved.type === "ref") return undefined; // 체인 안쪽이 broken
  const chainEnd = findChainEndMaster(master, doc, imports);
  return {
    ...resolved,
    id: master.id,
    reusable: true,
    metadata: {
      ...(chainEnd?.metadata ?? {}),
      ...(master.metadata ?? {}),
      type:
        (master.metadata?.type as string | undefined) ??
        (chainEnd?.metadata?.type as string | undefined) ??
        "legacy-element-props",
    },
  } as CanonicalNode;
}

function findChainEndMaster(
  master: CanonicalNode,
  doc: CompositionDocument,
  imports: ImportResolverContext | undefined,
): CanonicalNode | undefined {
  let current: CanonicalNode | undefined = master;
  for (let depth = 0; current && current.type === "ref"; depth += 1) {
    if (depth >= MAX_REF_CHAIN_DEPTH) return undefined;
    current = findReusableMaster(doc, (current as RefNode).ref, imports);
  }
  return current;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * document 전체 tree 에서 `reusable === true` 인 모든 노드를 평면 수집한다.
 *
 * `doc.children` 는 page frame (`type: "frame"`, `metadata.type: "legacy-page"`) 단위로
 * 1단계 중첩되어 있고, reusable master 는 그 frame 의 children 하위에 위치한다
 * (예: master "component-listbox" 는 page-components frame 의 body 자식). 따라서
 * top-level `doc.children.filter(reusable)` 만으로는 master 를 찾지 못한다.
 *
 * Skia(Canvas) 는 builder 전역 elementsMap (page 무관 평면) 에서 master 를 찾아 항상
 * resolve 되는데, preview(DOM) resolver 가 top-level 만 보면 cross-page reusable instance
 * 가 broken ref 로 빈 렌더 → ADR-903 대칭 위반. 전체 tree 수집으로 Skia 와 대칭 복원.
 *
 * memoize: document identity + version 기준 (`WeakMap`). version 변경 시 재수집.
 */
const reusableMasterCache = new WeakMap<
  CompositionDocument,
  { version: string; masters: CanonicalNode[] }
>();

function collectReusableMasters(doc: CompositionDocument): CanonicalNode[] {
  const cached = reusableMasterCache.get(doc);
  if (cached && cached.version === doc.version) return cached.masters;

  const masters: CanonicalNode[] = [];
  const walk = (node: CanonicalNode): void => {
    if (node.reusable === true) masters.push(node);
    const children = node.children;
    if (children) {
      for (const child of children) walk(child);
    }
  };
  for (const node of doc.children) walk(node);

  reusableMasterCache.set(doc, { version: doc.version, masters });
  return masters;
}

/**
 * document 전체 tree 에서 `refId` 가 id/name/metadata alias 와 매칭되고
 * `reusable === true` 인 원본 노드를 찾는다.
 * 없으면 undefined 반환 (broken ref).
 */
function findReusableMaster(
  doc: CompositionDocument,
  refId: string,
  imports?: ImportResolverContext,
): CanonicalNode | undefined {
  const local = resolveReference(refId, collectReusableMasters(doc));
  if (local) return local;

  return resolveImportedReusableMaster(doc, refId, imports);
}

function resolveImportedReusableMaster(
  doc: CompositionDocument,
  refId: string,
  imports?: ImportResolverContext,
): CanonicalNode | undefined {
  const parsed = parseCompositionImportReference(refId);
  if (!parsed || !imports) return undefined;

  const source = doc.imports?.[parsed.importKey];
  if (!source) return undefined;

  const importedDoc = imports.resolveImportDocument(parsed.importKey, source);
  if (!importedDoc) return undefined;

  // importedDoc 도 page frame 으로 중첩될 수 있어 collectReusableMasters 로 전체 tree 탐색
  // (local 경로와 동일 — top-level filter 만으로는 중첩 master 누락).
  const master = resolveReference(
    parsed.nodeId,
    collectReusableMasters(importedDoc),
  );

  if (!master) return undefined;

  return {
    ...master,
    id: refId,
    metadata: {
      ...(master.metadata ?? { type: "imported" }),
      type: master.metadata?.type ?? "imported",
      importedFrom: refId,
      importKey: parsed.importKey,
      importNodeId: master.id,
      importSource: source,
    },
  };
}

function getResolverDocumentVersion(
  doc: CompositionDocument,
  imports?: ImportResolverContext,
): string {
  const fingerprint = getImportsFingerprint(doc, imports);
  return fingerprint ? `${doc.version}|imports:${fingerprint}` : doc.version;
}

function getImportsFingerprint(
  doc: CompositionDocument,
  imports?: ImportResolverContext,
): string {
  const entries = Object.entries(doc.imports ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (entries.length === 0) return "";

  return entries
    .map(([importKey, source]) => {
      const importedVersion =
        imports?.resolveImportDocument(importKey, source)?.version ?? "";
      return `${importKey}:${source}:${importedVersion}`;
    })
    .join("|");
}

function getImportedMasterMetadata(
  metadata: CanonicalNode["metadata"],
): Record<string, unknown> {
  if (!metadata || typeof metadata.importedFrom !== "string") {
    return {};
  }

  return {
    importedFrom: metadata.importedFrom,
    importKey: metadata.importKey,
    importNodeId: metadata.importNodeId,
    importSource: metadata.importSource,
  };
}

function getResolverRefMetadata(
  metadata: CanonicalNode["metadata"],
): Record<string, unknown> {
  if (!metadata) return {};

  const out: Record<string, unknown> = {};
  // ADR-234: 변형 노드 (ref) 의 상태 표식 — Components 페이지가 그 상태로 그린다 (origin 의 표식은
  //   instance 로 새지 않는다: master metadata 는 여기서 복사하지 않는다).
  for (const key of [
    "type",
    "pageId",
    "slug",
    "layoutId",
    "variant",
    "variantOf",
    "componentFamily",
  ] as const) {
    if (metadata[key] !== undefined) out[key] = metadata[key];
  }
  return out;
}

/**
 * CanonicalNode → ResolvedNode (메타 필드 없는 단순 변환).
 * children 은 그대로 전달 (호출자가 재귀 후 교체).
 */
function nodeToResolved(node: CanonicalNode): ResolvedNode {
  return node as ResolvedNode;
}

/**
 * RefNode 에서 사용자가 실제로 override 한 필드 경로를 추적한다.
 *
 * - descendants 각 path key 를 "descendants.<key>" 로 기록
 * - 추후 Properties 패널 "원본과 다름" dot 마커 표시에 사용
 */
function collectOverrideFields(refNode: RefNode): string[] {
  if (!refNode.descendants) return [];
  return Object.keys(refNode.descendants).map((k) => `descendants.${k}`);
}
