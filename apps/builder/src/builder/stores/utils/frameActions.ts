/**
 * Frame Actions — canonical-shaped wrapper API for reusable frame CRUD.
 *
 * ADR-111 P2-a (PR-A): canonical-native FramesTab 재설계의 첫 단계.
 *
 * 본 모듈은 canonical FrameNode (`type: "frame"` + `reusable: true`) 의미를
 * 가진 reusable frame CRUD API를 제공한다. Persistence SSOT 는 active canonical
 * document 이다.
 *
 * @see docs/adr/111-layout-frameset-pencil-redesign.md
 * @see docs/adr/design/111-layout-frameset-pencil-redesign-breakdown.md
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
import { legacyLayoutToCanonicalFrame } from "@/adapters/canonical/slotAndLayoutAdapter";
import {
  selectActiveCanonicalDocument,
  useCanonicalDocumentStore,
} from "@/builder/stores/canonical/canonicalDocumentStore";
import {
  getCanonicalReusableFrameLayouts,
  getSelectedReusableFrameId,
  setSelectedReusableFrameId,
} from "@/builder/stores/canonical/canonicalFrameStore";
import { getLiveElementsState } from "@/builder/stores/rootStoreAccess";
import type { Layout, LayoutUpdate } from "@/types/builder/layout.types";
import type { Element } from "@/types/builder/unified.types";

/**
 * Reusable frame 생성 입력 — canonical-shaped 명명.
 *
 * DB mirror 의 `project_id` 대신 canonical-facing `projectId` 를 받는다.
 */
export interface CreateReusableFrameInput {
  /** Frame 이름 — 사용자 노출 라벨 */
  name: string;
  /** 소속 project id */
  projectId: string;
  /** 설명 (optional) */
  description?: string;
}

/**
 * Reusable frame 생성 결과.
 *
 * P2 scope 동안 내부 구현은 legacy `Layout` 그대로 반환 — 하지만 consumer 는
 * canonical 의미 (`reusable: true` FrameNode 와 동일 식별자)로 사용해야 한다.
 *
 * P3 이후 반환 타입을 `FrameNode` 로 전환 예정.
 */
export interface ReusableFrameRef {
  /** Canonical FrameNode id (현재는 layout id 와 동일) */
  id: string;
  /** Frame 이름 */
  name: string;
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

function withLayoutMetadata(frame: FrameNode, layout: Layout): FrameNode {
  const metadata: FrameNode["metadata"] = {
    ...(frame.metadata ?? { type: "legacy-layout" }),
    type: frame.metadata?.type ?? "legacy-layout",
    layoutId: layout.id,
    project_id: layout.project_id,
    description: layout.description ?? null,
    slug: layout.slug ?? null,
  };
  delete (metadata as Record<string, unknown>).order_num;

  return {
    ...frame,
    name: layout.name,
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
  layout: Layout,
  bodyElement: Element,
): FrameNode {
  return withLayoutMetadata(
    {
      id: `layout-${layout.id}`,
      type: "frame",
      reusable: true,
      name: layout.name,
      children: [elementToCanonicalNode(bodyElement)],
    },
    layout,
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
 * Reusable frame 생성 — canonical document 에 reusable FrameNode 를 직접 추가한다.
 *
 * @param input - frame 메타데이터
 * @returns 생성된 frame 참조 (P3 이후 `FrameNode` 로 전환)
 * @throws 생성 실패 시 (DB write error 등)
 */
export async function createReusableFrame(
  input: CreateReusableFrameInput,
): Promise<ReusableFrameRef> {
  const now = new Date().toISOString();
  const layout: Layout = {
    id: crypto.randomUUID(),
    name: input.name,
    project_id: input.projectId,
    description: input.description ?? "",
    created_at: now,
    updated_at: now,
  };
  const bodyElement = createFrameBodyElement(layout.id);

  const frame = createReusableFrameNode(layout, bodyElement);
  upsertReusableFrame(frame, input.projectId);
  await persistCanonicalDocument(input.projectId);
  setSelectedReusableFrameId(layout.id);

  return { id: layout.id, name: layout.name };
}

/**
 * Reusable frame 삭제 — canonical-shaped wrapper.
 *
 * 내부 구현: legacy `deleteLayout` 호출. canonical frame 제거와 page binding clear 는
 * layoutAction 의 canonical cascade adapter 에서 처리한다.
 * cascade (page frame binding clear + element 삭제) 도 frame action 내부에서 처리.
 *
 * @param frameId - canonical FrameNode id (현재는 layout id 와 동일)
 */
export async function deleteReusableFrame(frameId: string): Promise<void> {
  const { setPages, setElements } = getLiveElementsState();
  const layouts = getCanonicalReusableFrameLayouts();

  await applyDeleteReusableFrameCanonicalPrimary({
    frameId,
    layouts,
    getElementsState: getLiveElementsState,
    setPages,
    setElements,
  });
  const projectId = useCanonicalDocumentStore.getState().currentProjectId;
  if (projectId) {
    await persistCanonicalDocument(projectId);
  }

  if (getSelectedReusableFrameId() === frameId) {
    setSelectedReusableFrameId(null);
  }
}

/**
 * Reusable frame 이름 업데이트 — canonical-shaped wrapper.
 *
 * 내부 구현: legacy `updateLayout` 호출.
 *
 * @param frameId - canonical FrameNode id
 * @param name - 새 이름
 */
export async function updateReusableFrameName(
  frameId: string,
  name: string,
): Promise<void> {
  await updateReusableFrame(frameId, { name });
}

export async function updateReusableFrame(
  frameId: string,
  updates: LayoutUpdate,
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const currentLayouts = getCanonicalReusableFrameLayouts();
  const activeProjectId = useCanonicalDocumentStore.getState().currentProjectId;
  const sourceLayout =
    currentLayouts.find((layout) => layout.id === frameId) ??
    ({
      id: frameId,
      name: updates.name ?? "Frame",
      project_id: activeProjectId ?? "",
      description: "",
      created_at: updatedAt,
      updated_at: updatedAt,
    } satisfies Layout);
  const nextLayout: Layout = {
    ...sourceLayout,
    ...updates,
    project_id: sourceLayout.project_id || activeProjectId || "",
    updated_at: updatedAt,
  };
  const currentDoc = selectActiveCanonicalDocument();
  const existingFrame = currentDoc?.children.find(
    (node): node is FrameNode =>
      isReusableFrameNode(node) && getReusableFrameMirrorId(node) === frameId,
  );
  const nextFrame = withLayoutMetadata(
    existingFrame ?? legacyLayoutToCanonicalFrame(nextLayout, []),
    nextLayout,
  );

  upsertReusableFrame(nextFrame, nextLayout.project_id);
  if (nextLayout.project_id) {
    await persistCanonicalDocument(nextLayout.project_id);
  }
}

/**
 * Reusable frame 선택 (canonical semantic).
 *
 * 내부 구현: `selectedReusableFrameId` 갱신.
 *
 * @param frameId - 선택할 frame id, 또는 `null` (선택 해제)
 */
export function selectReusableFrame(frameId: string | null): void {
  setSelectedReusableFrameId(frameId);
}

/**
 * 새 reusable frame 의 unique 한 default 이름 생성.
 *
 * `Frame N` 패턴의 기존 이름들을 분석하여 미사용 번호 중 가장 작은 값 사용.
 * 이전 패턴 (`Frame ${frames.length + 1}`) 의 중복 위험 제거 — frame 삭제 후
 * 추가하거나 IDB 잔존 데이터 + 메모리 length mismatch 시 발생하는 충돌 방지.
 *
 * 동작:
 * - 빈 목록: `Frame 1`
 * - `["Frame 1", "Frame 2"]`: `Frame 3`
 * - `["Frame 1", "Frame 3"]`: `Frame 2` (gap 채움)
 * - `["Frame 2"]`: `Frame 1` (시작 gap 채움)
 * - `["My Custom"]`: `Frame 1` (`Frame N` 패턴 아닌 이름은 무시)
 * - `["Frame 1", "My Custom", "Frame 3"]`: `Frame 2`
 *
 * @param existingFrames - 현재 frame 목록 (id 와 name 만 사용)
 * @returns 새 frame 의 default 이름 (예: `Frame 4`)
 */
export function getNextFrameName(
  existingFrames: ReadonlyArray<{ name: string }>,
): string {
  const usedNumbers = new Set<number>();
  const pattern = /^Frame (\d+)$/;
  for (const frame of existingFrames) {
    const match = pattern.exec(frame.name);
    if (match) {
      usedNumbers.add(Number(match[1]));
    }
  }
  let n = 1;
  while (usedNumbers.has(n)) {
    n++;
  }
  return `Frame ${n}`;
}
