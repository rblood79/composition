/**
 * 빌더 → 대시보드 프로젝트 삭제 요청 (router location state).
 *
 * 열린 프로젝트를 빌더 안에서 지우지 않는다 — 구 canonical 저장의 persist 가
 * fire-and-forget 이라 삭제 뒤 편집이 문서를 다시 써 넣던 때 정한 규칙이고, catalog
 * Builder 도 삭제 구현을 대시보드 한 곳에 둔다. 빌더는 확인만 받고 이 state 를 들고 대시보드로 나가며, 빌더가
 * 언마운트된 뒤 대시보드가 기존 삭제 mutation 으로 지운다 (삭제 구현은 한 곳).
 */

const PENDING_DELETE_KEY = "deleteProjectId";

export function buildPendingProjectDeleteState(projectId: string): {
  [PENDING_DELETE_KEY]: string;
} {
  return { [PENDING_DELETE_KEY]: projectId };
}

export function readPendingProjectDeleteId(state: unknown): string | null {
  if (typeof state !== "object" || state === null) return null;
  const id = (state as Record<string, unknown>)[PENDING_DELETE_KEY];
  return typeof id === "string" && id.length > 0 ? id : null;
}
