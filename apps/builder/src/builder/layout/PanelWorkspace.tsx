import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import { useMove } from "react-aria";
import { usePanelLayout } from "../hooks";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type {
  PanelConfig,
  PanelFrameGeometry,
  PanelId,
  PanelResizeEdge,
  PanelSide,
} from "../panels/core/types";
import { PanelNav } from "./PanelNav";
import { registerPanelWorkspaceActivationDispatcher } from "./panelWorkspaceActivationDispatcher";
import {
  PanelSnapInteractionProvider,
  usePanelSnapInteraction,
} from "./PanelSnapContext";
import { PanelSplitter } from "./PanelSplitter";
import {
  mountPanelWorkspaceDiagnostics,
  isPanelWorkspaceDiagnosticsEnabled,
  recordPanelFrameApplied,
  recordPanelFrameCommit,
  recordPanelWorkspaceCommit,
  recordPanelWorkspaceLayoutInput,
  recordPanelWorkspaceSolve,
  startPanelWorkspaceManualTrace,
} from "./panelWorkspaceDiagnostics";
import type {
  PanelWorkspaceFrameSnapshot,
  PanelWorkspaceLayoutSnapshot,
  PanelWorkspaceSplitterGeometry,
} from "./panelWorkspaceLayoutCoordinator";
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  type PanelWorkspaceClusterV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import {
  createPanelWorkspaceRuntime,
  type PanelWorkspaceRuntime,
} from "./panelWorkspaceRuntime";
import {
  usePanelWorkspaceFrameSnapshot,
  usePanelWorkspaceLayoutSnapshot,
} from "./usePanelWorkspaceLayoutSnapshot";
import "./PanelWorkspace.css";

type PanelFrameMode = "hidden" | "placed";

function isRightAnchoredPlacementZone(
  placementZone: PanelWorkspaceClusterV3["placementZone"] | undefined,
): boolean {
  return Boolean(
    placementZone &&
    (placementZone === "right" || placementZone.endsWith("-right")),
  );
}

const RESIZE_EDGE_LABELS: Record<PanelResizeEdge, string> = {
  left: "왼쪽",
  right: "오른쪽",
  top: "상단",
  bottom: "하단",
};

function railSideForPanel(
  layout: PanelWorkspaceLayoutV3,
  config: PanelConfig,
): PanelSide {
  for (const side of ["left", "right", "bottom"] as const) {
    if (layout.railOrder[side].includes(config.id)) return side;
  }
  return config.defaultPosition;
}

function frameMode(
  snapshotFrame: PanelWorkspaceFrameSnapshot | null,
): PanelFrameMode {
  if (!snapshotFrame) return "hidden";
  return "placed";
}

function panelBelongsToMultiPanelCluster(
  runtime: PanelWorkspaceRuntime,
  panelId: PanelId,
): boolean {
  return runtime.getLayout().clusters.some((cluster) => {
    const panelIds = cluster.columns.flatMap((column) =>
      column.rows.map((row) => row.panelId),
    );
    return panelIds.length > 1 && panelIds.includes(panelId);
  });
}

function frameZIndex(
  runtime: PanelWorkspaceRuntime,
  snapshotFrame: PanelWorkspaceFrameSnapshot | null,
  isMoving: boolean,
): number {
  if (isMoving) return 2_000;
  if (!snapshotFrame) return 30;
  const layout = runtime.getLayout();
  const focusIndex = layout.clusterFocusOrder.indexOf(snapshotFrame.clusterId);
  return 1_000 + Math.max(0, focusIndex);
}

function splitterZIndex(
  runtime: PanelWorkspaceRuntime,
  clusterId: string,
): number {
  const layout = runtime.getLayout();
  const cluster = layout.clusters.find(
    (candidate) => candidate.id === clusterId,
  );
  if (!cluster) return 30;
  return 1_000 + Math.max(0, layout.clusterFocusOrder.indexOf(clusterId));
}

interface SharedSplitterContract {
  controls: string;
  edge: PanelResizeEdge;
  label: string;
  maxValue: number;
  minValue: number;
  panelId: PanelId;
  value: number;
}

function sharedSplitterContract(
  splitter: PanelWorkspaceSplitterGeometry,
  snapshot: PanelWorkspaceLayoutSnapshot,
): SharedSplitterContract | null {
  const panelId = splitter.beforePanelIds[0];
  if (!panelId) return null;
  const frame = snapshot.frameGeometries.get(panelId);
  if (!frame) return null;
  const beforeConfigs = splitter.beforePanelIds.flatMap((candidate) => {
    const config = PanelRegistry.getPanel(candidate);
    return config ? [config] : [];
  });
  if (beforeConfigs.length === 0) return null;
  const beforeNames = beforeConfigs.map((config) => config.name).join(", ");
  const afterNames = splitter.afterPanelIds
    .flatMap((candidate) => {
      const config = PanelRegistry.getPanel(candidate);
      return config ? [config.name] : [];
    })
    .join(", ");

  if (splitter.kind === "row") {
    const config = beforeConfigs[0];
    if (!config) return null;
    return {
      controls: `panel-${panelId}-content`,
      edge: "bottom",
      label: `${beforeNames} / ${afterNames} 패널 행 크기 조절`,
      maxValue: Math.max(
        config.minHeight ?? 160,
        snapshot.workspaceRect.height,
      ),
      minValue: config.minHeight ?? 160,
      panelId,
      value: frame.height,
    };
  }

  const minValue = Math.max(
    ...beforeConfigs.map((config) => config.minWidth ?? 200),
  );
  const maxValue = Math.max(
    minValue,
    Math.min(...beforeConfigs.map((config) => config.maxWidth ?? 800)),
  );
  return {
    controls: splitter.beforePanelIds
      .map((candidate) => `panel-${candidate}-content`)
      .join(" "),
    edge: "right",
    label: `${beforeNames} / ${afterNames} 패널 열 크기 조절`,
    maxValue,
    minValue,
    panelId,
    value: frame.width,
  };
}

function sharedSplitterStyle(
  splitter: PanelWorkspaceSplitterGeometry,
  zIndex: number,
  dockOrigin: PanelDockOrigin,
  rightAnchored: boolean,
): CSSProperties {
  const hitSize = 10;
  const { geometry } = splitter;
  if (splitter.kind === "row") {
    return {
      bottom: "auto",
      height: hitSize,
      ...(rightAnchored
        ? {
            right: dockOrigin.workspaceWidth - geometry.x - geometry.width,
            left: "auto",
          }
        : {
            left: geometry.x - dockOrigin.x,
            right: "auto",
          }),
      top: geometry.y - dockOrigin.y + geometry.height / 2 - hitSize / 2,
      width: geometry.width,
      zIndex,
    };
  }
  const left = geometry.x - dockOrigin.x + geometry.width / 2 - hitSize / 2;
  return {
    bottom: "auto",
    height: geometry.height,
    ...(rightAnchored
      ? {
          right:
            dockOrigin.workspaceWidth -
            geometry.x -
            geometry.width / 2 -
            hitSize / 2,
          left: "auto",
        }
      : { left, right: "auto" }),
    top: geometry.y - dockOrigin.y,
    width: hitSize,
    zIndex,
  };
}

interface PanelWorkspaceRuntimeProps {
  runtime: PanelWorkspaceRuntime;
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV3) => boolean;
}

interface PanelWorkspaceSharedSplittersProps extends PanelWorkspaceRuntimeProps {
  dockOrigin: PanelDockOrigin;
}

function PanelWorkspaceSharedSplitters({
  dockOrigin,
  runtime,
  setWorkspaceLayout,
}: PanelWorkspaceSharedSplittersProps) {
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);

  return (
    <>
      {snapshot.splitters.map((splitter) => {
        const contract = sharedSplitterContract(splitter, snapshot);
        if (!contract) return null;
        return (
          <PanelSplitter
            key={splitter.id}
            edge={contract.edge}
            label={contract.label}
            controls={contract.controls}
            value={contract.value}
            minValue={contract.minValue}
            maxValue={contract.maxValue}
            layoutVersion={splitter.layoutVersion}
            className="panel-cluster-splitter"
            splitterKind={splitter.kind}
            style={sharedSplitterStyle(
              splitter,
              splitterZIndex(runtime, splitter.clusterId),
              dockOrigin,
              isRightAnchoredPlacementZone(
                runtime
                  .getLayout()
                  .clusters.find((cluster) => cluster.id === splitter.clusterId)
                  ?.placementZone,
              ),
            )}
            onResizeStart={() => runtime.beginInteraction()}
            onResize={(deltaX, deltaY) => {
              recordPanelWorkspaceSolve();
              const mutation = runtime.resizePanelFromReference(
                contract.panelId,
                contract.edge,
                deltaX,
                deltaY,
              );
              if (mutation.ok) {
                recordPanelWorkspaceLayoutInput(
                  mutation.value.expectedVersion,
                  mutation.value.affectedPanelIds,
                );
              }
            }}
            onResizeEnd={() => setWorkspaceLayout(runtime.endInteraction())}
          />
        );
      })}
    </>
  );
}

function deltaForTrace(
  edge: PanelResizeEdge,
  delta: number,
): { deltaX: number; deltaY: number } {
  return edge === "left" || edge === "right"
    ? { deltaX: delta, deltaY: 0 }
    : { deltaX: 0, deltaY: delta };
}

function waitForPresentationFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function PanelWorkspaceTraceDriver({
  runtime,
  setWorkspaceLayout,
}: PanelWorkspaceRuntimeProps) {
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);
  const [isRunning, setIsRunning] = useState(false);
  const candidate = [...snapshot.frameGeometries.entries()].find(
    ([, frame]) => frame.resizeEdges.length > 0,
  );

  const runTrace = async () => {
    if (isRunning || !candidate) return;
    const [panelId, frame] = candidate;
    const edge = frame.resizeEdges.includes("bottom")
      ? "bottom"
      : frame.resizeEdges[0];
    if (!edge) return;

    setIsRunning(true);
    startPanelWorkspaceManualTrace("resize");
    runtime.beginInteraction();
    let offset = 0;
    const startedAt = performance.now();

    while (performance.now() - startedAt < 5_100) {
      await waitForPresentationFrame();
      const nextOffset = offset === 0 ? 1 : 0;
      const { deltaX, deltaY } = deltaForTrace(edge, nextOffset - offset);
      recordPanelWorkspaceSolve();
      const mutation = runtime.resizePanel(panelId, edge, deltaX, deltaY);
      if (mutation.ok) {
        recordPanelWorkspaceLayoutInput(
          mutation.value.expectedVersion,
          mutation.value.affectedPanelIds,
        );
      }
      offset = nextOffset;
    }

    if (offset !== 0) {
      const { deltaX, deltaY } = deltaForTrace(edge, -offset);
      recordPanelWorkspaceSolve();
      const mutation = runtime.resizePanel(panelId, edge, deltaX, deltaY);
      if (mutation.ok) {
        recordPanelWorkspaceLayoutInput(
          mutation.value.expectedVersion,
          mutation.value.affectedPanelIds,
        );
      }
    }
    await waitForPresentationFrame();
    setWorkspaceLayout(runtime.endInteraction());
    setIsRunning(false);
  };

  return (
    <button
      type="button"
      className="panel-trace-driver"
      data-running={isRunning}
      disabled={isRunning || !candidate}
      onClick={() => void runTrace()}
    >
      {isRunning ? "Panel trace running" : "Run panel resize trace"}
    </button>
  );
}

interface PanelFrameContentProps {
  config: PanelConfig;
  contentId: string;
  mode: PanelFrameMode;
  side: PanelSide;
}

const PanelFrameContent = memo(function PanelFrameContent({
  config,
  contentId,
  mode,
  side,
}: PanelFrameContentProps) {
  const PanelComponent = config.component;
  return (
    <div id={contentId} className="workspace-panel-content">
      <Activity mode={mode === "hidden" ? "hidden" : "visible"}>
        <PanelComponent
          isActive={true}
          side={side}
          displayMode={mode === "placed" ? "floating" : "panel"}
          onClose={undefined}
        />
      </Activity>
    </div>
  );
});

interface PanelFrameProps {
  config: PanelConfig;
  dockOrigin: PanelDockOrigin;
  runtime: PanelWorkspaceRuntime;
  snapshotFrame: PanelWorkspaceFrameSnapshot | null;
  side: PanelSide;
  onCommitLayout: (layout: PanelWorkspaceLayoutV3) => boolean;
  onFocusPanel: (panelId: PanelId) => void;
}

const PanelFrame = memo(function PanelFrame({
  config,
  dockOrigin,
  runtime,
  snapshotFrame,
  side,
  onCommitLayout,
  onFocusPanel,
}: PanelFrameProps) {
  const {
    draggedPanelId,
    dropCandidate,
    beginPanelDrag,
    updatePanelDropCandidate,
    endPanelDrag,
  } = usePanelSnapInteraction();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const visualGeometryRef = useRef<PanelFrameGeometry>({
    x: snapshotFrame?.x ?? 0,
    y: snapshotFrame?.y ?? 0,
    width: snapshotFrame?.width ?? 0,
    height: snapshotFrame?.height ?? 0,
  });
  const scrollMemoryRef = useRef(
    new Map<Element, { top: number; left: number }>(),
  );
  const isActiveRef = useRef(snapshotFrame !== null);
  const restoringRef = useRef(false);
  const isInteractingRef = useRef(false);
  const suppressSnapRef = useRef(false);
  const interactionCancelledRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const isActive = snapshotFrame !== null;
  const mode = frameMode(snapshotFrame);
  const isClustered = panelBelongsToMultiPanelCluster(runtime, config.id);
  const contentId = `panel-${config.id}-content`;

  useLayoutEffect(() => {
    recordPanelFrameCommit(config.id);
  });

  useEffect(() => {
    if (isInteractingRef.current || !snapshotFrame) return;
    visualGeometryRef.current = {
      x: snapshotFrame.x,
      y: snapshotFrame.y,
      width: snapshotFrame.width,
      height: snapshotFrame.height,
    };
  }, [snapshotFrame]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const onScroll = (event: Event) => {
      if (!isActiveRef.current || restoringRef.current) return;
      const target = event.target;
      if (target instanceof Element) {
        scrollMemoryRef.current.set(target, {
          top: target.scrollTop,
          left: target.scrollLeft,
        });
      }
    };
    node.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () =>
      node.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  useLayoutEffect(() => {
    isActiveRef.current = isActive;
    if (!isActive) return;
    restoringRef.current = true;
    let animationFrame = 0;
    let attempts = 0;
    const restore = () => {
      let pending = false;
      for (const [element, position] of scrollMemoryRef.current) {
        if (!element.isConnected) {
          scrollMemoryRef.current.delete(element);
          continue;
        }
        if (element.scrollTop !== position.top)
          element.scrollTop = position.top;
        if (element.scrollLeft !== position.left)
          element.scrollLeft = position.left;
        pending ||=
          element.scrollTop !== position.top ||
          element.scrollLeft !== position.left;
      }
      if (pending && attempts++ < 10) {
        animationFrame = requestAnimationFrame(restore);
      } else {
        restoringRef.current = false;
      }
    };
    restore();
    return () => {
      cancelAnimationFrame(animationFrame);
      restoringRef.current = false;
    };
  }, [isActive]);

  const cancelInteraction = useCallback(() => {
    if (!isInteractingRef.current) return;
    interactionCancelledRef.current = true;
    if (runtime.getDragSession() !== null) {
      runtime.cancelDrag();
    } else {
      runtime.cancelInteraction();
    }
    isInteractingRef.current = false;
    setIsMoving(false);
    suppressSnapRef.current = false;
    pointerRef.current = null;
    endPanelDrag();
  }, [endPanelDrag, runtime]);

  const { moveProps } = useMove({
    onMoveStart: () => {
      if (!snapshotFrame) return;
      const started = runtime.beginDrag(config.id);
      if (!started.ok) return;
      interactionCancelledRef.current = false;
      isInteractingRef.current = true;
      setIsMoving(true);
      visualGeometryRef.current = {
        x: snapshotFrame.x,
        y: snapshotFrame.y,
        width: snapshotFrame.width,
        height: snapshotFrame.height,
      };
      beginPanelDrag(config.id);
      if (isClustered) suppressSnapRef.current = true;
    },
    onMove: (event) => {
      if (!snapshotFrame || !isInteractingRef.current) return;
      const current = visualGeometryRef.current;
      const next = {
        ...current,
        x: current.x + event.deltaX,
        y: current.y + event.deltaY,
      };
      visualGeometryRef.current = next;
      const pointer = pointerRef.current
        ? {
            x: pointerRef.current.x + event.deltaX,
            y: pointerRef.current.y + event.deltaY,
          }
        : { x: next.x + next.width / 2, y: next.y + next.height / 2 };
      pointerRef.current = pointer;
      const mutation = runtime.updateDrag(config.id, next, pointer);
      if (mutation.ok) {
        recordPanelWorkspaceLayoutInput(
          mutation.value.expectedVersion,
          mutation.value.affectedPanelIds,
        );
      }
      const candidate = mutation.ok ? mutation.value.candidate : null;
      if (suppressSnapRef.current && candidate?.kind !== "panel-edge") {
        suppressSnapRef.current = false;
      }
      if (suppressSnapRef.current && candidate?.kind === "panel-edge") {
        runtime.suppressDragCandidate();
        updatePanelDropCandidate(null);
      } else {
        updatePanelDropCandidate(candidate);
      }
    },
    onMoveEnd: () => {
      if (!snapshotFrame) return;
      if (interactionCancelledRef.current) {
        interactionCancelledRef.current = false;
        isInteractingRef.current = false;
        setIsMoving(false);
        suppressSnapRef.current = false;
        pointerRef.current = null;
        endPanelDrag();
        return;
      }
      const ended = runtime.endDrag(config.id);
      if (ended.ok) {
        recordPanelWorkspaceLayoutInput(
          ended.value.expectedVersion,
          ended.value.affectedPanelIds,
        );
        if (ended.value.committed) {
          onCommitLayout(ended.value.layout);
        }
      }
      isInteractingRef.current = false;
      setIsMoving(false);
      suppressSnapRef.current = false;
      pointerRef.current = null;
      endPanelDrag();
    },
  });

  useEffect(() => {
    if (!isMoving) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      cancelInteraction();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [cancelInteraction, isMoving]);

  const resizeEdges = snapshotFrame?.resizeEdges ?? [];

  const handleResize = (
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ) => {
    recordPanelWorkspaceSolve();
    const mutation = runtime.resizePanelFromReference(
      config.id,
      edge,
      deltaX,
      deltaY,
    );
    if (mutation.ok) {
      recordPanelWorkspaceLayoutInput(
        mutation.value.expectedVersion,
        mutation.value.affectedPanelIds,
      );
    }
  };

  const appliedGeometry = snapshotFrame ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  const frameStyle: CSSProperties = {
    ...(side === "right"
      ? {
          right:
            dockOrigin.workspaceWidth -
            appliedGeometry.x -
            appliedGeometry.width,
        }
      : { left: appliedGeometry.x - dockOrigin.x }),
    top: appliedGeometry.y - dockOrigin.y,
    width: appliedGeometry.width,
    height: appliedGeometry.height,
    zIndex: frameZIndex(runtime, snapshotFrame, isMoving),
  };

  return (
    <div
      ref={wrapperRef}
      className="panel-wrapper workspace-panel-frame"
      data-panel={config.id}
      data-active={isActive}
      data-zone={snapshotFrame?.placementZone}
      data-mode={mode}
      data-side={side}
      data-dragging={isMoving}
      data-clustered={isClustered}
      data-layout-version={snapshotFrame?.layoutVersion}
      style={frameStyle}
      onPointerDown={(event) => {
        if (
          snapshotFrame !== null &&
          event.target instanceof Element &&
          !event.target.closest(".panel-move-handle, .panel-resize-handle")
        ) {
          onFocusPanel(config.id);
        }
      }}
      onPointerCancel={cancelInteraction}
    >
      <button
        {...moveProps}
        type="button"
        className="panel-move-handle"
        aria-label={`${config.name} 패널 이동`}
        onPointerDownCapture={(event) => {
          if (!snapshotFrame) return;
          pointerRef.current = {
            x: snapshotFrame.x + event.nativeEvent.offsetX,
            y: snapshotFrame.y + event.nativeEvent.offsetY,
          };
        }}
        onKeyDownCapture={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          cancelInteraction();
        }}
      >
        <span />
      </button>
      {draggedPanelId !== null &&
        draggedPanelId !== config.id &&
        dropCandidate?.kind === "panel-edge" &&
        dropCandidate.panelId === config.id && (
          <div className="panel-snap-targets" aria-hidden="true">
            <span
              className="panel-snap-target"
              data-edge={dropCandidate.edge}
              data-active="true"
            />
          </div>
        )}
      <PanelFrameContent
        config={config}
        contentId={contentId}
        mode={mode}
        side={side}
      />
      {resizeEdges.map((edge) => (
        <PanelSplitter
          key={edge}
          edge={edge}
          label={`${config.name} 패널 ${RESIZE_EDGE_LABELS[edge]} 크기 조절`}
          controls={contentId}
          value={
            edge === "left" || edge === "right"
              ? appliedGeometry.width
              : appliedGeometry.height
          }
          minValue={
            edge === "left" || edge === "right"
              ? (config.minWidth ?? 200)
              : (config.minHeight ?? 160)
          }
          maxValue={
            edge === "left" || edge === "right"
              ? (config.maxWidth ?? 800)
              : Math.max(
                  config.minHeight ?? 160,
                  runtime.coordinator.getSnapshot().workspaceRect.height,
                )
          }
          layoutVersion={snapshotFrame?.layoutVersion}
          onResizeStart={() => {
            runtime.beginInteraction();
            interactionCancelledRef.current = false;
            isInteractingRef.current = true;
          }}
          onResize={(deltaX, deltaY) => handleResize(edge, deltaX, deltaY)}
          onResizeEnd={() => {
            if (!interactionCancelledRef.current) {
              onCommitLayout(runtime.endInteraction());
            }
            interactionCancelledRef.current = false;
            isInteractingRef.current = false;
          }}
        />
      ))}
    </div>
  );
});

interface SnapshotPanelFrameProps {
  config: PanelConfig;
  dockOrigin: PanelDockOrigin;
  runtime: PanelWorkspaceRuntime;
  side: PanelSide;
  onCommitLayout: (layout: PanelWorkspaceLayoutV3) => boolean;
  onFocusPanel: (panelId: PanelId) => void;
}

function SnapshotPanelFrame(props: SnapshotPanelFrameProps) {
  const snapshotFrame = usePanelWorkspaceFrameSnapshot(
    props.runtime.coordinator,
    props.config.id,
  );

  useLayoutEffect(() => {
    if (snapshotFrame) {
      recordPanelFrameApplied(props.config.id, snapshotFrame.layoutVersion);
    }
  }, [props.config.id, snapshotFrame]);

  return <PanelFrame {...props} snapshotFrame={snapshotFrame} />;
}

function createRuntime(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceRuntime {
  const result = createPanelWorkspaceRuntime(layout, registry, surfaceRect);
  if (!result.ok) {
    throw new Error(
      `Failed to create panel workspace runtime: ${result.error}`,
    );
  }
  return result.value;
}

interface HydratedPanelWorkspaceProps {
  children: ReactNode;
  workspaceLayout: PanelWorkspaceLayoutV3;
  configs: readonly PanelConfig[];
  registry: readonly PanelWorkspaceRegistryEntry[];
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV3) => boolean;
  togglePanel: (panelId: PanelId) => void;
  focusPanel: (panelId: PanelId) => void;
  placementSurfaceRect: PanelWorkspaceRect;
  placementSurfaceRef: RefObject<HTMLDivElement | null>;
}

interface PanelWorkspaceOverlayProps {
  configs: readonly PanelConfig[];
  focusPanel: (panelId: PanelId) => void;
  runtime: PanelWorkspaceRuntime;
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV3) => boolean;
  togglePanel: (panelId: PanelId) => void;
  workspaceLayout: PanelWorkspaceLayoutV3;
  placementSurfaceRef: RefObject<HTMLDivElement | null>;
}

interface PanelDockOrigin {
  x: number;
  y: number;
  workspaceWidth: number;
}

interface PanelDockColumnPresentation {
  clusterId: string;
  columnIndex: number;
  height: number;
  width: number;
  x: number;
  y: number;
}

function panelDockColumns(
  clusters: readonly PanelWorkspaceClusterV3[],
  snapshot: PanelWorkspaceLayoutSnapshot,
): PanelDockColumnPresentation[] {
  return clusters.flatMap((cluster) =>
    cluster.columns.flatMap((column, columnIndex) => {
      const frames = column.rows.flatMap((row) => {
        const frame = snapshot.frameGeometries.get(row.panelId);
        return frame ? [frame] : [];
      });
      if (frames.length === 0) return [];
      const x = Math.min(...frames.map((frame) => frame.x));
      const y = Math.min(...frames.map((frame) => frame.y));
      const right = Math.max(...frames.map((frame) => frame.x + frame.width));
      const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
      return [
        {
          clusterId: cluster.id,
          columnIndex,
          height: bottom - y,
          width: right - x,
          x,
          y,
        },
      ];
    }),
  );
}

interface PanelDockClusterPresentationProps {
  dockOrigin: PanelDockOrigin;
  runtime: PanelWorkspaceRuntime;
}

function PanelDockClusterPresentation({
  dockOrigin,
  runtime,
}: PanelDockClusterPresentationProps) {
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);
  const columns = panelDockColumns(runtime.getLayout().clusters, snapshot);

  return (
    <>
      {columns.map((column) => {
        const left = column.x - dockOrigin.x;
        const top = column.y - dockOrigin.y;
        const cluster = runtime
          .getLayout()
          .clusters.find((candidate) => candidate.id === column.clusterId);
        const isRightAnchored = isRightAnchoredPlacementZone(
          cluster?.placementZone,
        );
        return (
          <div
            key={`${column.clusterId}:${column.columnIndex}`}
            className="panel-dock-column-presentation"
            data-cluster-id={column.clusterId}
            data-column-index={column.columnIndex}
          >
            <div
              aria-hidden="true"
              className="panel-dock-rail"
              style={{
                height: column.height,
                ...(isRightAnchored
                  ? {
                      right:
                        dockOrigin.workspaceWidth - column.x - column.width + 1,
                    }
                  : { left: left + column.width - 1 }),
                top,
              }}
            />
          </div>
        );
      })}
    </>
  );
}

function PanelWorkspaceZoneOverlay() {
  const { draggedPanelId, dropCandidate } = usePanelSnapInteraction();
  if (draggedPanelId === null) return null;

  return (
    <div className="panel-zone-overlay" aria-hidden="true">
      {PANEL_WORKSPACE_PLACEMENT_ZONES.map((zone) => (
        <span
          key={zone}
          className="panel-zone-target"
          data-zone={zone}
          data-active={
            dropCandidate?.kind === "zone" && dropCandidate.zone === zone
          }
        />
      ))}
    </div>
  );
}

interface PanelDockRenderProps {
  origin: PanelDockOrigin;
  surfaceStyle: CSSProperties;
}

interface PanelDockProps {
  children: (props: PanelDockRenderProps) => ReactNode;
  runtime: PanelWorkspaceRuntime;
}

function PanelDock({ children, runtime }: PanelDockProps) {
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);
  const origin = {
    x: 0,
    y: 0,
    workspaceWidth: snapshot.workspaceRect.width,
  };
  const surfaceStyle: CSSProperties = {
    inset: 0,
  };

  return (
    <div
      className="panel-dock"
      data-column-limit="2"
      data-layout-type="floating"
      data-layout-version={snapshot.version}
    >
      {children({ origin, surfaceStyle })}
    </div>
  );
}

const PanelWorkspaceOverlay = memo(function PanelWorkspaceOverlay({
  configs,
  focusPanel,
  runtime,
  setWorkspaceLayout,
  togglePanel,
  workspaceLayout,
  placementSurfaceRef,
}: PanelWorkspaceOverlayProps) {
  const activePanels = (side: PanelSide): PanelId[] =>
    workspaceLayout.railOrder[side].filter(
      (panelId) => workspaceLayout.visibility[panelId] === true,
    );

  return (
    <div className="panel-workspace" aria-label="패널 작업 영역">
      <div
        ref={placementSurfaceRef}
        className="panel-workspace-placement-surface"
      >
        <PanelDock runtime={runtime}>
          {({ origin, surfaceStyle }) => (
            <>
              {(["left", "right"] as const).map((side) => {
                const panelIds = workspaceLayout.railOrder[side];
                if (panelIds.length === 0) return null;
                return (
                  <div
                    key={side}
                    className="panel-activity-rail"
                    data-side={side}
                    style={{ zIndex: 2_100 }}
                  >
                    <PanelNav
                      side={side}
                      panelIds={panelIds}
                      activePanels={activePanels(side)}
                      onPanelClick={togglePanel}
                    />
                  </div>
                );
              })}

              <div className="panel-dock-surface" style={surfaceStyle}>
                <PanelWorkspaceZoneOverlay />
                <PanelDockClusterPresentation
                  dockOrigin={origin}
                  runtime={runtime}
                />
                {configs.map((config) => (
                  <SnapshotPanelFrame
                    key={config.id}
                    config={config}
                    dockOrigin={origin}
                    runtime={runtime}
                    side={railSideForPanel(workspaceLayout, config)}
                    onCommitLayout={setWorkspaceLayout}
                    onFocusPanel={focusPanel}
                  />
                ))}
                <PanelWorkspaceSharedSplitters
                  dockOrigin={origin}
                  runtime={runtime}
                  setWorkspaceLayout={setWorkspaceLayout}
                />
                {isPanelWorkspaceDiagnosticsEnabled() && (
                  <PanelWorkspaceTraceDriver
                    runtime={runtime}
                    setWorkspaceLayout={setWorkspaceLayout}
                  />
                )}
              </div>
            </>
          )}
        </PanelDock>
      </div>
    </div>
  );
});

function HydratedPanelWorkspace({
  children,
  workspaceLayout,
  configs,
  registry,
  setWorkspaceLayout,
  togglePanel,
  focusPanel,
  placementSurfaceRect,
  placementSurfaceRef,
}: HydratedPanelWorkspaceProps) {
  const [runtime] = useState(() =>
    createRuntime(workspaceLayout, registry, placementSurfaceRect),
  );
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);
  const hostStyle = {
    "--panel-workspace-inset-left": `${snapshot.occupiedInsets.left}px`,
    "--panel-workspace-inset-right": `${snapshot.occupiedInsets.right}px`,
    "--panel-workspace-inset-bottom": `${snapshot.occupiedInsets.bottom}px`,
  } as CSSProperties;

  useEffect(() => mountPanelWorkspaceDiagnostics(), []);

  useEffect(() => {
    if (runtime && workspaceLayout) {
      runtime.replaceCommittedLayout(workspaceLayout);
    }
  }, [runtime, workspaceLayout]);

  useEffect(
    () =>
      registerPanelWorkspaceActivationDispatcher((panelId) => {
        const mutation = runtime.activatePanel(panelId);
        if (!mutation.ok) return false;
        return setWorkspaceLayout(runtime.endInteraction());
      }),
    [runtime, setWorkspaceLayout],
  );

  useEffect(() => {
    runtime.updateWorkspaceRect(placementSurfaceRect);
  }, [placementSurfaceRect, runtime]);

  useEffect(
    () => () => {
      runtime?.destroy();
    },
    [runtime],
  );

  useLayoutEffect(() => {
    recordPanelWorkspaceCommit();
  });

  return (
    <div
      className="panel-workspace-host"
      data-layout-version={snapshot.version}
      style={hostStyle}
    >
      <div
        className="panel-workspace-main"
        data-layout-version={snapshot.version}
        data-main-x={snapshot.mainContentRect.x}
        data-main-width={snapshot.mainContentRect.width}
        data-main-height={snapshot.mainContentRect.height}
      >
        {children}
      </div>

      <PanelWorkspaceOverlay
        configs={configs}
        focusPanel={focusPanel}
        runtime={runtime}
        setWorkspaceLayout={setWorkspaceLayout}
        togglePanel={togglePanel}
        workspaceLayout={workspaceLayout}
        placementSurfaceRef={placementSurfaceRef}
      />
    </div>
  );
}

interface PanelWorkspaceContentProps {
  children: ReactNode;
}

function PanelWorkspaceContent({ children }: PanelWorkspaceContentProps) {
  const {
    workspaceLayout,
    initializeWorkspaceLayout,
    setWorkspaceLayout,
    togglePanel,
    focusPanel,
  } = usePanelLayout();
  const configs = useMemo(() => PanelRegistry.getAllPanels(), []);
  const registry = useMemo(
    () => configs.map(createPanelWorkspaceRegistryEntry),
    [configs],
  );
  const placementSurfaceRef = useRef<HTMLDivElement>(null);
  const [placementSurfaceRect, setPlacementSurfaceRect] =
    useState<PanelWorkspaceRect | null>(null);
  const isHydrated = workspaceLayout !== null;

  useLayoutEffect(() => {
    const surface = placementSurfaceRef.current;
    if (!surface) return;
    const updateRect = (): void => {
      const next = {
        width: surface.clientWidth,
        height: surface.clientHeight,
      };
      if (next.width <= 0 || next.height <= 0) return;
      setPlacementSurfaceRect((current) =>
        current?.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [isHydrated]);

  useLayoutEffect(() => {
    if (!workspaceLayout && placementSurfaceRect) {
      initializeWorkspaceLayout(registry, placementSurfaceRect);
    }
  }, [
    initializeWorkspaceLayout,
    placementSurfaceRect,
    registry,
    workspaceLayout,
  ]);

  if (!workspaceLayout || !placementSurfaceRect) {
    return (
      <div className="panel-workspace-host">
        <div className="panel-workspace-main">{children}</div>
        <div className="panel-workspace" aria-label="패널 작업 영역">
          <div
            ref={placementSurfaceRef}
            className="panel-workspace-placement-surface"
          />
        </div>
      </div>
    );
  }

  return (
    <HydratedPanelWorkspace
      children={children}
      workspaceLayout={workspaceLayout}
      configs={configs}
      registry={registry}
      setWorkspaceLayout={setWorkspaceLayout}
      togglePanel={togglePanel}
      focusPanel={focusPanel}
      placementSurfaceRect={placementSurfaceRect}
      placementSurfaceRef={placementSurfaceRef}
    />
  );
}

interface PanelWorkspaceProps {
  children: ReactNode;
}

export function PanelWorkspace({ children }: PanelWorkspaceProps) {
  return (
    <PanelSnapInteractionProvider>
      <PanelWorkspaceContent>{children}</PanelWorkspaceContent>
    </PanelSnapInteractionProvider>
  );
}
