import type { Key } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isCanvasViewportSnapshotEqual,
  selectCanvasViewportSnapshot,
  useViewportSyncStore,
} from "../canvas/stores";
import {
  applyViewportState,
  computeCenteredViewport,
  computeFitViewport,
  resolveBreakpointViewport,
} from "../canvas/viewport/viewportActions";
import { finishActiveViewportInteraction } from "../canvas/viewport/ViewportInteractionSession";
import type { Breakpoint } from "../types";
import {
  loadWorkspaceCanvasViewports,
  saveWorkspaceCanvasViewports,
  type WorkspaceCanvasViewport,
} from "./workspaceCanvasViewportPersistence";

interface UseWorkspaceCanvasSizingOptions {
  breakpoint?: Set<Key>;
  breakpoints?: Breakpoint[];
  /**
   * compare 모드에서 Skia canvas 가 실제 차지하는 영역 (우측 split pane).
   * viewport 좌표계(pan/zoom/fit/visiblePageSet)의 containerSize 는 이 영역 기준.
   * 미지정 또는 null 이면 containerRef 로 fallback (비-compare 모드는 두 요소가 동일).
   */
  canvasAreaRef?: React.RefObject<HTMLDivElement | null>;
  compareMode: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface WorkspaceCanvasSize {
  height: number;
  width: number;
}

export interface UseWorkspaceCanvasSizingResult {
  canvasSize: WorkspaceCanvasSize;
}

function publishCanvasLocalRect(
  container: HTMLDivElement,
  size: WorkspaceCanvasSize,
): void {
  const layoutVersion = container
    .closest<HTMLElement>(".panel-workspace-main")
    ?.getAttribute("data-layout-version");
  container.setAttribute("data-canvas-layout-version", layoutVersion ?? "");
  container.setAttribute("data-canvas-local-width", String(size.width));
  container.setAttribute("data-canvas-local-height", String(size.height));
  useViewportSyncStore.getState().setContainerSize(size);
}

function syncCanvasLayoutVersion(container: HTMLDivElement): void {
  const layoutVersion = container
    .closest<HTMLElement>(".panel-workspace-main")
    ?.getAttribute("data-layout-version");
  container.setAttribute("data-canvas-layout-version", layoutVersion ?? "");
}

export function useWorkspaceCanvasSizing({
  breakpoint,
  breakpoints,
  canvasAreaRef,
  compareMode,
  containerRef,
}: UseWorkspaceCanvasSizingOptions): UseWorkspaceCanvasSizingResult {
  const containerSizeRef = useRef({ height: 0, width: 0 });
  const [containerSizeForPercent, setContainerSizeForPercent] = useState({
    height: 0,
    width: 0,
  });
  const usesPercentBreakpointRef = useRef(false);

  const selectedBreakpoint = useMemo(() => {
    if (!breakpoint || !breakpoints || breakpoints.length === 0) {
      return null;
    }

    const selectedId = Array.from(breakpoint)[0] as string;
    return breakpoints.find((candidate) => candidate.id === selectedId) ?? null;
  }, [breakpoint, breakpoints]);

  const usesPercentBreakpoint = useMemo(() => {
    if (!selectedBreakpoint) {
      return false;
    }

    return (
      String(selectedBreakpoint.max_width).includes("%") ||
      String(selectedBreakpoint.max_height).includes("%")
    );
  }, [selectedBreakpoint]);

  useEffect(() => {
    usesPercentBreakpointRef.current = usesPercentBreakpoint;
  }, [usesPercentBreakpoint]);

  const canvasSize = useMemo(() => {
    if (!selectedBreakpoint) {
      return { height: 1080, width: 1920 };
    }

    const parseSize = (
      value: string | number,
      containerDimension: number,
    ): number => {
      if (typeof value === "number") {
        return value;
      }

      const stringValue = String(value);
      if (stringValue.includes("%")) {
        const percent = parseFloat(stringValue) / 100;
        return containerDimension > 0
          ? Math.floor(containerDimension * percent)
          : 1920;
      }

      const parsed = parseInt(stringValue, 10);
      return Number.isNaN(parsed) ? 1920 : parsed;
    };

    const containerSize = usesPercentBreakpoint
      ? containerSizeForPercent
      : { height: 0, width: 0 };

    return {
      height: parseSize(selectedBreakpoint.max_height, containerSize.height),
      width: parseSize(selectedBreakpoint.max_width, containerSize.width),
    };
  }, [containerSizeForPercent, selectedBreakpoint, usesPercentBreakpoint]);

  useEffect(() => {
    useViewportSyncStore.getState().setCanvasSize(canvasSize);
  }, [canvasSize]);

  const centerCanvasRef = useRef<() => boolean>(() => false);
  const centerCanvasAt100Ref = useRef<() => boolean>(() => false);
  const isFitModeRef = useRef(false);
  const activeBreakpointIdRef = useRef<string | null>(null);
  const validBreakpointIds = useMemo(
    () => new Set((breakpoints ?? []).map((candidate) => candidate.id)),
    [breakpoints],
  );
  const [breakpointViewports] = useState<Map<string, WorkspaceCanvasViewport>>(
    () => loadWorkspaceCanvasViewports(validBreakpointIds),
  );
  const viewportPersistenceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearViewportPersistenceTimer = useCallback(() => {
    if (viewportPersistenceTimerRef.current !== null) {
      clearTimeout(viewportPersistenceTimerRef.current);
      viewportPersistenceTimerRef.current = null;
    }
  }, []);

  const flushViewportPersistence = useCallback(
    (breakpointId = activeBreakpointIdRef.current) => {
      if (!breakpointId || !validBreakpointIds.has(breakpointId)) {
        return;
      }

      const currentViewport = useViewportSyncStore.getState();
      breakpointViewports.set(breakpointId, {
        x: currentViewport.panOffset.x,
        y: currentViewport.panOffset.y,
        scale: currentViewport.zoom,
      });
      saveWorkspaceCanvasViewports(breakpointViewports, validBreakpointIds);
    },
    [breakpointViewports, validBreakpointIds],
  );

  const scheduleViewportPersistence = useCallback(() => {
    if (!activeBreakpointIdRef.current) {
      return;
    }

    clearViewportPersistenceTimer();
    viewportPersistenceTimerRef.current = setTimeout(() => {
      viewportPersistenceTimerRef.current = null;
      flushViewportPersistence();
    }, 150);
  }, [clearViewportPersistenceTimer, flushViewportPersistence]);

  const centerCanvas = useCallback(() => {
    const containerSize = containerSizeRef.current;
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return false;
    }

    applyViewportState(computeFitViewport({ canvasSize, containerSize }));
    return true;
  }, [canvasSize]);

  const centerCanvasAt100 = useCallback(() => {
    const containerSize = containerSizeRef.current;
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return false;
    }

    applyViewportState(
      computeCenteredViewport({ canvasSize, containerSize, zoom: 1 }),
    );
    return true;
  }, [canvasSize]);

  useEffect(() => {
    centerCanvasRef.current = centerCanvas;
    centerCanvasAt100Ref.current = centerCanvasAt100;
  }, [centerCanvas, centerCanvasAt100]);

  const restoreInitialViewport = useCallback(() => {
    const containerSize = containerSizeRef.current;
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return false;
    }

    const savedViewport = activeBreakpointIdRef.current
      ? breakpointViewports.get(activeBreakpointIdRef.current)
      : undefined;
    if (savedViewport) {
      applyViewportState(savedViewport);
      return true;
    }

    return centerCanvasAt100Ref.current();
  }, [breakpointViewports]);

  const lastCompareModeRef = useRef(compareMode);

  useEffect(() => {
    const breakpointId = selectedBreakpoint?.id ?? null;
    const previousBreakpointId = activeBreakpointIdRef.current;
    if (previousBreakpointId === breakpointId) {
      return;
    }

    // 이전 breakpoint snapshot은 active transient state를 마감한 뒤에만 저장한다.
    finishActiveViewportInteraction();
    clearViewportPersistenceTimer();
    if (previousBreakpointId) {
      flushViewportPersistence(previousBreakpointId);
    }

    const currentViewport = useViewportSyncStore.getState();
    activeBreakpointIdRef.current = breakpointId;

    if (!breakpointId) return;

    const containerSize = containerSizeRef.current;
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return;
    }

    applyViewportState(
      resolveBreakpointViewport({
        canvasSize,
        containerSize,
        zoom: currentViewport.zoom,
        savedViewport: breakpointViewports.get(breakpointId),
      }),
    );
  }, [
    canvasSize,
    breakpointViewports,
    clearViewportPersistenceTimer,
    flushViewportPersistence,
    selectedBreakpoint,
  ]);

  useEffect(() => {
    const unsubscribe = useViewportSyncStore.subscribe(
      selectCanvasViewportSnapshot,
      () => {
        scheduleViewportPersistence();
      },
      { equalityFn: isCanvasViewportSnapshotEqual },
    );

    return () => {
      clearViewportPersistenceTimer();
      flushViewportPersistence();
      unsubscribe();
    };
  }, [
    clearViewportPersistenceTimer,
    flushViewportPersistence,
    scheduleViewportPersistence,
  ]);

  // Compare mode 토글 시 viewport 재센터링
  useEffect(() => {
    if (lastCompareModeRef.current !== compareMode) {
      lastCompareModeRef.current = compareMode;
      // 약간의 지연 후 센터링 (레이아웃 변경 완료 대기)
      requestAnimationFrame(() => {
        centerCanvasAt100Ref.current();
      });
    }
  }, [compareMode]);

  useEffect(() => {
    // compare 모드에서는 Skia canvas 영역(우측 pane)이 viewport 좌표계의 기준이다.
    // workspace 전체 폭으로 측정하면 fit/줌 중심의 pan 이 좌측 preview pane 폭만큼
    // 오른쪽으로 밀려 콘텐츠가 우측 패널 아래로 사라진다 (Phase C 2026-07-20).
    // compareMode dep: 토글 시 DOM 트리가 교체되므로 새 요소를 재관측해야 한다.
    const container = canvasAreaRef?.current ?? containerRef.current;
    if (!container) {
      return;
    }

    let rafId: number | null = null;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { height, width } = entry.contentRect;
      if (width <= 0 || height <= 0) {
        return;
      }

      const previous = containerSizeRef.current;
      if (previous.width === width && previous.height === height) {
        return;
      }

      if (rafId !== null) {
        return;
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;

        const isInitialLoad = containerSizeRef.current.width === 0;
        containerSizeRef.current = { height, width };

        publishCanvasLocalRect(container, { height, width });

        if (usesPercentBreakpointRef.current) {
          setContainerSizeForPercent({ height, width });
        }

        if (isInitialLoad) {
          restoreInitialViewport();
        } else if (isFitModeRef.current) {
          centerCanvasRef.current();
        }
      });
    });

    resizeObserver.observe(container);
    const mainSlot = container.closest<HTMLElement>(".panel-workspace-main");
    let layoutVersionObserver: MutationObserver | null = null;
    if (mainSlot) {
      layoutVersionObserver = new MutationObserver(() =>
        syncCanvasLayoutVersion(container),
      );
      layoutVersionObserver.observe(mainSlot, {
        attributeFilter: ["data-layout-version"],
        attributes: true,
      });
    }
    syncCanvasLayoutVersion(container);

    const initialWidth = container.clientWidth;
    const initialHeight = container.clientHeight;
    if (initialWidth > 0 && initialHeight > 0) {
      containerSizeRef.current = {
        height: initialHeight,
        width: initialWidth,
      };
      publishCanvasLocalRect(container, {
        height: initialHeight,
        width: initialWidth,
      });

      if (usesPercentBreakpointRef.current) {
        setContainerSizeForPercent({
          height: initialHeight,
          width: initialWidth,
        });
      }

      restoreInitialViewport();
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      layoutVersionObserver?.disconnect();
    };
  }, [canvasAreaRef, compareMode, containerRef, restoreInitialViewport]);

  return {
    canvasSize,
  };
}
