import {
  Activity,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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
  PanelSnapEdge,
} from "../panels/core/types";
import { PanelNav } from "./PanelNav";
import {
  PanelSnapInteractionProvider,
  usePanelSnapInteraction,
} from "./PanelSnapContext";
import {
  mountPanelWorkspaceDiagnostics,
  recordPanelFrameApplied,
  recordPanelFrameCommit,
  recordPanelWorkspaceCommit,
  recordPanelWorkspaceLayoutInput,
  recordPanelWorkspaceSolve,
} from "./panelWorkspaceDiagnostics";
import type { PanelWorkspaceFrameSnapshot } from "./panelWorkspaceLayoutCoordinator";
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";
import {
  createPanelWorkspaceRuntime,
  type PanelWorkspaceRuntime,
} from "./panelWorkspaceRuntime";
import {
  usePanelWorkspaceFrameSnapshot,
  usePanelWorkspaceLayoutSnapshot,
} from "./usePanelWorkspaceLayoutSnapshot";
import "./PanelWorkspace.css";

const PANEL_RAIL_SIZE = 48;
const HEADER_HEIGHT = 48;
const SNAP_EDGES: PanelSnapEdge[] = ["top", "right", "bottom", "left"];

type PanelFrameMode = "hidden" | "anchored" | "placed";

const RESIZE_EDGE_LABELS: Record<PanelResizeEdge, string> = {
  left: "왼쪽",
  right: "오른쪽",
  top: "상단",
  bottom: "하단",
};

interface PanelResizeHandleProps {
  edge: PanelResizeEdge;
  config: PanelConfig;
  geometry: PanelFrameGeometry;
  layoutVersion?: number;
  onResizeStart: () => void;
  onResize: (edge: PanelResizeEdge, deltaX: number, deltaY: number) => void;
  onResizeEnd: () => void;
}

function PanelResizeHandle({
  edge,
  config,
  geometry,
  layoutVersion,
  onResizeStart,
  onResize,
  onResizeEnd,
}: PanelResizeHandleProps) {
  const adjustsWidth = edge === "left" || edge === "right";
  const { moveProps } = useMove({
    onMoveStart: onResizeStart,
    onMove: (event) => onResize(edge, event.deltaX, event.deltaY),
    onMoveEnd: onResizeEnd,
  });

  return (
    <div
      {...moveProps}
      className="panel-resize-handle"
      data-edge={edge}
      data-layout-version={layoutVersion}
      role="separator"
      aria-label={`${config.name} 패널 ${RESIZE_EDGE_LABELS[edge]} 크기 조절`}
      aria-orientation={adjustsWidth ? "vertical" : "horizontal"}
      aria-valuenow={adjustsWidth ? geometry.width : geometry.height}
      aria-valuemin={
        adjustsWidth ? (config.minWidth ?? 200) : (config.minHeight ?? 160)
      }
      aria-valuemax={
        adjustsWidth ? (config.maxWidth ?? 800) : (config.maxHeight ?? 800)
      }
      tabIndex={0}
    />
  );
}

function railSideForPanel(
  layout: PanelWorkspaceLayoutV2,
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
  return snapshotFrame.anchor === "floating" ? "placed" : "anchored";
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
  if (!snapshotFrame || snapshotFrame.anchor !== "floating") return 30;
  const layout = runtime.getLayout();
  const focusIndex = layout.floatingFocusOrder.indexOf(snapshotFrame.clusterId);
  return 1_000 + Math.max(0, focusIndex);
}

interface PanelFrameContentProps {
  config: PanelConfig;
  mode: PanelFrameMode;
  side: PanelSide;
}

const PanelFrameContent = memo(function PanelFrameContent({
  config,
  mode,
  side,
}: PanelFrameContentProps) {
  const PanelComponent = config.component;
  return (
    <div className="workspace-panel-content">
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
  runtime: PanelWorkspaceRuntime;
  snapshotFrame: PanelWorkspaceFrameSnapshot | null;
  side: PanelSide;
  onCommitLayout: (layout: PanelWorkspaceLayoutV2) => boolean;
  onFocusPanel: (panelId: PanelId) => void;
}

const PanelFrame = memo(function PanelFrame({
  config,
  runtime,
  snapshotFrame,
  side,
  onCommitLayout,
  onFocusPanel,
}: PanelFrameProps) {
  const {
    draggedPanelId,
    snapTarget,
    beginPanelDrag,
    updatePanelSnapTarget,
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
  const [isMoving, setIsMoving] = useState(false);
  const isActive = snapshotFrame !== null;
  const mode = frameMode(snapshotFrame);
  const isClustered = panelBelongsToMultiPanelCluster(runtime, config.id);

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

  const { moveProps } = useMove({
    onMoveStart: () => {
      if (!snapshotFrame) return;
      runtime.beginInteraction();
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
      if (!snapshotFrame) return;
      recordPanelWorkspaceSolve();
      const current = visualGeometryRef.current;
      const next = {
        ...current,
        x: current.x + event.deltaX,
        y: current.y + event.deltaY,
      };
      visualGeometryRef.current = next;
      const mutation = runtime.movePanel(config.id, next);
      if (mutation.ok) {
        recordPanelWorkspaceLayoutInput(
          mutation.value.expectedVersion,
          mutation.value.affectedPanelIds,
        );
      }
      const nearbyCandidate = runtime.resolveSnap(config.id, next);
      if (suppressSnapRef.current && nearbyCandidate === null) {
        suppressSnapRef.current = false;
      }
      const candidate = suppressSnapRef.current ? null : nearbyCandidate;
      updatePanelSnapTarget(
        candidate
          ? { panelId: candidate.targetPanelId, edge: candidate.edge }
          : null,
      );
    },
    onMoveEnd: () => {
      if (!snapshotFrame) return;
      if (interactionCancelledRef.current) {
        interactionCancelledRef.current = false;
        isInteractingRef.current = false;
        setIsMoving(false);
        suppressSnapRef.current = false;
        endPanelDrag();
        return;
      }
      const geometry = visualGeometryRef.current;
      const nearbyCandidate = runtime.resolveSnap(config.id, geometry);
      if (nearbyCandidate && !suppressSnapRef.current) {
        const mutation = runtime.snapPanel(
          config.id,
          nearbyCandidate.targetPanelId,
          nearbyCandidate.edge,
        );
        if (mutation.ok) {
          recordPanelWorkspaceLayoutInput(
            mutation.value.expectedVersion,
            mutation.value.affectedPanelIds,
          );
        }
      }
      onCommitLayout(runtime.endInteraction());
      isInteractingRef.current = false;
      setIsMoving(false);
      if (nearbyCandidate === null) suppressSnapRef.current = false;
      endPanelDrag();
    },
  });

  const resizeEdges: PanelResizeEdge[] =
    snapshotFrame?.anchor === "floating"
      ? ["left", "right", "bottom"]
      : side === "left"
        ? ["right", "bottom"]
        : side === "right"
          ? ["left", "bottom"]
          : ["top"];

  const handleResize = (
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ) => {
    recordPanelWorkspaceSolve();
    const mutation = runtime.resizePanel(config.id, edge, deltaX, deltaY);
    if (mutation.ok) {
      recordPanelWorkspaceLayoutInput(
        mutation.value.expectedVersion,
        mutation.value.affectedPanelIds,
      );
    }
  };

  const cancelInteraction = () => {
    if (!isInteractingRef.current) return;
    interactionCancelledRef.current = true;
    runtime.cancelInteraction();
    isInteractingRef.current = false;
    setIsMoving(false);
    suppressSnapRef.current = false;
    endPanelDrag();
  };

  const appliedGeometry = snapshotFrame ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  const frameStyle: CSSProperties = {
    left: appliedGeometry.x,
    top: appliedGeometry.y,
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
      data-mode={mode}
      data-side={side}
      data-dragging={isMoving}
      data-clustered={isClustered}
      data-layout-version={snapshotFrame?.layoutVersion}
      style={frameStyle}
      onPointerDown={(event) => {
        if (
          snapshotFrame?.anchor === "floating" &&
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
      >
        <span />
      </button>
      {draggedPanelId !== null && draggedPanelId !== config.id && (
        <div className="panel-snap-targets" aria-hidden="true">
          {SNAP_EDGES.map((edge) => (
            <span
              key={edge}
              className="panel-snap-target"
              data-edge={edge}
              data-active={
                snapTarget?.panelId === config.id && snapTarget.edge === edge
              }
            />
          ))}
        </div>
      )}
      <PanelFrameContent config={config} mode={mode} side={side} />
      {resizeEdges.map((edge) => (
        <PanelResizeHandle
          key={edge}
          edge={edge}
          config={config}
          geometry={appliedGeometry}
          layoutVersion={snapshotFrame?.layoutVersion}
          onResizeStart={() => {
            runtime.beginInteraction();
            interactionCancelledRef.current = false;
            isInteractingRef.current = true;
          }}
          onResize={handleResize}
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
  runtime: PanelWorkspaceRuntime;
  side: PanelSide;
  onCommitLayout: (layout: PanelWorkspaceLayoutV2) => boolean;
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
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceRuntime {
  const result = createPanelWorkspaceRuntime(
    layout,
    registry,
    {
      width: window.innerWidth,
      height: Math.max(0, window.innerHeight - HEADER_HEIGHT),
    },
    { left: PANEL_RAIL_SIZE, right: PANEL_RAIL_SIZE, bottom: PANEL_RAIL_SIZE },
  );
  if (!result.ok) {
    throw new Error(
      `Failed to create panel workspace runtime: ${result.error}`,
    );
  }
  return result.value;
}

interface HydratedPanelWorkspaceProps {
  children: ReactNode;
  workspaceLayout: PanelWorkspaceLayoutV2;
  configs: readonly PanelConfig[];
  registry: readonly PanelWorkspaceRegistryEntry[];
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV2) => boolean;
  togglePanel: (side: PanelSide, panelId: PanelId) => void;
  focusModalPanel: (panelId: PanelId) => void;
}

interface PanelWorkspaceOverlayProps {
  configs: readonly PanelConfig[];
  focusModalPanel: (panelId: PanelId) => void;
  runtime: PanelWorkspaceRuntime;
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV2) => boolean;
  togglePanel: (side: PanelSide, panelId: PanelId) => void;
  workspaceLayout: PanelWorkspaceLayoutV2;
}

const PanelWorkspaceOverlay = memo(function PanelWorkspaceOverlay({
  configs,
  focusModalPanel,
  runtime,
  setWorkspaceLayout,
  togglePanel,
  workspaceLayout,
}: PanelWorkspaceOverlayProps) {
  const activePanels = (side: PanelSide): PanelId[] =>
    workspaceLayout.railOrder[side].filter(
      (panelId) => workspaceLayout.visibility[panelId] === true,
    );

  return (
    <div className="panel-workspace" aria-label="패널 작업 영역">
      {(["left", "right", "bottom"] as const).map((side) => (
        <div
          key={side}
          className="panel-activity-rail"
          data-side={side}
          style={{ zIndex: 2_100 }}
        >
          <PanelNav
            side={side}
            panelIds={workspaceLayout.railOrder[side]}
            activePanels={activePanels(side)}
            onPanelClick={(panelId) => togglePanel(side, panelId)}
          />
        </div>
      ))}

      {configs.map((config) => (
        <SnapshotPanelFrame
          key={config.id}
          config={config}
          runtime={runtime}
          side={railSideForPanel(workspaceLayout, config)}
          onCommitLayout={setWorkspaceLayout}
          onFocusPanel={focusModalPanel}
        />
      ))}
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
  focusModalPanel,
}: HydratedPanelWorkspaceProps) {
  const [runtime] = useState(() => createRuntime(workspaceLayout, registry));
  const workspaceRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!runtime) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const updateSize = () => {
      runtime.updateWorkspaceRect({
        width: workspace.clientWidth,
        height: workspace.clientHeight,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [runtime]);

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
      ref={workspaceRef}
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
        focusModalPanel={focusModalPanel}
        runtime={runtime}
        setWorkspaceLayout={setWorkspaceLayout}
        togglePanel={togglePanel}
        workspaceLayout={workspaceLayout}
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
    focusModalPanel,
  } = usePanelLayout();
  const configs = useMemo(() => PanelRegistry.getAllPanels(), []);
  const registry = useMemo(
    () => configs.map(createPanelWorkspaceRegistryEntry),
    [configs],
  );

  useLayoutEffect(() => {
    if (!workspaceLayout) initializeWorkspaceLayout(registry);
  }, [initializeWorkspaceLayout, registry, workspaceLayout]);

  if (!workspaceLayout) {
    return (
      <div className="panel-workspace-host">
        <div className="panel-workspace-main">{children}</div>
        <div className="panel-workspace" aria-label="패널 작업 영역" />
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
      focusModalPanel={focusModalPanel}
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
