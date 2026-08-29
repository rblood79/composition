import { useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { Key } from "react-stately";

interface FlattenedNode<TNode> {
  node: TNode;
  key: Key;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
}

interface UseTreeVirtualOptions<TNode> {
  /** 트리 노드 배열 */
  items: TNode[];
  /** 확장된 키 Set */
  expandedKeys: Set<Key>;
  /** 노드에서 key 추출 */
  getKey: (node: TNode) => Key;
  /** 노드의 자식 배열 반환 */
  getChildren: (node: TNode) => TNode[];
  /** 노드 depth 반환 */
  getDepth: (node: TNode) => number;
  /** 노드 높이 (픽셀) */
  itemHeight?: number;
  /** 오버스캔 개수 */
  overscan?: number;
  /** 스크롤 컨테이너 ref */
  scrollRef?: React.RefObject<HTMLDivElement>;
}

interface UseTreeVirtualResult<TNode> {
  /** 가상화된 아이템 목록 */
  virtualItems: VirtualItem[];
  /** 전체 높이 (px) */
  totalHeight: number;
  /** 스크롤 컨테이너 ref */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** 평탄화된 노드 목록 */
  flattenedNodes: FlattenedNode<TNode>[];
  /** 특정 키로 스크롤 */
  scrollToKey: (key: Key) => void;
  /** 현재 보이는 범위 */
  visibleRange: { start: number; end: number };
}

/**
 * useTreeVirtual - 트리 가상화 훅
 *
 * @tanstack/react-virtual 기반으로 트리를 가상화합니다.
 * - 확장된 노드만 평탄화하여 렌더링
 * - 고정 높이 기반 가상화
 * - scrollToKey로 특정 노드로 스크롤
 */
export function useTreeVirtual<TNode>({
  items,
  expandedKeys,
  getKey,
  getChildren,
  getDepth,
  itemHeight = 32,
  overscan = 5,
  scrollRef: externalScrollRef,
}: UseTreeVirtualOptions<TNode>): UseTreeVirtualResult<TNode> {
  "use no memo";
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;

  // 확장된 노드만 평탄화
  const flattenedNodes = useMemo(() => {
    const result: FlattenedNode<TNode>[] = [];

    const flatten = (nodes: TNode[]) => {
      for (const node of nodes) {
        const key = getKey(node);
        const children = getChildren(node);
        const isExpanded = expandedKeys.has(key);
        const hasChildren = children.length > 0;

        result.push({
          node,
          key,
          depth: getDepth(node),
          isExpanded,
          hasChildren,
        });

        // 확장된 노드의 자식만 추가
        if (isExpanded && hasChildren) {
          flatten(children);
        }
      }
    };

    flatten(items);
    return result;
  }, [items, expandedKeys, getKey, getChildren, getDepth]);

  // Virtualizer 설정
  const virtualizer = useVirtualizer({
    count: flattenedNodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  // 특정 키로 스크롤
  const scrollToKey = useCallback(
    (key: Key) => {
      const index = flattenedNodes.findIndex((n) => n.key === key);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
      }
    },
    [flattenedNodes, virtualizer],
  );

  // 스크롤 위치 복원 (레이아웃 이펙트)
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [flattenedNodes.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const visibleRange = {
    start: virtualItems[0]?.index ?? 0,
    end: virtualItems[virtualItems.length - 1]?.index ?? 0,
  };

  return {
    virtualItems,
    totalHeight: virtualizer.getTotalSize(),
    scrollRef,
    flattenedNodes,
    scrollToKey,
    visibleRange,
  };
}
