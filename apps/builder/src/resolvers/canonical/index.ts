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
  readPropsSchema,
  resolveTemplateBindingValues,
  substituteTemplateBindingsInChildren,
} from "@composition/shared";

import {
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
import { isSlotCandidateAllowed } from "../../builder/components/slotHostPolicy";

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
  return doc.children.map((node) => resolveNode(node, doc, cache, imports));
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
): ResolvedNode {
  // ── Step 1: reusable master lookup ────────────────────────────────────────
  const master = findReusableMaster(doc, refNode.ref, imports);

  if (!master) {
    // broken ref: warn 1회 + 원본 ref 노드 그대로 반환 (_resolvedFrom 미주입)
    console.warn(
      `[ADR-903] resolveCanonicalDocument: broken ref — master "${refNode.ref}" not found. node id: "${refNode.id}"`,
    );
    return nodeToResolved(refNode);
  }

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
  const propsSchema = readPropsSchema(master);
  const templateBindings = propsSchema
    ? resolveTemplateBindingValues(propsSchema, resolvedProps)
    : undefined;
  const mergedChildren = [
    ...resolvedOriginChildren,
    ...resolvedInstanceChildren,
  ];
  const resolvedChildren = templateBindings
    ? (substituteTemplateBindingsInChildren(
        mergedChildren,
        templateBindings,
      ) as ResolvedNode[])
    : mergedChildren;

  // ── Step 4: ResolvedNode 산출 (메타 필드 주입) ────────────────────────────
  const overrideFields = collectOverrideFields(refNode);
  const resolved: ResolvedNode = {
    ...resolvedBase,
    children: resolvedChildren,
    _resolvedFrom: master.id,
    ...(overrideFields.length > 0 ? { _overrides: overrideFields } : {}),
  };
  if (hasSlotContract(resolvedBase)) {
    validateSlotContract(resolvedBase, resolved, doc, imports);
  }

  return resolved;
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
  return children.map((child) => {
    const currentPath = parentPath ? `${parentPath}/${child.id}` : child.id;

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
      );
    }

    // 매칭 없음 — ref 자식은 자체 master 로 재귀 resolve.
    // inherited descendants 는 path 가 ref 까지 매칭되지 않았으므로 침투 안 함
    // (RefNode 자체 descendants 가 별도 resolve 시 적용됨).
    if (child.type === "ref") {
      return resolveRefNode(child as RefNode, doc, cache, imports);
    }

    return resolveFrameOrPlain(
      child,
      doc,
      cache,
      imports,
      descendants,
      currentPath,
    );
  });
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
): ResolvedNode {
  const hasType = "type" in override && override.type !== undefined;
  const hasChildren = "children" in override && override.children !== undefined;

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
    const resolvedChildren = childrenOverride.map((c) =>
      resolveNode(c, doc, cache, imports),
    );
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
  const resolved = resolveFrameOrPlain(patched, doc, cache, imports);
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
  for (const key of ["type", "pageId", "slug", "layoutId"] as const) {
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
