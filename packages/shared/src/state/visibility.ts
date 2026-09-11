/**
 * ADR-214 Phase 1 — 가시성 사슬 + 이름 고유 검증기 (HC5).
 *
 * 사슬: 요소 → 조상 요소들 → 페이지 → 프로젝트. 같은 이름이 한 사슬에 둘이면 **생성 시점에
 * 거부** 한다 (shadowing 금지) — 편집기 · Properties 상태 절 · AI 제안 · `define_variable`
 * 적용기가 전부 이 검증기 하나를 쓴다. 자동완성 · 인덱스는 "한 이름 = 한 변수" 를 전제한다.
 *
 * 페이지는 canonical 에서 `metadata.type: "page" | "legacy-page"` 노드다 (별도 페이지
 * 객체 없음). layout-bound 페이지 (`RefNode` + `descendants[slot].children`) 의 자식은
 * `children[]` 이 아니라 descendants 에 있으므로 순회가 그쪽도 내려간다
 * (`canvasSceneNode.ts` `getRefDescendantChildren` 과 같은 규약).
 */
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "../types/composition-document.types";
import {
  isVariableDefList,
  type VariableDef,
  type VariableOwner,
} from "./variable.types";

export interface VisibleVariable {
  def: VariableDef;
  owner: VariableOwner;
}

/** 가시성 조회 대상 — `null` 은 프로젝트 레벨 (Data 탭 등) */
export type VisibilityTarget =
  | { kind: "element"; elementId: string }
  | { kind: "page"; pageId: string }
  | null;

interface NodeEntry {
  node: CanonicalNode;
  parentId: string | null;
  /** 이 노드가 속한 페이지 노드 id (페이지 노드 자신이면 자기 id) */
  pageId: string | null;
}

interface DocumentStateIndex {
  byId: Map<string, NodeEntry>;
}

const indexCache = new WeakMap<CompositionDocument, DocumentStateIndex>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPageNode(node: CanonicalNode): boolean {
  const type = (node.metadata as { type?: unknown } | undefined)?.type;
  return type === "page" || type === "legacy-page";
}

function readDescendantChildren(override: unknown): CanonicalNode[] {
  if (!isRecord(override)) return [];
  if (typeof override.id === "string" && typeof override.type === "string") {
    return [override as unknown as CanonicalNode];
  }
  const children = override.children;
  if (!Array.isArray(children)) return [];
  return children.filter(
    (child): child is CanonicalNode =>
      isRecord(child) &&
      typeof child.id === "string" &&
      typeof child.type === "string",
  );
}

/** 노드의 구조 자식 — `children[]` + (페이지 ref 면) descendants override 의 children */
function structuralChildren(node: CanonicalNode): CanonicalNode[] {
  const out: CanonicalNode[] = Array.isArray(node.children)
    ? [...node.children]
    : [];
  if (node.type === "ref" && isPageNode(node)) {
    const descendants = (node as RefNode).descendants;
    if (isRecord(descendants)) {
      for (const override of Object.values(descendants)) {
        out.push(...readDescendantChildren(override));
      }
    }
  }
  return out;
}

function buildIndex(doc: CompositionDocument): DocumentStateIndex {
  const byId = new Map<string, NodeEntry>();
  const visit = (
    node: CanonicalNode,
    parentId: string | null,
    pageId: string | null,
  ): void => {
    const ownPageId = isPageNode(node) ? node.id : pageId;
    // 같은 id 가 둘이면 첫 방문 (문서 순서) 이 이긴다 — projection 과 같은 first-wins
    if (!byId.has(node.id))
      byId.set(node.id, { node, parentId, pageId: ownPageId });
    for (const child of structuralChildren(node))
      visit(child, node.id, ownPageId);
  };
  for (const child of doc.children) visit(child, null, null);
  return { byId };
}

function getIndex(doc: CompositionDocument): DocumentStateIndex {
  const cached = indexCache.get(doc);
  if (cached) return cached;
  const built = buildIndex(doc);
  indexCache.set(doc, built);
  return built;
}

function nodeState(node: CanonicalNode): VariableDef[] {
  return isVariableDefList(node.state) ? node.state : [];
}

function ownerOf(entry: NodeEntry): VariableOwner {
  return isPageNode(entry.node)
    ? { kind: "page", pageId: entry.node.id }
    : { kind: "element", elementId: entry.node.id };
}

/** 자기 → 루트 순서의 조상 사슬 (자기 포함). 없는 id 면 빈 배열 */
function ancestorChain(index: DocumentStateIndex, nodeId: string): NodeEntry[] {
  const chain: NodeEntry[] = [];
  let current = index.byId.get(nodeId);
  const seen = new Set<string>();
  while (current && !seen.has(current.node.id)) {
    seen.add(current.node.id);
    chain.push(current);
    current = current.parentId ? index.byId.get(current.parentId) : undefined;
  }
  return chain;
}

/**
 * 대상에서 보이는 변수 목록 — 가까운 소유자가 앞 (요소 → 조상 → 페이지 → 프로젝트).
 * 사슬 안 이름은 고유하므로 (HC5) 결과에 같은 이름이 둘 나오면 데이터가 이미 규칙을
 * 어긴 것이다 — 그래도 앞 (가까운 쪽) 을 그대로 두고 거르지 않는다 (인덱스가 보여야 고칠 수 있다).
 */
export function resolveVisibleVariables(
  doc: CompositionDocument | null | undefined,
  target: VisibilityTarget,
  projectVariables: readonly VariableDef[],
): VisibleVariable[] {
  const out: VisibleVariable[] = [];
  if (doc && target) {
    const index = getIndex(doc);
    const startId =
      target.kind === "element" ? target.elementId : target.pageId;
    for (const entry of ancestorChain(index, startId)) {
      const owner = ownerOf(entry);
      for (const def of nodeState(entry.node)) out.push({ def, owner });
    }
  }
  for (const def of projectVariables)
    out.push({ def, owner: { kind: "project" } });
  return out;
}

/** 두 노드가 한 사슬에 있는가 — 한쪽이 다른 쪽의 조상-또는-자기 */
function shareChain(index: DocumentStateIndex, a: string, b: string): boolean {
  if (a === b) return true;
  const chainA = ancestorChain(index, a);
  if (chainA.some((entry) => entry.node.id === b)) return true;
  const chainB = ancestorChain(index, b);
  return chainB.some((entry) => entry.node.id === a);
}

/**
 * 소유자 `owner` 에 이름 `name` 을 두면 사슬 안 다른 변수와 충돌하는가.
 *
 * - project 소유자: 문서 안 모든 state 이름 + 다른 project 변수 (모든 사슬이 project 를 지난다)
 * - page / element 소유자: project 변수 + 같은 사슬 (조상-또는-자기 · 자손) 노드의 state
 * - `excludeId` 는 자기 rename 시 자기 자신을 제외
 *
 * @returns 충돌한 변수 (가까운 것 우선 아님 — 첫 발견) 또는 null
 */
export function findVariableNameConflict(
  doc: CompositionDocument | null | undefined,
  owner: VariableOwner,
  name: string,
  projectVariables: readonly VariableDef[],
  excludeId?: string,
): VisibleVariable | null {
  const target = name.trim();
  if (!target) return null;
  const matches = (def: VariableDef): boolean =>
    def.id !== excludeId && def.name.trim() === target;

  for (const def of projectVariables) {
    if (matches(def)) return { def, owner: { kind: "project" } };
  }
  if (!doc) return null;
  const index = getIndex(doc);
  const ownerNodeId =
    owner.kind === "project"
      ? null
      : owner.kind === "page"
        ? owner.pageId
        : owner.elementId;

  for (const entry of index.byId.values()) {
    const defs = nodeState(entry.node);
    if (defs.length === 0) continue;
    if (ownerNodeId !== null && !shareChain(index, ownerNodeId, entry.node.id))
      continue;
    for (const def of defs) {
      if (matches(def)) return { def, owner: ownerOf(entry) };
    }
  }
  return null;
}

/**
 * 문서 안 노드 조회 (first-wins, page ref 의 descendants 자식 포함) — 가시성 인덱스를 재사용한다.
 * 복사 경계 (`canonicalCopyState.ts`) 가 canonical 노드의 `state` 를 읽을 때 쓴다.
 */
export function findCanonicalNodeById(
  doc: CompositionDocument,
  nodeId: string,
): CanonicalNode | undefined {
  return getIndex(doc).byId.get(nodeId)?.node;
}

/** 문서 안 모든 노드 state 이름 (페이지 · 요소 · descendants) — project 변수 정의 시 예약어 집합 */
export function collectDocumentVariableNames(
  doc: CompositionDocument | null | undefined,
): Set<string> {
  const names = new Set<string>();
  if (!doc) return names;
  for (const entry of getIndex(doc).byId.values()) {
    for (const def of nodeState(entry.node)) names.add(def.name.trim());
  }
  return names;
}
