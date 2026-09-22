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
import {
  setPagePlacementModelDerived,
  setPagePlacementModelLegacy,
} from "../../../stores/utils/pagePlacementCommit";

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
  /** 레거시 문서 재현용 — 저장 좌표 직접 쓰기 (하니스 전용, dev). */
  setPagePositions: (
    entries: Array<{
      pageId: string;
      breakpoint: string;
      position: { x: number; y: number } | null;
    }>,
  ) =>
    useCanonicalDocumentStore
      .getState()
      .setPagePositions(
        entries as Parameters<
          ReturnType<
            typeof useCanonicalDocumentStore.getState
          >["setPagePositions"]
        >[0],
      ),
  /** 레거시 문서 재현용 — `placementModel` 제거 (하니스 전용, dev). */
  clearPlacementModel: () =>
    useCanonicalDocumentStore
      .getState()
      .setPageLayout({ placementModel: undefined }),
  /** ADR-232 Decision 7 — 복귀 · 재이관 (Settings 숨김 항목과 같은 진입점). */
  setPlacementModelLegacy: () => setPagePlacementModelLegacy(),
  setPlacementModelDerived: () => setPagePlacementModelDerived(),
};

if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (
    window as unknown as Record<string, unknown>
  ).__composition_PAGE_PLACEMENT__ = pagePlacementDebugActions;
}
