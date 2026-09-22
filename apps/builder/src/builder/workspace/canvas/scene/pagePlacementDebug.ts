/**
 * ADR-232 — 페이지 배치 dev 디버그 전역.
 *
 * live 하니스가 문서 우선 쓰기 진입점을 그대로 부른다 (Settings 패널 UI 는 Phase 2).
 * `__composition_THEME_ACTIONS__` 와 같은 규약 — dev 빌드에만 등록된다.
 */

import type {
  PageLayoutSettingsDocument,
  PagePlacement,
} from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";

function readPageLayout(): PageLayoutSettingsDocument | undefined {
  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  if (!projectId) return undefined;
  return state.documents.get(projectId)?.pageLayout;
}

export const pagePlacementDebugActions = {
  readPageLayout,
  setPageLayout: (patch: Partial<PageLayoutSettingsDocument>) =>
    useCanonicalDocumentStore.getState().setPageLayout(patch),
  setPagePlacements: (
    entries: Array<{ pageId: string; placement: PagePlacement | null }>,
  ) => useCanonicalDocumentStore.getState().setPagePlacements(entries),
};

if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (
    window as unknown as Record<string, unknown>
  ).__composition_PAGE_PLACEMENT__ = pagePlacementDebugActions;
}
