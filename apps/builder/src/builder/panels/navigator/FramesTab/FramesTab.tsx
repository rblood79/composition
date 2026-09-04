/**
 * FramesTab
 *
 * ADR-903 P3-C: LayoutsTab → FramesTab 재설계.
 * Canonical reusable frame 목록 표시 + frame node 트리.
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
import { useParams } from "react-router";
import { FrameList } from "./FrameList";
import { FrameElementTree } from "./FrameElementTree";
import { SectionSplitStack } from "../../../components";
import { useI18n } from "@/i18n";
import {
  NAVIGATOR_SECTION_IDS,
  NAVIGATOR_SPLIT_STORAGE_KEYS,
} from "../navigatorSectionIds";
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
import { useCanonicalFrameElementScopes } from "../../../stores/canonical/canonicalElementsView";
import { useCanonicalPanelElements } from "../useCanonicalPanelElements";
import type { CanonicalFrameElementScope } from "../../../../adapters/canonical/frameElementScope";
import type { ElementProps } from "../../../../types/integrations/supabase.types";
import type { PanelNode } from "../../panelNode";
import { buildTreeFromElements } from "../../../utils/treeUtils";
import { MessageService } from "../../../../utils/messaging";
import { useTreeExpandState } from "@/builder/hooks";
import {
  isWebGLCanvas,
  isCanvasCompareMode,
} from "../../../../utils/featureFlags";

type LegacyFrameElement = Parameters<typeof buildTreeFromElements>[0][number];

function collectCanonicalFrameElements(
  canonicalElements: readonly PanelNode[] | null,
  frameScope: CanonicalFrameElementScope | null,
): PanelNode[] {
  if (!canonicalElements || !frameScope) return [];
  return canonicalElements.filter((element) =>
    frameScope.elementIds.has(element.id),
  );
}

function findFrameBodyElement(
  elements: readonly PanelNode[],
): PanelNode | null {
  return (
    elements.find((element) => element.type.toLowerCase() === "body") ??
    elements[0] ??
    null
  );
}

function toLegacyFrameElement(element: PanelNode): LegacyFrameElement {
  return {
    ...element,
    customId: element.customId ?? undefined,
    componentName: element.componentName ?? undefined,
  };
}

interface FramesTabProps {
  selectedElementId: string | null;
  setSelectedElement: (elementId: string | null, props?: ElementProps) => void;
  sendElementSelectedMessage: (elementId: string, props: ElementProps) => void;
  projectId?: string;
}

export function FramesTab({
  selectedElementId,
  setSelectedElement,
  sendElementSelectedMessage,
  projectId: projectIdProp,
}: FramesTabProps) {
  const { t } = useI18n();
  const { projectId: projectIdFromParams } = useParams<{ projectId: string }>();
  const projectId = projectIdProp || projectIdFromParams;

  // canonical selector: selectedReusableFrameId
  const selectedReusableFrameId = useSelectedReusableFrameId();

  const layouts = useCanonicalReusableFrameLayouts();

  // Edit Mode store
  const setEditModeLayoutId = useEditModeStore(
    (state) => state.setCurrentLayoutId,
  );

  const removeElement = useStore((state) => state.removeElement);
  const canonicalElements = useCanonicalPanelElements();
  const frameElementScopes = useCanonicalFrameElementScopes();

  // ADR-116 projection 제거: active canonical document 의 reusable FrameNode 를
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

  const autoSelectedFrameIdRef = React.useRef<string | null>(null);

  // Frames tree는 canonical document가 가진 frame scope만 읽는다. Builder chrome은
  // matching canonical 첫 frame 전까지 숨겨지므로 legacy hydration fallback이 없다.
  const frameElements = useMemo(() => {
    if (!currentFrame) return [];
    const frameScope = frameElementScopes?.get(currentFrame.id) ?? null;
    return collectCanonicalFrameElements(canonicalElements, frameScope);
  }, [canonicalElements, currentFrame, frameElementScopes]);

  const legacyFrameElements = useMemo(
    () => frameElements.map(toLegacyFrameElement),
    [frameElements],
  );

  // Frame 요소 트리 빌드
  const frameElementTree = useMemo(
    () => buildTreeFromElements(legacyFrameElements),
    [legacyFrameElements],
  );

  // Frame 전용 트리 펼치기/접기 상태
  const {
    expandedKeys,
    toggleKey,
    collapseAll: collapseFrameTree,
    expandKey,
  } = useTreeExpandState({
    selectedElementId,
    elements: legacyFrameElements,
  });

  const expandedStringKeys = useMemo(
    () => new Set([...expandedKeys].map(String)),
    [expandedKeys],
  );

  // Frame 전환 시 body 자동 펼치기 + 선택
  const prevFrameIdRef = React.useRef<string | null>(null);
  const bodyAutoSelectedRef = React.useRef<boolean>(false);

  const selectFrameBody = useCallback(
    (frameId: string): boolean => {
      const frameScope = frameElementScopes?.get(frameId) ?? null;
      const elementsForFrame =
        currentFrame?.id === frameId
          ? frameElements
          : collectCanonicalFrameElements(canonicalElements, frameScope);
      const bodyElement = findFrameBodyElement(elementsForFrame);
      if (!bodyElement) return false;

      expandKey(bodyElement.id);
      setSelectedElement(bodyElement.id, bodyElement.props as ElementProps);
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
      currentFrame?.id,
      expandKey,
      frameElements,
      frameElementScopes,
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

  // Frame 선택 핸들러 — id 기반 (ADR-111 P2-a PR-B)
  const handleSelectFrame = useCallback(
    (frameId: string) => {
      selectReusableFrame(frameId);
      setEditModeLayoutId(frameId);
      selectFrameBody(frameId);
    },
    [setEditModeLayoutId, selectFrameBody],
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

  // Frame node 삭제 핸들러
  const handleDeleteElement = useCallback(
    async (el: PanelNode) => {
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
    <SectionSplitStack
      storageKey={NAVIGATOR_SPLIT_STORAGE_KEYS.layouts}
      topId={NAVIGATOR_SECTION_IDS.frames}
      bottomId={NAVIGATOR_SECTION_IDS.frameLayers}
      label={t("navigator.resizeSections")}
      top={
        /* Frames List — ADR-111 P2 PR-D 추출 */
        <FrameList
          frames={reusableFrames}
          selectedFrameId={currentFrame?.id ?? null}
          onSelect={handleSelectFrame}
          onDelete={handleDeleteFrame}
          onAdd={handleAddFrame}
        />
      }
      bottom={
        /* Frame node tree — ADR-111 P2 PR-D2 추출 */
        <FrameElementTree
          tree={frameElementTree}
          frameId={currentFrame?.id ?? null}
          selectedElementId={selectedElementId}
          expandedKeys={expandedStringKeys}
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
      }
    />
  );
}

export default FramesTab;
