/**
 * Reusable Layout Actions — Navigator/Properties 가 쓰는 재사용 레이아웃 CRUD facade.
 *
 * ADR-111 P2-a (PR-A): canonical-native 재설계의 첫 단계 (당시 파일명은 frame 계열).
 * ADR-225: Builder 기능 어휘는 Layout, 저장 계약은 canonical FrameNode
 * (`type: "frame"` + `reusable: true`) 그대로 — 이 파일이 그 번역 경계다.
 * Persistence SSOT 는 active canonical document 이다.
 *
 * @see docs/adr/completed/111-layout-frameset-pencil-redesign.md
 * @see docs/adr/225-reusable-layout-vocabulary-alignment.md
 */

import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
} from "@composition/shared";
import { getDB } from "@/lib/db";
import {
  applyDeleteReusableFrameCanonicalPrimary,
  createFrameBodyElement,
} from "@/adapters/canonical/frameLayoutCascade";
import { getReusableFrameMirrorId } from "@/adapters/canonical/frameMirror";
import {
  selectActiveCanonicalDocument,
  useCanonicalDocumentStore,
} from "@/builder/stores/canonical/canonicalDocumentStore";
import {
  getCanonicalReusableLayouts,
  getSelectedReusableLayoutId,
  setSelectedReusableLayoutId,
} from "@/builder/stores/canonical/reusableLayoutStore";
import { getLiveElementsState } from "@/builder/stores/rootStoreAccess";
import type { Element } from "@/types/builder/unified.types";

/**
 * Reusable layout 생성 입력 — canonical-shaped 명명.
 *
 * DB mirror 의 `project_id` 대신 canonical-facing `projectId` 를 받는다.
 */
export interface CreateReusableLayoutInput {
  /** Layout 이름 — 사용자 노출 라벨 */
  name: string;
  /** 소속 project id */
  projectId: string;
  /** 설명 (optional) */
  description?: string;
}

/**
 * Reusable layout 생성 결과.
 *
 * Canonical reusable FrameNode 생성 뒤 UI가 필요한 최소 식별자만 반환한다.
 */
export interface ReusableLayoutRef {
  /** Canonical FrameNode id (현재는 layout id 와 동일) */
  id: string;
  /** Frame 이름 */
  name: string;
}

export interface ReusableLayoutUpdate {
  name?: string;
  description?: string;
  slug?: string;
  notFoundPageId?: string;
  inheritNotFound?: boolean;
}

interface ReusableFrameRecord extends ReusableLayoutRef {
  projectId: string;
  description?: string;
  slug?: string;
  notFoundPageId?: string;
  inheritNotFound?: boolean;
}

async function persistCanonicalDocument(projectId: string): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const doc = canonical.getDocument(projectId);
  if (!doc) return;
  const db = await getDB();
  await db.documents.put(projectId, doc);
}

function createEmptyDocument(): CompositionDocument {
  return { version: "composition-1.0", children: [] };
}

function isReusableFrameNode(node: CanonicalNode): node is FrameNode {
  return node.type === "frame" && (node as FrameNode).reusable === true;
}

function withFrameMetadata(
  frame: FrameNode,
  record: ReusableFrameRecord,
): FrameNode {
  const metadata: FrameNode["metadata"] = {
    ...(frame.metadata ?? { type: "legacy-layout" }),
    type: frame.metadata?.type ?? "legacy-layout",
    layoutId: record.id,
    project_id: record.projectId,
    description: record.description ?? null,
    slug: record.slug ?? null,
    notFoundPageId: record.notFoundPageId ?? null,
    inheritNotFound: record.inheritNotFound ?? true,
  };
  delete (metadata as Record<string, unknown>).order_num;

  return {
    ...frame,
    name: record.name,
    metadata,
  };
}

function elementToCanonicalNode(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: element.type as CanonicalNode["type"],
    name: element.componentName,
    props: { ...element.props },
  };
}

function createReusableFrameNode(
  record: ReusableFrameRecord,
  bodyElement: Element,
): FrameNode {
  return withFrameMetadata(
    {
      id: `layout-${record.id}`,
      type: "frame",
      reusable: true,
      name: record.name,
      children: [elementToCanonicalNode(bodyElement)],
    },
    record,
  );
}

function upsertReusableFrame(frame: FrameNode, projectId: string): void {
  const canonical = useCanonicalDocumentStore.getState();
  const activeProjectId = projectId || canonical.currentProjectId;
  if (!activeProjectId) return;
  const currentDoc =
    canonical.getDocument(activeProjectId) ?? createEmptyDocument();
  const frameId = getReusableFrameMirrorId(frame);
  const nextChildren = [...currentDoc.children];
  const existingIndex = nextChildren.findIndex(
    (node) =>
      isReusableFrameNode(node) && getReusableFrameMirrorId(node) === frameId,
  );

  if (existingIndex >= 0) {
    nextChildren[existingIndex] = frame;
  } else {
    nextChildren.push(frame);
  }

  if (canonical.currentProjectId !== activeProjectId) {
    canonical.setCurrentProject(activeProjectId);
  }
  canonical.setDocument(activeProjectId, {
    ...currentDoc,
    children: nextChildren,
  });
}

/**
 * Reusable layout 생성 — canonical document 에 reusable FrameNode 를 직접 추가한다.
 *
 * @param input - layout 메타데이터
 * @returns 생성된 layout 참조 (canonical FrameNode id)
 * @throws 생성 실패 시 (DB write error 등)
 */
export async function createReusableLayout(
  input: CreateReusableLayoutInput,
): Promise<ReusableLayoutRef> {
  const frameRecord: ReusableFrameRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    projectId: input.projectId,
    description: input.description ?? "",
  };
  const bodyElement = createFrameBodyElement(frameRecord.id);

  const frame = createReusableFrameNode(frameRecord, bodyElement);
  upsertReusableFrame(frame, input.projectId);
  await persistCanonicalDocument(input.projectId);
  setSelectedReusableLayoutId(frameRecord.id);

  return { id: frameRecord.id, name: frameRecord.name };
}

/**
 * Reusable layout 삭제 — canonical-shaped wrapper.
 *
 * canonical frame 제거와 page binding clear를 동일 cascade에서 처리하고
 * 변경된 canonical document를 영속한다.
 *
 * @param frameId - canonical FrameNode id (현재는 layout id 와 동일)
 */
export async function deleteReusableLayout(frameId: string): Promise<void> {
  const { setPages } = getLiveElementsState();
  const layouts = getCanonicalReusableLayouts();

  await applyDeleteReusableFrameCanonicalPrimary({
    frameId,
    layouts,
    getElementsState: getLiveElementsState,
    setPages,
  });
  getLiveElementsState()._rebuildIndexes();
  const projectId = useCanonicalDocumentStore.getState().currentProjectId;
  if (projectId) {
    await persistCanonicalDocument(projectId);
  }

  if (getSelectedReusableLayoutId() === frameId) {
    setSelectedReusableLayoutId(null);
  }
}

/**
 * Reusable layout 이름 업데이트 — canonical-shaped wrapper.
 *
 * canonical FrameNode를 직접 갱신한다.
 *
 * @param frameId - canonical FrameNode id
 * @param name - 새 이름
 */
export async function updateReusableLayoutName(
  frameId: string,
  name: string,
): Promise<void> {
  await updateReusableLayout(frameId, { name });
}

export async function updateReusableLayout(
  frameId: string,
  updates: ReusableLayoutUpdate,
): Promise<void> {
  const currentLayouts = getCanonicalReusableLayouts();
  const activeProjectId = useCanonicalDocumentStore.getState().currentProjectId;
  const sourceSummary = currentLayouts.find((layout) => layout.id === frameId);
  const currentDoc = selectActiveCanonicalDocument();
  const existingFrame = currentDoc?.children.find(
    (node): node is FrameNode =>
      isReusableFrameNode(node) && getReusableFrameMirrorId(node) === frameId,
  );
  const existingMetadata = existingFrame?.metadata as
    Record<string, unknown> | undefined;
  const projectId = sourceSummary?.project_id || activeProjectId || "";
  const nextRecord: ReusableFrameRecord = {
    id: frameId,
    name:
      updates.name ?? existingFrame?.name ?? sourceSummary?.name ?? "Layout",
    projectId,
    description:
      updates.description ??
      (typeof existingMetadata?.description === "string"
        ? existingMetadata.description
        : sourceSummary?.description),
    slug:
      updates.slug ??
      (typeof existingMetadata?.slug === "string"
        ? existingMetadata.slug
        : sourceSummary?.slug),
    notFoundPageId:
      updates.notFoundPageId ??
      (typeof existingMetadata?.notFoundPageId === "string"
        ? existingMetadata.notFoundPageId
        : undefined),
    inheritNotFound:
      updates.inheritNotFound ??
      (typeof existingMetadata?.inheritNotFound === "boolean"
        ? existingMetadata.inheritNotFound
        : undefined),
  };
  const nextFrame = withFrameMetadata(
    existingFrame ?? {
      id: `layout-${frameId}`,
      type: "frame",
      reusable: true,
      name: nextRecord.name,
      children: [],
    },
    nextRecord,
  );

  upsertReusableFrame(nextFrame, projectId);
  if (projectId) {
    await persistCanonicalDocument(projectId);
  }
}

/**
 * Reusable layout 선택 — Builder UI selection state.
 *
 * 내부 구현: `selectedReusableLayoutId` 갱신.
 *
 * @param frameId - 선택할 layout (canonical FrameNode) id, 또는 `null` (선택 해제)
 */
export function selectReusableLayout(frameId: string | null): void {
  setSelectedReusableLayoutId(frameId);
}

/**
 * 새 reusable layout 의 unique 한 default 이름 생성.
 *
 * `Layout N` 패턴의 기존 이름들을 분석하여 미사용 번호 중 가장 작은 값 사용.
 * 이전 패턴 (`Layout ${layouts.length + 1}`) 의 중복 위험 제거 — layout 삭제 후
 * 추가하거나 IDB 잔존 데이터 + 메모리 length mismatch 시 발생하는 충돌 방지.
 *
 * 동작:
 * - 빈 목록: `Layout 1`
 * - `["Layout 1", "Layout 2"]`: `Layout 3`
 * - `["Layout 1", "Layout 3"]`: `Layout 2` (gap 채움)
 * - `["Layout 2"]`: `Layout 1` (시작 gap 채움)
 * - `["My Custom"]`: `Layout 1` (`Layout N` 패턴 아닌 이름은 무시)
 * - `["Layout 1", "My Custom", "Layout 3"]`: `Layout 2`
 *
 * @param existingLayouts - 현재 layout 목록 (id 와 name 만 사용)
 * @returns 새 layout 의 사용자 노출 default 이름 (예: `Layout 4`)
 */
export function getNextLayoutName(
  existingLayouts: ReadonlyArray<{ name: string }>,
): string {
  const usedNumbers = new Set<number>();
  const pattern = /^Layout (\d+)$/;
  for (const layout of existingLayouts) {
    const match = pattern.exec(layout.name);
    if (match) {
      usedNumbers.add(Number(match[1]));
    }
  }
  let n = 1;
  while (usedNumbers.has(n)) {
    n++;
  }
  return `Layout ${n}`;
}
