import { useCallback, useLayoutEffect, useRef, useState } from "react";

const COMPARE_SPLIT_STORAGE_KEY = "builder.workspace.compare-split.v1";
const DEFAULT_COMPARE_SPLIT = 50;
const MIN_COMPARE_SPLIT = 0;
const MAX_COMPARE_SPLIT = 100;

interface UseWorkspaceCompareSplitOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** PanelSplitter 에 넘기는 px 단위 계약 — CSS가 보이는 경계의 위치 */
export interface CompareSplitterRange {
  value: number;
  minValue: number;
  maxValue: number;
}

export interface UseWorkspaceCompareSplitResult {
  /** CSS가 보이는 비율 (%) — 두 전체 크기 레이어의 clip 경계 */
  compareSplit: number;
  splitter: CompareSplitterRange;
  handleResizeStart: () => void;
  /** PanelSplitter 가 주는 드래그 시작점 기준 누적 delta (px) */
  handleResize: (deltaX: number, deltaY: number) => void;
  handleResizeEnd: () => void;
}

function loadCompareSplit(): number {
  if (typeof window === "undefined") {
    return DEFAULT_COMPARE_SPLIT;
  }

  try {
    const stored = window.localStorage.getItem(COMPARE_SPLIT_STORAGE_KEY);
    const parsed = stored?.trim() ? Number(stored) : Number.NaN;

    if (
      Number.isFinite(parsed) &&
      parsed >= MIN_COMPARE_SPLIT &&
      parsed <= MAX_COMPARE_SPLIT
    ) {
      return parsed;
    }
  } catch {
    // localStorage 접근이 불가능한 환경에서는 기본 split을 사용한다.
  }

  return DEFAULT_COMPARE_SPLIT;
}

function saveCompareSplit(compareSplit: number): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      COMPARE_SPLIT_STORAGE_KEY,
      String(compareSplit),
    );
  } catch {
    // localStorage 접근이 불가능해도 workspace resize 동작은 유지한다.
  }
}

function measureWidth(element: HTMLElement | null): number {
  return element ? element.getBoundingClientRect().width : 0;
}

/**
 * Compare Mode CSS/Canvas 노출 경계 — 저장은 % 로, 드래그·접근성 값은 px 로.
 * 두 renderer의 viewport는 고정하고 clip만 바꾼다. 공용
 * PanelSplitter(useMove, role=separator, Home/End·화살표)의 delta 계약을 따른다:
 * 시작 시 컨테이너 너비와 시작 px 를 잡고, 누적 deltaX 로 % 를 다시 계산한다.
 */
export function useWorkspaceCompareSplit({
  containerRef,
}: UseWorkspaceCompareSplitOptions): UseWorkspaceCompareSplitResult {
  const [compareSplit, setCompareSplit] = useState(loadCompareSplit);
  const [containerWidth, setContainerWidth] = useState(0);
  const compareSplitRef = useRef(compareSplit);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ width: 0, px: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setContainerWidth(measureWidth(container));
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  const handleResizeStart = useCallback(() => {
    const width = measureWidth(containerRef.current);
    isDraggingRef.current = true;
    dragStartRef.current = {
      width,
      px: (compareSplitRef.current / 100) * width,
    };
  }, [containerRef]);

  const handleResize = useCallback((deltaX: number) => {
    if (!isDraggingRef.current) {
      return;
    }
    const { width, px } = dragStartRef.current;
    if (width <= 0) {
      return;
    }

    const pct = Math.min(
      MAX_COMPARE_SPLIT,
      Math.max(MIN_COMPARE_SPLIT, ((px + deltaX) / width) * 100),
    );
    compareSplitRef.current = pct;
    setCompareSplit(pct);
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    saveCompareSplit(compareSplitRef.current);
  }, []);

  const splitter: CompareSplitterRange = {
    value: Math.round((compareSplit / 100) * containerWidth),
    minValue: Math.round((MIN_COMPARE_SPLIT / 100) * containerWidth),
    maxValue: Math.round((MAX_COMPARE_SPLIT / 100) * containerWidth),
  };

  return {
    compareSplit,
    splitter,
    handleResizeEnd,
    handleResize,
    handleResizeStart,
  };
}
