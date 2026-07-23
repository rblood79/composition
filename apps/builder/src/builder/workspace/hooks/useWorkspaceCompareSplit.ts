import { useCallback, useRef, useState } from "react";

const COMPARE_SPLIT_STORAGE_KEY = "builder.workspace.compare-split.v1";
const DEFAULT_COMPARE_SPLIT = 50;
const MIN_COMPARE_SPLIT = 20;
const MAX_COMPARE_SPLIT = 80;

interface UseWorkspaceCompareSplitOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseWorkspaceCompareSplitResult {
  compareSplit: number;
  handleResizeEnd: () => void;
  handleResizeMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function loadCompareSplit(): number {
  if (typeof window === "undefined") {
    return DEFAULT_COMPARE_SPLIT;
  }

  try {
    const stored = window.localStorage.getItem(COMPARE_SPLIT_STORAGE_KEY);
    const parsed = stored === null ? Number.NaN : Number(stored);

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

export function useWorkspaceCompareSplit({
  containerRef,
}: UseWorkspaceCompareSplitOptions): UseWorkspaceCompareSplitResult {
  const [compareSplit, setCompareSplit] = useState(loadCompareSplit);
  const compareSplitRef = useRef(compareSplit);
  const isDraggingRef = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const x = e.clientX - rect.left;
      const pct = Math.min(
        MAX_COMPARE_SPLIT,
        Math.max(MIN_COMPARE_SPLIT, (x / rect.width) * 100),
      );
      compareSplitRef.current = pct;
      setCompareSplit(pct);
    },
    [containerRef],
  );

  const handleResizeEnd = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    saveCompareSplit(compareSplitRef.current);
  }, []);

  return {
    compareSplit,
    handleResizeEnd,
    handleResizeMove,
    handleResizeStart,
  };
}
