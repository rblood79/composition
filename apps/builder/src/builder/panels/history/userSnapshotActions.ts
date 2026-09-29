/**
 * 사용자 스냅샷 만들기 — History 패널 헤더 버튼과 전체 메뉴 (ADR-249 §2-4) 가 같이
 * 부른다. 상한 판정과 생성이 한 곳에 있어야 두 표면이 어긋나지 않는다.
 */
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { snapshotManager } from "../../stores/history/snapshots";

/** 지금 스냅샷을 만들 수 있는 프로젝트 id — 문서가 없거나 user 상한이면 null. */
export function resolveUserSnapshotTarget(): string | null {
  const { currentProjectId, documents } = useCanonicalDocumentStore.getState();
  if (!currentProjectId || !documents.has(currentProjectId)) return null;
  return snapshotManager.canCreateUserSnapshot(currentProjectId)
    ? currentProjectId
    : null;
}

/**
 * 목록 hydrate 를 기다린 뒤 만든다 — 패널을 한 번도 열지 않은 세션에서 메뉴로 만들면
 * IndexedDB 목록이 아직 비어 있어 상한 판정이 빗나간다.
 */
export async function createUserSnapshot(projectId: string): Promise<void> {
  await snapshotManager.loadProject(projectId);
  const doc = useCanonicalDocumentStore.getState().documents.get(projectId);
  if (!doc) return;
  try {
    await snapshotManager.createSnapshot({ projectId, doc, kind: "user" });
  } catch (error) {
    // 상한 도달 — 호출 표면이 비활성으로 선차단하므로 방어적 처리만
    console.warn("[snapshot] 스냅샷 생성 차단:", error);
  }
}
