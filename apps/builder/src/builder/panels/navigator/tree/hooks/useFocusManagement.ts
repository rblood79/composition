import { useState, useCallback, useEffect, useRef } from "react";
import type { Key } from "react-stately";

interface FocusManagementOptions {
  /** 노드 맵 (빠른 조회용) */
  nodeMap: Map<string, { parentId: string | null; children?: unknown[] }>;
  /** 선택 변경 콜백 */
  onSelectionChange?: (keys: Set<Key>) => void;
  /** 재부모화 DOM 반영 뒤 DnD 포커스를 적용해야 하는 가상화 경로 */
  deferMoveFocusUntilLayout?: boolean;
}

interface FocusManagementResult {
  /** 현재 포커스된 키 */
  focusedKey: Key | null;
  /** 포커스 설정 */
  setFocusedKey: (key: Key | null) => void;
  /** DnD 완료 후 포커스 처리 */
  handleAfterMove: (movedKeys: Set<Key>) => void;
  /** 삭제 후 포커스 처리 */
  handleAfterDelete: (deletedKey: Key, siblingKeys: Key[]) => void;
  /** 추가 후 포커스 처리 */
  handleAfterAdd: (addedKey: Key) => void;
}

/**
 * useFocusManagement - 트리 포커스 관리 훅
 *
 * DnD, 삭제, 추가 작업 후 일관된 포커스 경험을 제공합니다.
 *
 * 포커스 규칙:
 * - DnD 후: 이동된 노드로 포커스 유지
 * - 삭제 후: 다음 형제 → 이전 형제 → 부모 순으로 포커스
 * - 추가 후: 새로 추가된 노드로 포커스
 */
export function useFocusManagement({
  nodeMap,
  onSelectionChange,
  deferMoveFocusUntilLayout = false,
}: FocusManagementOptions): FocusManagementResult {
  const [focusedKey, setFocusedKey] = useState<Key | null>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);

  const scheduleFocus = useCallback((key: Key | null) => {
    queueMicrotask(() => {
      setFocusedKey(key);
    });
  }, []);

  // DnD 재부모화가 DOM에 반영되고 RAC의 drop 대상 포커스가 끝난 뒤 실행한다.
  // 먼저 null로 비워 같은 행을 연속 이동해도 다음 포커스 요청을 다시 전달한다.
  const scheduleFocusAfterLayout = useCallback((key: Key) => {
    setFocusedKey(null);
    if (pendingFocusFrameRef.current !== null) {
      cancelAnimationFrame(pendingFocusFrameRef.current);
    }
    pendingFocusFrameRef.current = requestAnimationFrame(() => {
      pendingFocusFrameRef.current = null;
      setFocusedKey(key);
    });
  }, []);

  useEffect(
    () => () => {
      if (pendingFocusFrameRef.current !== null) {
        cancelAnimationFrame(pendingFocusFrameRef.current);
      }
    },
    [],
  );

  // DnD 완료 후 포커스 처리
  const handleAfterMove = useCallback(
    (movedKeys: Set<Key>) => {
      // 이동된 노드들 중 첫 번째로 포커스 유지
      const firstKey = [...movedKeys][0];
      if (firstKey) {
        if (deferMoveFocusUntilLayout) {
          scheduleFocusAfterLayout(firstKey);
        } else {
          scheduleFocus(firstKey);
        }
      }
    },
    [deferMoveFocusUntilLayout, scheduleFocus, scheduleFocusAfterLayout],
  );

  // 삭제 후 포커스 처리
  const handleAfterDelete = useCallback(
    (deletedKey: Key, siblingKeys: Key[]) => {
      const deletedKeyStr = String(deletedKey);
      const deletedIndex = siblingKeys.findIndex(
        (k) => String(k) === deletedKeyStr,
      );

      let nextFocusKey: Key | null = null;

      if (deletedIndex >= 0 && siblingKeys.length > 1) {
        // 다음 형제가 있으면 다음 형제로
        if (deletedIndex < siblingKeys.length - 1) {
          nextFocusKey = siblingKeys[deletedIndex + 1];
        }
        // 없으면 이전 형제로
        else if (deletedIndex > 0) {
          nextFocusKey = siblingKeys[deletedIndex - 1];
        }
      }

      // 형제가 없으면 부모로
      if (!nextFocusKey) {
        const deletedNode = nodeMap.get(deletedKeyStr);
        if (deletedNode?.parentId) {
          nextFocusKey = deletedNode.parentId;
        }
      }

      if (nextFocusKey) {
        scheduleFocus(nextFocusKey);
        // 선택도 함께 변경
        onSelectionChange?.(new Set([nextFocusKey]));
      }
    },
    [nodeMap, onSelectionChange, scheduleFocus],
  );

  // 추가 후 포커스 처리
  const handleAfterAdd = useCallback(
    (addedKey: Key) => {
      scheduleFocus(addedKey);
      // 선택도 함께 변경
      onSelectionChange?.(new Set([addedKey]));
    },
    [onSelectionChange, scheduleFocus],
  );

  return {
    focusedKey,
    setFocusedKey,
    handleAfterMove,
    handleAfterDelete,
    handleAfterAdd,
  };
}
