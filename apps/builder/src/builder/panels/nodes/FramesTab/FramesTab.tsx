/**
 * FramesTab
 *
 * ADR-903 P3-C: LayoutsTab → FramesTab 재설계.
 * Canonical reusable frame 목록 표시 + Element 트리.
 *
 * P3-C 변경 사항:
 * - frame 목록: canonical reusable frame surface
 * - frame selection: `selectedReusableFrameId` (canonical selector)
 * - frame 생성: canonical document mutation + DB persistence mirror
 * - UI 레이블: "Layouts" → "Frames"
 *
 * @deprecated-path legacy layout selection direct access 제거됨. `selectedReusableFrameId` 사용.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { FrameList } from "./FrameList";
import { FrameElementTree } from "./FrameElementTree";
import {
  useCanonicalReusableFrameLayouts,
  useSelectedReusableFrameId,
} from "../../../stores/canonical/canonicalFrameStore";
import {
  createReusableFrame,
  deleteReusableFrame,
  selectReusableFrame,
  getNextFrameName,
} from "../../../stores/utils/frameActions";
import { useEditModeStore } from "../../../stores/editMode";
import { useStore } from "../../../stores";
import {
  useCanonicalElements,
  useCanonicalFrameElementScopes,
} from "../../../stores/canonical/canonicalElementsView";
// ADR-916 Phase 3 G4 — mutation reverse wrapper (D18=A 정합)
import { mergeElementsCanonicalPrimary } from "@/adapters/canonical/canonicalMutations";
import {
  collectHydratedFrameElements,
  hasHydratedFrameElements,
  loadFrameElements,
} from "../../../../adapters/canonical/frameElementLoader";
import type { CanonicalFrameElementScope } from "../../../../adapters/canonical/frameElementScope";
import { ElementProps } from "../../../../types/integrations/supabase.types";
import { Element } from "../../../../types/core/store.types";
import { buildTreeFromElements } from "../../../utils/treeUtils";
import { MessageService } from "../../../../utils/messaging";
import { getDB } from "../../../../lib/db";
import { useTreeExpandState } from "@/builder/hooks";
import {
  isWebGLCanvas,
  isCanvasCompareMode,
} from "../../../../utils/featureFlags";

function collectCanonicalFrameElements(
  canonicalElements: Element[] | null,
  frameScope: CanonicalFrameElementScope | null,
): Element[] {
  if (!canonicalElements || !frameScope) return [];
  return canonicalElements.filter((element) =>
    frameScope.elementIds.has(element.id),
  );
}

function hasCanonicalFrameElements(
  canonicalElements: Element[] | null,
  frameScope: CanonicalFrameElementScope | null,
): boolean {
  return (
    collectCanonicalFrameElements(canonicalElements, frameScope).length > 0
  );
}

function findFrameBodyElement(elements: Element[]): Element | null {
  return (
    elements.find((element) => element.type === "body") ??
    elements.find((element) => element.order_num === 0) ??
    null
  );
}

interface FramesTabProps {
  selectedElementId: string | null;
  setSelectedElement: (elementId: string | null, props?: ElementProps) => void;
  sendElementSelectedMessage: (elementId: string, props: ElementProps) => void;
  requestAutoSelectAfterUpdate: (elementId: string) => void;
  projectId?: string;
}

export function FramesTab({
  selectedElementId,
  setSelectedElement,
  sendElementSelectedMessage,
  requestAutoSelectAfterUpdate,
  projectId: projectIdProp,
}: FramesTabProps) {
  const { projectId: projectIdFromParams } = useParams<{ projectId: string }>();
  const projectId = projectIdProp || projectIdFromParams;

  // canonical selector: selectedReusableFrameId
  const selectedReusableFrameId = useSelectedReusableFrameId();

  const layouts = useCanonicalReusableFrameLayouts();

  // Edit Mode store
  const setEditModeLayoutId = useEditModeStore(
    (state) => state.setCurrentLayoutId,
  );

  // ADR-040: elementsMap O(1) 조회
  const elementsMap = useStore((state) => state.elementsMap);
  const removeElement = useStore((state) => state.removeElement);
  const canonicalElements = useCanonicalElements();
  const frameElementScopes = useCanonicalFrameElementScopes();

  // ADR-916 projection 제거: active canonical document 의 reusable FrameNode 를
  // 단일 read path 로 사용한다.
  const reusableFrames = useMemo<
    ReadonlyArray<{ id: string; name: string }>
  >(() => {
    return layouts.map((layout) => ({ id: layout.id, name: layout.name }));
  }, [layouts]);

  // selectedReusableFrameId 기반 현재 프레임 조회
  const currentFrame = useMemo(() => {
    const projectedFrame =
      reusableFrames.find((f) => f.id === selectedReusableFrameId) || null;
    if (projectedFrame || !selectedReusableFrameId) {
      return projectedFrame;
    }

    return { id: selectedReusableFrameId, name: "" };
  }, [reusableFrames, selectedReusableFrameId]);

  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();

  // 이미 로드된 frame ID 추적 (중복 로드 방지)
  const loadedFrameIdsRef = React.useRef<Set<string>>(new Set());
  const loadingFrameIdsRef = React.useRef<Set<string>>(new Set());
  const frameSelectRequestRef = React.useRef(0);
  const autoSelectedFrameIdRef = React.useRef<string | null>(null);

  // selectedReusableFrameId 변경 시 DB에서 요소 로드 (fallback)
  useEffect(() => {
    if (!selectedReusableFrameId) return;

    if (
      loadedFrameIdsRef.current.has(selectedReusableFrameId) ||
      loadingFrameIdsRef.current.has(selectedReusableFrameId)
    ) {
      return;
    }

    const selectedFrameScope =
      frameElementScopes?.get(selectedReusableFrameId) ?? null;
    if (
      hasCanonicalFrameElements(canonicalElements, selectedFrameScope) ||
      (selectedFrameScope &&
        hasHydratedFrameElements(elementsMap, selectedFrameScope))
    ) {
      loadedFrameIdsRef.current.add(selectedReusableFrameId);
      return;
    }

    const loadSelectedFrameElements = async () => {
      loadingFrameIdsRef.current.add(selectedReusableFrameId);
      try {
        const db = await getDB();
        const frameElements = await loadFrameElements(
          db,
          selectedReusableFrameId,
        );
        if (frameElements.length > 0) {
          mergeElementsCanonicalPrimary(frameElements);
          loadedFrameIdsRef.current.add(selectedReusableFrameId);
        }
      } catch (error) {
        console.error("[FramesTab] Frame 요소 로드 실패:", error);
      } finally {
        loadingFrameIdsRef.current.delete(selectedReusableFrameId);
      }
    };

    loadSelectedFrameElements();
  }, [
    selectedReusableFrameId,
    elementsMap,
    canonicalElements,
    frameElementScopes,
  ]);

  // 새로고침 직후 전역 hydrate race 로 selected frame 이외의 body/slot 이
  // 메모리에 없을 수 있다. Frames 탭 목록이 로드되면 등록된 frame 전체 중
  // 아직 store 에 없는 frame elements 를 보강 로드해 tree/canvas 입력을 맞춘다.
  useEffect(() => {
    if (reusableFrames.length === 0) return;

    const missingFrameIds = reusableFrames
      .map((frame) => frame.id)
      .filter((frameId) => {
        const frameScope = frameElementScopes?.get(frameId) ?? null;
        return (
          !loadedFrameIdsRef.current.has(frameId) &&
          !loadingFrameIdsRef.current.has(frameId) &&
          !hasCanonicalFrameElements(canonicalElements, frameScope) &&
          (!frameScope || !hasHydratedFrameElements(elementsMap, frameScope))
        );
      });

    for (const frame of reusableFrames) {
      const frameScope = frameElementScopes?.get(frame.id) ?? null;
      if (
        hasCanonicalFrameElements(canonicalElements, frameScope) ||
        (frameScope && hasHydratedFrameElements(elementsMap, frameScope))
      ) {
        loadedFrameIdsRef.current.add(frame.id);
      }
    }

    if (missingFrameIds.length === 0) return;

    missingFrameIds.forEach((frameId) =>
      loadingFrameIdsRef.current.add(frameId),
    );

    const loadMissingFrameElements = async () => {
      try {
        const db = await getDB();
        const frameElementGroups = await Promise.all(
          missingFrameIds.map(async (frameId) => ({
            frameId,
            elements: await loadFrameElements(db, frameId),
          })),
        );
        const liveFrameIds = new Set(reusableFrames.map((frame) => frame.id));
        const liveFrameElementGroups = frameElementGroups.filter((group) =>
          liveFrameIds.has(group.frameId),
        );

        const frameElements = liveFrameElementGroups.flatMap(
          (group) => group.elements,
        );
        if (frameElements.length > 0) {
          mergeElementsCanonicalPrimary(frameElements);
        }

        liveFrameElementGroups.forEach((group) => {
          if (group.elements.length > 0) {
            loadedFrameIdsRef.current.add(group.frameId);
          }
        });
      } catch (error) {
        console.error("[FramesTab] Frame 요소 보강 로드 실패:", error);
      } finally {
        missingFrameIds.forEach((frameId) =>
          loadingFrameIdsRef.current.delete(frameId),
        );
      }
    };

    loadMissingFrameElements();
  }, [reusableFrames, elementsMap, canonicalElements, frameElementScopes]);

  // ADR-916: Frames tree read path 는 active canonical document 를 우선 사용한다.
  // canonical hydration race 동안에만 legacy store mirror 로 fallback 한다.
  const frameElements = useMemo(() => {
    if (!currentFrame) return [];
    const frameScope = frameElementScopes?.get(currentFrame.id) ?? null;
    const canonicalFrameElements = collectCanonicalFrameElements(
      canonicalElements,
      frameScope,
    );
    return canonicalFrameElements.length > 0
      ? canonicalFrameElements
      : frameScope
        ? collectHydratedFrameElements(elementsMap, frameScope)
        : [];
  }, [canonicalElements, elementsMap, currentFrame, frameElementScopes]);

  // Frame 요소 트리 빌드
  const frameElementTree = useMemo(() => {
    return buildTreeFromElements(frameElements);
  }, [frameElements]);

  // Frame 전용 트리 펼치기/접기 상태
  const {
    expandedKeys,
    toggleKey,
    collapseAll: collapseFrameTree,
    expandKey,
  } = useTreeExpandState({
    selectedElementId,
    elements: frameElements,
  });

  // Frame 전환 시 body 자동 펼치기 + 선택
  const prevFrameIdRef = React.useRef<string | null>(null);
  const bodyAutoSelectedRef = React.useRef<boolean>(false);

  const selectFrameBody = useCallback(
    (frameId: string): boolean => {
      const frameScope = frameElementScopes?.get(frameId) ?? null;
      const canonicalFrameElements = collectCanonicalFrameElements(
        canonicalElements,
        frameScope,
      );
      const elementsForFrame =
        canonicalFrameElements.length > 0
          ? canonicalFrameElements
          : frameScope
            ? collectHydratedFrameElements(elementsMap, frameScope)
            : [];
      const bodyElement = findFrameBodyElement(elementsForFrame);
      if (!bodyElement) return false;

      expandKey(bodyElement.id);
      setSelectedElement(bodyElement.id, bodyElement.props as ElementProps);
      requestAutoSelectAfterUpdate(bodyElement.id);
      const schedule =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (callback: FrameRequestCallback) => {
              callback(0);
              return 0;
            };
      schedule(() =>
        sendElementSelectedMessage(
          bodyElement.id,
          bodyElement.props as ElementProps,
        ),
      );
      bodyAutoSelectedRef.current = true;
      return true;
    },
    [
      canonicalElements,
      elementsMap,
      expandKey,
      frameElementScopes,
      requestAutoSelectAfterUpdate,
      sendElementSelectedMessage,
      setSelectedElement,
    ],
  );

  useEffect(() => {
    const frameChanged = currentFrame?.id !== prevFrameIdRef.current;

    if (frameChanged && currentFrame?.id) {
      collapseFrameTree();
      prevFrameIdRef.current = currentFrame.id;
      bodyAutoSelectedRef.current = false;
    }

    if (
      currentFrame &&
      frameElements.length > 0 &&
      !bodyAutoSelectedRef.current
    ) {
      selectFrameBody(currentFrame.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrame?.id, frameElements, collapseFrameTree, selectFrameBody]);

  // Frame 선택 핸들러 — id 기반 (ADR-911 P2-a PR-B)
  const handleSelectFrame = useCallback(
    async (frameId: string) => {
      const requestId = frameSelectRequestRef.current + 1;
      frameSelectRequestRef.current = requestId;
      selectReusableFrame(frameId);
      setEditModeLayoutId(frameId);
      selectFrameBody(frameId);

      const frameScope = frameElementScopes?.get(frameId) ?? null;
      if (
        hasCanonicalFrameElements(canonicalElements, frameScope) ||
        (frameScope && hasHydratedFrameElements(elementsMap, frameScope))
      ) {
        loadedFrameIdsRef.current.add(frameId);
        return;
      }
      if (loadingFrameIdsRef.current.has(frameId)) {
        return;
      }
      loadingFrameIdsRef.current.add(frameId);

      try {
        const db = await getDB();
        const frameElements = await loadFrameElements(db, frameId);
        if (requestId !== frameSelectRequestRef.current) {
          return;
        }

        if (frameElements.length > 0) {
          mergeElementsCanonicalPrimary(frameElements);
          loadedFrameIdsRef.current.add(frameId);
        }
      } catch (error) {
        if (requestId !== frameSelectRequestRef.current) {
          return;
        }
        console.error("[FramesTab] Frame 선택 에러:", error);
      } finally {
        loadingFrameIdsRef.current.delete(frameId);
      }
    },
    [
      setEditModeLayoutId,
      selectFrameBody,
      elementsMap,
      canonicalElements,
      frameElementScopes,
    ],
  );

  useEffect(() => {
    const firstFrameId = reusableFrames[0]?.id ?? null;
    if (!firstFrameId) {
      autoSelectedFrameIdRef.current = null;
      return;
    }

    const hasValidSelection = Boolean(
      selectedReusableFrameId &&
      reusableFrames.some((frame) => frame.id === selectedReusableFrameId),
    );
    if (hasValidSelection) {
      autoSelectedFrameIdRef.current = null;
      return;
    }

    if (autoSelectedFrameIdRef.current === firstFrameId) return;
    autoSelectedFrameIdRef.current = firstFrameId;
    void handleSelectFrame(firstFrameId);
  }, [handleSelectFrame, reusableFrames, selectedReusableFrameId]);

  // Frame 삭제 핸들러 — frameActions.deleteReusableFrame 위임
  const handleDeleteFrame = useCallback(
    async (frameId: string) => {
      try {
        await deleteReusableFrame(frameId);
        const remaining = reusableFrames.filter((f) => f.id !== frameId);
        if (remaining.length > 0) {
          handleSelectFrame(remaining[0].id);
        } else {
          selectReusableFrame(null);
          setEditModeLayoutId(null);
        }
      } catch (error) {
        console.error("[FramesTab] Frame 삭제 에러:", error);
      }
    },
    [reusableFrames, handleSelectFrame, setEditModeLayoutId],
  );

  // 새 Frame 생성 핸들러 — frameActions.createReusableFrame 위임.
  // unique 한 default 이름은 getNextFrameName 으로 안정 생성 — 이전 패턴
  // (`Frame ${reusableFrames.length + 1}`) 의 중복 위험 제거 (delete 후 add 또는
  // IDB 잔존 데이터 + 메모리 length mismatch 시 충돌 방지).
  const handleAddFrame = useCallback(async () => {
    if (!projectId) {
      console.error("[FramesTab] 프로젝트 ID가 없습니다");
      return;
    }
    try {
      const ref = await createReusableFrame({
        name: getNextFrameName(reusableFrames),
        projectId,
      });
      await handleSelectFrame(ref.id);
    } catch (error) {
      console.error("[FramesTab] Frame 생성 에러:", error);
    }
  }, [projectId, reusableFrames, handleSelectFrame]);

  // Element 삭제 핸들러
  const handleDeleteElement = useCallback(
    async (el: Element) => {
      await removeElement(el.id);
      if (el.id === selectedElementId) {
        setSelectedElement(null);
        if (!isWebGLOnly) {
          MessageService.clearOverlay();
        }
      }
    },
    [removeElement, selectedElementId, setSelectedElement, isWebGLOnly],
  );

  return (
    <div
      className="layouts-tab"
      role="tabpanel"
      id="tabpanel-frames"
      aria-label="Frames"
    >
      {/* Frames List — ADR-911 P2 PR-D 추출 */}
      <FrameList
        frames={reusableFrames}
        selectedFrameId={currentFrame?.id ?? null}
        onSelect={handleSelectFrame}
        onDelete={handleDeleteFrame}
        onAdd={handleAddFrame}
      />

      {/* Frame Element Tree — ADR-911 P2 PR-D2 추출 */}
      <FrameElementTree
        tree={frameElementTree}
        frameId={currentFrame?.id ?? null}
        selectedElementId={selectedElementId}
        expandedKeys={expandedKeys}
        toggleKey={toggleKey}
        onCollapseAll={collapseFrameTree}
        onElementClick={(el) => {
          setSelectedElement(el.id, el.props as ElementProps);
          requestAnimationFrame(() =>
            sendElementSelectedMessage(el.id, el.props as ElementProps),
          );
        }}
        onElementDelete={handleDeleteElement}
      />
    </div>
  );
}

export default FramesTab;
