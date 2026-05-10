/**
 * @fileoverview Store-Level Canonical Resolver Bridge — ADR-903 P2 D-B
 *
 * canonical document + P2 resolver (`resolveCanonicalDocument`) 를
 * **document snapshot 진입점** 으로 묶고, consumer 측에서 사용할 lookup helper 와
 * render node 재구성 helper 를 제공한다.
 *
 * 본 모듈의 의도:
 * - **shared `ResolverCache` singleton 활용**: Preview / Skia 양쪽이 동일 cache
 *   인스턴스를 공유 (Gate G2 (a) 전제) — renderer wiring 에서 즉시 활용
 * - **per-instance mini-doc 옵션**: 단일 (master, ref) pair 단위로 cache hit 활용
 * - **full tree 옵션**: renderer consumer 가 한 번에 doc 전체를 받아 id →
 *   ResolvedNode index 로 lookup
 *
 * ADR-122 이후 legacy sprite hook surface 는 제거되었고, production consumer 는
 * Skia `StoreRenderBridge`/preview canonical resolver 경계에서 이 helper 를 사용한다.
 *
 * @see ADR-903 ref/slot composition format migration plan
 * @see resolvers/canonical/index.ts (P2 S1 본체)
 * @see adapters/canonical/index.ts (P1 adapter)
 */

import type {
  CanonicalNode,
  CompositionDocument,
  ComponentTag,
  RefNode,
  ResolvedNode,
  ResolverCache,
  ImportResolverContext,
} from "@composition/shared";

import type { CanonicalRefResolvableNode } from "@/adapters/canonical/canonicalRefResolution";
import { resolveCanonicalDocument } from "./index";
import { getSharedResolverCache } from "./cache";
import {
  getSharedImportRegistry,
  type CanonicalImportRegistry,
  type PrefetchDocumentImportsResult,
} from "./importRegistry";
import { extractCanonicalPropsFromResolved } from "./extractCanonicalProps";

type ComponentInstanceFields = {
  componentRole?: unknown;
  masterId?: unknown;
  overrides?: unknown;
  ref?: unknown;
};

function asComponentInstanceFields(
  node: CanonicalRefResolvableNode,
): ComponentInstanceFields {
  return node as CanonicalRefResolvableNode & ComponentInstanceFields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isInstanceNode(node: CanonicalRefResolvableNode): boolean {
  const fields = asComponentInstanceFields(node);
  return (
    (fields.componentRole === "instance" &&
      typeof fields.masterId === "string" &&
      fields.masterId.length > 0) ||
    (typeof fields.ref === "string" && fields.ref.length > 0)
  );
}

function getInstanceOverrides(
  node: CanonicalRefResolvableNode,
): Record<string, unknown> {
  const overrides = asComponentInstanceFields(node).overrides;
  return isRecord(overrides) ? overrides : (node.props ?? {});
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) CompositionDocument → ResolvedNode[] selector (full tree)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * canonical document snapshot 을 받아 P2 resolver 를 통과시킨 결과
 * ResolvedNode[] 를 반환한다.
 *
 * - cache 는 기본적으로 `getSharedResolverCache()` 의 singleton 사용 — Preview /
 *   Skia 양쪽이 동일 인스턴스를 공유한다는 ADR-903 P0 Gate G2 (a) 계약 충족
 * - caller 가 격리된 cache (테스트 등) 가 필요하면 4번째 인자로 명시 주입
 *
 * ADR-116 direct cutover 이후 이 진입점은 store snapshot 에서
 * `legacyToCanonical()` projection 을 재실행하지 않는다. cache 효과는
 * `resolveCanonicalDocument` 단계에서 ref subtree hit 으로 발휘된다.
 */
export function selectResolvedTree(
  doc: CompositionDocument,
  cache: ResolverCache = getSharedResolverCache(),
  imports: ImportResolverContext = getSharedImportRegistry(),
): ResolvedNode[] {
  return resolveCanonicalDocument(doc, cache, imports);
}

export function prefetchResolvedTreeImports(
  doc: CompositionDocument,
  registry: CanonicalImportRegistry = getSharedImportRegistry(),
): Promise<PrefetchDocumentImportsResult> {
  return registry.prefetchDocumentImports(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) ResolvedNode[] → Map<id, ResolvedNode> flatten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ResolvedNode 트리를 DFS 로 순회하여 모든 노드를 `id → ResolvedNode` Map 으로
 * 평탄화한다. renderer consumer 가 element.id 로 O(1) lookup 할 수 있도록.
 *
 * 동일 id 가 여러 번 나타나면 (예: 같은 ref 가 여러 page 에서 인스턴스화)
 * 마지막 occurrence 가 우선 — DFS 순서 보장.
 */
export function buildResolvedNodeIndex(
  tree: ResolvedNode[],
): Map<string, ResolvedNode> {
  const index = new Map<string, ResolvedNode>();
  for (const node of tree) {
    visit(node, index);
  }
  return index;
}

function visit(node: ResolvedNode, index: Map<string, ResolvedNode>): void {
  index.set(node.id, node);
  if (node.children) {
    for (const child of node.children) {
      visit(child, index);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.5) ResolvedNode 트리 → child id → parent id Map 빌드 (P3-B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resolved tree 를 DFS 순회하여 child id → parent id Map 을 빌드한다.
 *
 * ADR-903 P3-D-2 (`elementCreation.ts` 히스토리 조건) / P3-D-5 (`BuilderCore`
 * 필터링 경로) 가 legacy frame ownership predicate 를 canonical parent context
 * 기반으로 교체할 때 사용한다.
 *
 * - root 노드는 부모가 없으므로 Map 에 등록되지 않는다 (`index.has(rootId) === false`)
 * - DFS pre-order 로 traverse — 동일 id 가 트리 내 여러 곳에 등장하면 마지막
 *   occurrence 의 부모가 우선
 * - 단방향 (child → parent). parent → children 은 ResolvedNode.children 으로 직접 접근
 *
 * 설계 문서: `docs/adr/design/903-phase3d-runtime-breakdown.md` §4.5
 */
export function buildParentIndex(tree: ResolvedNode[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of tree) {
    visitParent(node, undefined, index);
  }
  return index;
}

function visitParent(
  node: ResolvedNode,
  parentId: string | undefined,
  index: Map<string, string>,
): void {
  if (parentId !== undefined) {
    index.set(node.id, parentId);
  }
  if (node.children) {
    for (const child of node.children) {
      visitParent(child, node.id, index);
    }
  }
}

/**
 * `buildParentIndex` 결과에서 element id 의 canonical parent id 를 조회한다.
 *
 * - root 노드 → `null` (Map 에 등록 안 됨)
 * - 존재하지 않는 id → `null`
 * - 그 외 → 직속 부모 id (조상 아님)
 *
 * 사용 사이트는 정렬된 `Map` 을 받아 O(1) 조회를 보장. 매 호출마다 tree 를
 * 재순회하지 않도록 caller 에서 index 를 한 번만 빌드해 재사용해야 한다.
 */
export function getCanonicalParentId(
  index: Map<string, string>,
  elementId: string,
): string | null {
  return index.get(elementId) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) ResolvedNode → canonical props 추출
// ─────────────────────────────────────────────────────────────────────────────

// ADR-116 direct cutover — `extractCanonicalPropsFromResolved` 는 store 무관
// helper 로 분리됨 (storeBridge import chain 의 vitest mock 함정 우회).
// 본 re-export 는 production caller (CanonicalNodeRenderer 등) 의 import path 보존.
export { extractCanonicalPropsFromResolved } from "./extractCanonicalProps";

// ─────────────────────────────────────────────────────────────────────────────
// 4) per-instance shared-cache resolve (mini-doc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 단일 (instance, master) pair 를 P2 resolver 의 mini CompositionDocument 로
 * 묶어서 `resolveCanonicalDocument` 를 통과시킨 후 결과 render node 를 재구성한다.
 *
 * renderer consumer 가 doc 전체 build 없이 단일 instance pair 를 canonical
 * 경로로 resolve 하면서도 shared cache hit 효과를 누리도록 설계.
 *
 * - master / instance 둘 다 canonical `props` 계약으로 mini document 를 구성 —
 *   P2 resolver 의 `resolveCanonicalRefProps` 가 동일 머지 결과 산출
 * - cache hit 단위는 `(refNode.id, descendantsFingerprint, slotBindingFingerprint)`
 *   조합. 같은 instance / master pair 의 반복 호출은 cache hit
 * - master 가 없으면 `null` 반환 — caller 는 legacy fallback 또는 element 그대로 처리
 *
 * @param instance - legacy/canonical instance render node
 * @param master   - instance origin 으로 조회한 master render node
 * @param cache    - shared ResolverCache (default: singleton)
 * @returns        canonical 경로로 resolve 된 render node (type = master.type, props = merged)
 */
export function resolveInstanceWithSharedCache<
  T extends CanonicalRefResolvableNode,
>(
  instance: T,
  master: T | undefined,
  cache: ResolverCache = getSharedResolverCache(),
): T | null {
  if (!isInstanceNode(instance)) return null;
  if (!master) return null;

  const masterNode: CanonicalNode = {
    id: master.id,
    type: master.type as ComponentTag,
    reusable: true,
    props: master.props,
    metadata: {
      type: "canonical-element",
    },
  };

  const refNode: RefNode = {
    id: instance.id,
    type: "ref",
    ref: master.id,
    props: getInstanceOverrides(instance),
    metadata: {
      type: "canonical-instance",
    },
  };

  const miniDoc: CompositionDocument = {
    version: "composition-1.0",
    children: [masterNode, refNode],
  };

  const [, resolvedRef] = resolveCanonicalDocument(miniDoc, cache);
  if (!resolvedRef) return null;

  const props = extractCanonicalPropsFromResolved(resolvedRef);

  return {
    ...instance,
    type: master.type,
    props,
  };
}
