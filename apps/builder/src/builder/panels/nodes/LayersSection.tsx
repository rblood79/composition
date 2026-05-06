/**
 * LayersSection - Layers 섹션 (메모이제이션 적용)
 *
 * NodesPanel에서 분리하여 elements 변경 시에만 리렌더링되도록 최적화
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { Element } from "../../../types/builder/unified.types";
import type { Key } from "react-stately";
import { Button } from "react-aria-components";
import { Minimize } from "lucide-react";
import { useStore } from "../../stores";
import { PanelHeader } from "../../components";
import { LayerTree } from "./tree/LayerTree";
import { iconProps } from "../../../utils/ui/uiConstants";
import { resolveEditingContextForTreeSelection } from "../../utils/hierarchicalSelection";
import {
  scheduleCancelableBackgroundTask,
  scheduleNextFrame,
} from "../../utils/scheduleTask";

interface LayersSectionProps {
  currentPageId: string;
}

const EMPTY_ELEMENTS: Element[] = [];

export const LayersSection = memo(function LayersSection({
  currentPageId,
}: LayersSectionProps) {
  const [isTreeVisible, setIsTreeVisible] = useState(
    () => !!useStore.getState().pageElementsSnapshot[currentPageId]?.length,
  );
  const currentPageElements = useStore(
    useCallback(
      (state) => state.pageElementsSnapshot[currentPageId] ?? EMPTY_ELEMENTS,
      [currentPageId],
    ),
  );
  const currentPageElementsMap = useMemo(
    () => new Map(currentPageElements.map((element) => [element.id, element])),
    [currentPageElements],
  );

  useEffect(() => {
    // snapshot이 있으면 다음 프레임에 표시, 없으면 placeholder 유지 후 백그라운드에서 표시
    // (페이지 삭제 → 전환 시 tree가 빈 상태로 flash되는 것 방지)
    const snapshot = useStore.getState().pageElementsSnapshot[currentPageId];
    const hasSnapshot = !!(snapshot && snapshot.length > 0);

    let cancelBackgroundTask: (() => void) | undefined;
    const taskId = scheduleNextFrame(() => {
      if (hasSnapshot) {
        setIsTreeVisible(true);
        return;
      }
      setIsTreeVisible(false);
      cancelBackgroundTask = scheduleCancelableBackgroundTask(() => {
        setIsTreeVisible(true);
      });
    });

    return () => {
      cancelBackgroundTask?.();
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(taskId);
      } else {
        clearTimeout(taskId);
      }
    };
  }, [currentPageId]);

  // 🚀 selectedElementId만 구독 - pages 변경 시 리렌더링 안됨
  const selectedElementId = useStore((state) => state.selectedElementId);
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  const removeElement = useStore((state) => state.removeElement);

  // 사용자가 직접 조작한 expandedKeys (collapse all, 수동 토글)
  const [userExpandedKeys, setUserExpandedKeys] = useState<Set<Key>>(new Set());
  // 사용자가 명시적으로 닫은 키 (자동 펼침을 오버라이드)
  const [userCollapsedKeys, setUserCollapsedKeys] = useState<Set<Key>>(
    new Set(),
  );

  // 🚀 선택된 요소의 부모 체인 계산 (파생 상태)
  const autoExpandedParents = useMemo(() => {
    if (!selectedElementId) return new Set<Key>();

    const selectedElement = currentPageElementsMap.get(selectedElementId);
    if (!selectedElement) return new Set<Key>();

    const parents = new Set<Key>();
    const visited = new Set<string>();
    let currentParentId = selectedElement.parent_id;

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      parents.add(currentParentId);
      const parentElement = currentPageElementsMap.get(currentParentId);
      currentParentId = parentElement?.parent_id ?? null;
    }
    return parents;
  }, [selectedElementId, currentPageElementsMap]);

  // 🚀 최종 expandedKeys = (사용자 조작 + 자동 펼침) - 사용자가 닫은 키
  const expandedKeys = useMemo(() => {
    const merged = new Set(userExpandedKeys);
    autoExpandedParents.forEach((key) => {
      // 사용자가 명시적으로 닫지 않은 경우에만 자동 펼침
      if (!userCollapsedKeys.has(key)) {
        merged.add(key);
      }
    });
    return merged;
  }, [userExpandedKeys, autoExpandedParents, userCollapsedKeys]);

  // 🚀 useCallback으로 메모이제이션 - 매 렌더링마다 새 함수 생성 방지
  // 계층적 선택: 트리에서 직접 선택 시 editingContext 자동 조정
  const handleItemClick = useCallback(
    (element: Element) => {
      const state = useStore.getState();
      let newContextId = resolveEditingContextForTreeSelection(
        element.id,
        state.elementsMap,
      );

      if (!state.elementsMap.has(element.id)) {
        const parentId = element.parent_id ?? null;
        const parentElement = parentId ? state.elementsMap.get(parentId) : null;
        newContextId = parentElement?.type === "body" ? null : parentId;
      }

      if (newContextId !== state.editingContextId) {
        state.setEditingContext(newContextId);
      }
      setSelectedElement(element.id);
    },
    [setSelectedElement],
  );

  const handleItemDelete = useCallback(
    async (element: { id: string }) => {
      await removeElement(element.id);
    },
    [removeElement],
  );

  // Collapse All 기능
  const handleCollapseAll = useCallback(() => {
    setUserExpandedKeys(new Set());
    // 모든 자동 펼침 키를 사용자가 닫은 것으로 처리
    setUserCollapsedKeys(new Set(autoExpandedParents));
  }, [autoExpandedParents]);

  // 사용자가 펼침/닫음 토글 시 처리
  const handleExpandedChange = useCallback(
    (newKeys: Set<Key>) => {
      // 이전에 펼쳐져 있었는데 새로 닫힌 키 찾기
      const closedKeys = new Set<Key>();
      expandedKeys.forEach((key) => {
        if (!newKeys.has(key)) {
          closedKeys.add(key);
        }
      });

      // 새로 열린 키 찾기
      const openedKeys = new Set<Key>();
      newKeys.forEach((key) => {
        if (!expandedKeys.has(key)) {
          openedKeys.add(key);
        }
      });

      // userCollapsedKeys 업데이트
      setUserCollapsedKeys((prev) => {
        const next = new Set(prev);
        // 닫힌 키 추가
        closedKeys.forEach((key) => next.add(key));
        // 열린 키 제거 (사용자가 다시 열었으므로)
        openedKeys.forEach((key) => next.delete(key));
        return next;
      });

      // userExpandedKeys 업데이트
      setUserExpandedKeys(newKeys);
    },
    [expandedKeys],
  );

  return (
    <div className="section">
      <PanelHeader
        title="Layers"
        actions={
          <Button
            className="iconButton"
            aria-label="Collapse All"
            onPress={handleCollapseAll}
          >
            <Minimize
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
              size={iconProps.size}
            />
          </Button>
        }
      />
      <div className="section-content">
        {isTreeVisible ? (
          <LayerTree
            elements={currentPageElements}
            selectedElementId={selectedElementId}
            expandedKeys={expandedKeys}
            onExpandedChange={handleExpandedChange}
            onItemClick={handleItemClick}
            onItemDelete={handleItemDelete}
          />
        ) : (
          <div
            className="layer-tree-placeholder"
            aria-hidden="true"
            style={{ minHeight: 32 }}
          />
        )}
      </div>
    </div>
  );
});
