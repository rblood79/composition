/**
 * LayoutsTab — Navigator 의 재사용 레이아웃 탭 (ADR-225 로 구 명칭을 정렬).
 *
 * ADR-903 P3-C 재설계: canonical reusable FrameNode 목록 표시 + 그 내부 element 트리.
 *
 * - layout 목록: canonical reusable FrameNode surface (`useCanonicalReusableLayouts`)
 * - layout selection: `selectedReusableLayoutId` (Builder UI state)
 * - layout 생성: canonical document mutation + DB persistence mirror
 * - UI 어휘는 "Layouts", 저장 계약은 canonical `FrameNode` 유지
 *
 * @deprecated-path legacy layout selection direct access 제거됨. `selectedReusableLayoutId` 사용.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import { useParams } from "react-router";
import { LayoutList } from "./LayoutList";
import { LayoutElementTree } from "./LayoutElementTree";
import { SectionSplitStack } from "../../../components";
import { useI18n } from "@/i18n";
import {
  NAVIGATOR_SECTION_IDS,
  NAVIGATOR_SPLIT_STORAGE_KEYS,
} from "../navigatorSectionIds";
import {
  useCanonicalReusableLayouts,
  useSelectedReusableLayoutId,
} from "../../../stores/canonical/reusableLayoutStore";
import {
  createReusableLayout,
  deleteReusableLayout,
  selectReusableLayout,
  getNextLayoutName,
} from "../../../stores/utils/reusableLayoutActions";
import { useEditModeStore } from "../../../stores/editMode";
import { useStore } from "../../../stores";
import { useCanonicalFrameElementScopes } from "../../../stores/canonical/canonicalElementsView";
import { useCanonicalPanelElements } from "../useCanonicalPanelElements";
import type { CanonicalFrameElementScope } from "../../../../adapters/canonical/frameElementScope";
import type { ElementProps } from "../../../../types/builder/elementProps.types";
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

interface LayoutsTabProps {
  selectedElementId: string | null;
  setSelectedElement: (elementId: string | null, props?: ElementProps) => void;
  sendElementSelectedMessage: (elementId: string, props: ElementProps) => void;
  projectId?: string;
}

export function LayoutsTab({
  selectedElementId,
  setSelectedElement,
  sendElementSelectedMessage,
  projectId: projectIdProp,
}: LayoutsTabProps) {
  const { t } = useI18n();
  const { projectId: projectIdFromParams } = useParams<{ projectId: string }>();
  const projectId = projectIdProp || projectIdFromParams;

  // Builder UI selection: selectedReusableLayoutId
  const selectedReusableLayoutId = useSelectedReusableLayoutId();

  const layouts = useCanonicalReusableLayouts();

  // Edit Mode store
  const setEditModeLayoutId = useEditModeStore(
    (state) => state.setCurrentLayoutId,
  );

  const removeElement = useStore((state) => state.removeElement);
  const canonicalElements = useCanonicalPanelElements();
  const frameElementScopes = useCanonicalFrameElementScopes();

  // ADR-116 projection 제거: active canonical document 의 reusable FrameNode 를
  // 단일 read path 로 사용한다.
  const reusableLayouts = useMemo<
    ReadonlyArray<{ id: string; name: string }>
  >(() => {
    return layouts.map((layout) => ({ id: layout.id, name: layout.name }));
  }, [layouts]);

  // selectedReusableLayoutId 기반 현재 layout 조회
  const currentLayout = useMemo(() => {
    const projectedLayout =
      reusableLayouts.find((f) => f.id === selectedReusableLayoutId) || null;
    if (projectedLayout || !selectedReusableLayoutId) {
      return projectedLayout;
    }

    return { id: selectedReusableLayoutId, name: "" };
  }, [reusableLayouts, selectedReusableLayoutId]);

  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();

  const autoSelectedLayoutIdRef = React.useRef<string | null>(null);

  // Layout 내부 트리는 canonical document가 가진 frame scope만 읽는다. Builder chrome은
  // matching canonical 첫 frame 전까지 숨겨지므로 legacy hydration fallback이 없다.
  const frameElements = useMemo(() => {
    if (!currentLayout) return [];
    const frameScope = frameElementScopes?.get(currentLayout.id) ?? null;
    return collectCanonicalFrameElements(canonicalElements, frameScope);
  }, [canonicalElements, currentLayout, frameElementScopes]);

  const legacyFrameElements = useMemo(
    () => frameElements.map(toLegacyFrameElement),
    [frameElements],
  );

  // Layout 내부 요소 트리 빌드
  const frameElementTree = useMemo(
    () => buildTreeFromElements(legacyFrameElements),
    [legacyFrameElements],
  );

  // Layout 전용 트리 펼치기/접기 상태
  const {
    expandedKeys,
    toggleKey,
    collapseAll: collapseLayoutTree,
    expandKey,
  } = useTreeExpandState({
    selectedElementId,
    elements: legacyFrameElements,
  });

  const expandedStringKeys = useMemo(
    () => new Set([...expandedKeys].map(String)),
    [expandedKeys],
  );

  // Layout 전환 시 body 자동 펼치기 + 선택
  const prevLayoutIdRef = React.useRef<string | null>(null);
  const bodyAutoSelectedRef = React.useRef<boolean>(false);

  const selectLayoutBody = useCallback(
    (frameId: string): boolean => {
      const frameScope = frameElementScopes?.get(frameId) ?? null;
      const elementsForFrame =
        currentLayout?.id === frameId
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
      currentLayout?.id,
      expandKey,
      frameElements,
      frameElementScopes,
      sendElementSelectedMessage,
      setSelectedElement,
    ],
  );

  useEffect(() => {
    const layoutChanged = currentLayout?.id !== prevLayoutIdRef.current;

    if (layoutChanged && currentLayout?.id) {
      collapseLayoutTree();
      prevLayoutIdRef.current = currentLayout.id;
      bodyAutoSelectedRef.current = false;
    }

    if (
      currentLayout &&
      frameElements.length > 0 &&
      !bodyAutoSelectedRef.current
    ) {
      selectLayoutBody(currentLayout.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLayout?.id, frameElements, collapseLayoutTree, selectLayoutBody]);

  // Layout 선택 핸들러 — id 기반 (ADR-111 P2-a PR-B)
  const handleSelectLayout = useCallback(
    (frameId: string) => {
      selectReusableLayout(frameId);
      setEditModeLayoutId(frameId);
      selectLayoutBody(frameId);
    },
    [setEditModeLayoutId, selectLayoutBody],
  );

  useEffect(() => {
    const firstLayoutId = reusableLayouts[0]?.id ?? null;
    if (!firstLayoutId) {
      autoSelectedLayoutIdRef.current = null;
      return;
    }

    const hasValidSelection = Boolean(
      selectedReusableLayoutId &&
      reusableLayouts.some((frame) => frame.id === selectedReusableLayoutId),
    );
    if (hasValidSelection) {
      autoSelectedLayoutIdRef.current = null;
      return;
    }

    if (autoSelectedLayoutIdRef.current === firstLayoutId) return;
    autoSelectedLayoutIdRef.current = firstLayoutId;
    void handleSelectLayout(firstLayoutId);
  }, [handleSelectLayout, reusableLayouts, selectedReusableLayoutId]);

  // Layout 삭제 핸들러 — reusableLayoutActions.deleteReusableLayout 위임
  const handleDeleteLayout = useCallback(
    async (frameId: string) => {
      try {
        await deleteReusableLayout(frameId);
        const remaining = reusableLayouts.filter((f) => f.id !== frameId);
        if (remaining.length > 0) {
          handleSelectLayout(remaining[0].id);
        } else {
          selectReusableLayout(null);
          setEditModeLayoutId(null);
        }
      } catch (error) {
        console.error("[LayoutsTab] Layout 삭제 에러:", error);
      }
    },
    [reusableLayouts, handleSelectLayout, setEditModeLayoutId],
  );

  // 새 Layout 생성 핸들러 — reusableLayoutActions.createReusableLayout 위임.
  // unique 한 default 이름은 getNextLayoutName 으로 안정 생성 — 이전 패턴
  // (`Layout ${reusableLayouts.length + 1}`) 의 중복 위험 제거 (delete 후 add 또는
  // IDB 잔존 데이터 + 메모리 length mismatch 시 충돌 방지).
  const handleAddLayout = useCallback(async () => {
    if (!projectId) {
      console.error("[LayoutsTab] 프로젝트 ID가 없습니다");
      return;
    }
    try {
      const ref = await createReusableLayout({
        name: getNextLayoutName(reusableLayouts),
        projectId,
      });
      await handleSelectLayout(ref.id);
    } catch (error) {
      console.error("[LayoutsTab] Layout 생성 에러:", error);
    }
  }, [projectId, reusableLayouts, handleSelectLayout]);

  // Layout 내부 node 삭제 핸들러
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
      topId={NAVIGATOR_SECTION_IDS.layouts}
      bottomId={NAVIGATOR_SECTION_IDS.layoutLayers}
      label={t("navigator.resizeSections")}
      top={
        /* Layout List — ADR-111 P2 PR-D 추출 */
        <LayoutList
          layouts={reusableLayouts}
          selectedLayoutId={currentLayout?.id ?? null}
          onSelect={handleSelectLayout}
          onDelete={handleDeleteLayout}
          onAdd={handleAddLayout}
        />
      }
      bottom={
        /* Layout 내부 node tree — ADR-111 P2 PR-D2 추출 */
        <LayoutElementTree
          tree={frameElementTree}
          frameId={currentLayout?.id ?? null}
          selectedElementId={selectedElementId}
          expandedKeys={expandedStringKeys}
          toggleKey={toggleKey}
          onCollapseAll={collapseLayoutTree}
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

export default LayoutsTab;
