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
} from "react";
import { useMove } from "react-aria";
import { usePanelLayout } from "../hooks";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type {
  ModalPanelState,
  PanelConfig,
  PanelFrameGeometry,
  PanelId,
  PanelLayoutState,
  PanelResizeEdge,
  PanelSnapEdge,
  PanelSide,
  PanelSize,
} from "../panels/core/types";
import { registerPanelElement } from "../workspace/utils/panelLayoutRuntime";
import { PanelNav } from "./PanelNav";
import {
  PanelSnapInteractionProvider,
  usePanelSnapInteraction,
} from "./PanelSnapContext";
import { resolvePanelSnap, type PanelSnapCandidate } from "./panelSnap";
import {
  mountPanelWorkspaceDiagnostics,
  recordPanelFrameCommit,
  recordPanelWorkspaceCommit,
  recordPanelWorkspaceSolve,
} from "./panelWorkspaceDiagnostics";
import {
  panelBelongsToCluster,
  previewPanelClusterResize,
} from "./panelStackLayout";
import "./PanelWorkspace.css";

const PANEL_RAIL_SIZE = 48;
const PANEL_GAP = 8;
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
  onResizeStart: () => void;
  onResize: (edge: PanelResizeEdge, deltaX: number, deltaY: number) => void;
  onResizeEnd: () => void;
}

function PanelResizeHandle({
  edge,
  config,
  geometry,
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

function getPanelSide(
  layout: PanelLayoutState,
  panelId: PanelId,
): PanelSide | null {
  if (layout.leftPanels.includes(panelId)) return "left";
  if (layout.rightPanels.includes(panelId)) return "right";
  if (layout.bottomPanels.includes(panelId)) return "bottom";
  return null;
}

function isPanelActive(
  layout: PanelLayoutState,
  panelId: PanelId,
  side: PanelSide,
): boolean {
  if (side === "left") {
    return layout.showLeft && layout.activeLeftPanels.includes(panelId);
  }
  if (side === "right") {
    return layout.showRight && layout.activeRightPanels.includes(panelId);
  }
  return layout.showBottom && layout.activeBottomPanels.includes(panelId);
}

function defaultPanelSize(
  config: PanelConfig,
  layout: PanelLayoutState,
  side: PanelSide,
): PanelSize {
  const stored = layout.panelSizes[config.id];
  if (stored) return stored;
  return {
    width:
      config.defaultWidth ?? config.minWidth ?? (side === "bottom" ? 600 : 320),
    height:
      side === "bottom"
        ? layout.bottomHeight
        : (config.defaultHeight ?? config.minHeight ?? 420),
  };
}

function clampPanelSize(config: PanelConfig, size: PanelSize): PanelSize {
  return {
    width: Math.max(
      config.minWidth ?? 200,
      Math.min(config.maxWidth ?? 800, size.width),
    ),
    height: Math.max(
      config.minHeight ?? 160,
      Math.min(config.maxHeight ?? 800, size.height),
    ),
  };
}

function panelOffset(
  panelId: PanelId,
  activePanels: PanelId[],
  layout: PanelLayoutState,
): number {
  let offset = PANEL_RAIL_SIZE + PANEL_GAP;
  for (const id of activePanels) {
    if (id === panelId) break;
    const config = PanelRegistry.getPanel(id);
    if (!config) continue;
    offset += defaultPanelSize(config, layout, "left").width + PANEL_GAP;
  }
  return offset;
}

function findPanelSnapCandidate(
  panelId: PanelId,
  source: PanelFrameGeometry,
  frame: HTMLElement | null,
): PanelSnapCandidate | null {
  const workspace = frame?.closest<HTMLElement>(".panel-workspace");
  if (!workspace) return null;
  const workspaceRect = workspace.getBoundingClientRect();
  const targets = Array.from(
    workspace.querySelectorAll<HTMLElement>(
      '.workspace-panel-frame[data-active="true"]',
    ),
  )
    .filter((candidate) => candidate.dataset.panel !== panelId)
    .map((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return {
        panelId: candidate.dataset.panel as PanelId,
        geometry: {
          x: rect.left - workspaceRect.left,
          y: rect.top - workspaceRect.top,
          width: rect.width,
          height: rect.height,
        },
      };
    });

  return resolvePanelSnap(source, targets);
}

interface PanelFrameProps {
  config: PanelConfig;
  layout: PanelLayoutState;
  mode: PanelFrameMode;
  side: PanelSide;
  placedState?: ModalPanelState;
  offset: number;
  onResizeSessionStart: (panelId: PanelId) => void;
  onResizeSessionPreview: (
    panelId: PanelId,
    edge: PanelResizeEdge,
    geometry: PanelFrameGeometry,
  ) => PanelFrameGeometry | null;
  onResizeSessionEnd: (panelId: PanelId) => boolean;
}

const PanelFrame = memo(function PanelFrame({
  config,
  layout,
  mode,
  side,
  placedState,
  offset,
  onResizeSessionStart,
  onResizeSessionPreview,
  onResizeSessionEnd,
}: PanelFrameProps) {
  const {
    placePanel,
    snapPanel,
    focusModalPanel,
    updateModalPanelPosition,
    updatePanelSize,
    setBottomHeight,
  } = usePanelLayout();
  const {
    draggedPanelId,
    snapTarget,
    beginPanelDrag,
    updatePanelSnapTarget,
    endPanelDrag,
  } = usePanelSnapInteraction();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollMemoryRef = useRef(
    new Map<Element, { top: number; left: number }>(),
  );
  const isActiveRef = useRef(mode !== "hidden");
  const restoringRef = useRef(false);
  const isInteractingRef = useRef(false);
  const suppressSnapRef = useRef(false);

  const [isMoving, setIsMoving] = useState(false);
  const isClustered = layout.panelClusters.some((cluster) =>
    cluster.columns.some((column) => column.panelIds.includes(config.id)),
  );
  const size = placedState?.size ?? defaultPanelSize(config, layout, side);
  const initialGeometry = useMemo<PanelFrameGeometry>(() => {
    if (placedState) {
      return {
        x: placedState.position.x,
        y: placedState.position.y,
        width: placedState.size.width,
        height: placedState.size.height,
      };
    }
    if (side === "right") {
      return {
        x: window.innerWidth - offset - size.width,
        y: PANEL_GAP,
        width: size.width,
        height: size.height,
      };
    }
    if (side === "bottom") {
      return {
        x: Math.max(
          PANEL_RAIL_SIZE + PANEL_GAP,
          (window.innerWidth - size.width) / 2,
        ),
        y: window.innerHeight - HEADER_HEIGHT - size.height - PANEL_GAP,
        width: size.width,
        height: layout.bottomHeight,
      };
    }
    return { x: offset, y: PANEL_GAP, width: size.width, height: size.height };
  }, [placedState, layout.bottomHeight, offset, side, size.height, size.width]);
  const [visualGeometry, setVisualGeometry] =
    useState<PanelFrameGeometry>(initialGeometry);
  const visualGeometryRef = useRef(initialGeometry);

  useLayoutEffect(() => {
    recordPanelFrameCommit(config.id);
  });

  useEffect(() => {
    if (isInteractingRef.current) return;
    visualGeometryRef.current = initialGeometry;
    setVisualGeometry(initialGeometry);
  }, [initialGeometry]);

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
    const isActive = mode !== "hidden";
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
  }, [mode]);

  const { moveProps } = useMove({
    onMoveStart: () => {
      if (mode === "hidden") return;
      isInteractingRef.current = true;
      setIsMoving(true);
      beginPanelDrag(config.id);
      if (isClustered) suppressSnapRef.current = true;
      if (mode === "placed") focusModalPanel(config.id);
    },
    onMove: (event) => {
      if (mode === "hidden") return;
      recordPanelWorkspaceSolve();
      const current = visualGeometryRef.current;
      const next = {
        ...current,
        x: current.x + event.deltaX,
        y: current.y + event.deltaY,
      };
      visualGeometryRef.current = next;
      setVisualGeometry(next);
      const nearbyCandidate = findPanelSnapCandidate(
        config.id,
        next,
        wrapperRef.current,
      );
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
      if (mode === "hidden") return;
      const geometry = visualGeometryRef.current;
      const nearbyCandidate = findPanelSnapCandidate(
        config.id,
        geometry,
        wrapperRef.current,
      );
      isInteractingRef.current = false;
      setIsMoving(false);
      if (nearbyCandidate && !suppressSnapRef.current) {
        snapPanel(config.id, {
          targetPanelId: nearbyCandidate.targetPanelId,
          edge: nearbyCandidate.edge,
          source: geometry,
          target: nearbyCandidate.targetGeometry,
        });
      } else {
        placePanel(config.id, geometry);
      }
      if (nearbyCandidate === null) suppressSnapRef.current = false;
      endPanelDrag();
    },
  });

  const resizeEdges: PanelResizeEdge[] =
    mode === "placed"
      ? ["left", "right", "bottom"]
      : side === "left"
        ? ["right", "bottom"]
        : side === "right"
          ? ["left", "bottom"]
          : ["top"];

  const handleResizeStart = () => {
    isInteractingRef.current = true;
    onResizeSessionStart(config.id);
  };

  const handleResize = (
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ) => {
    recordPanelWorkspaceSolve();
    const current = visualGeometryRef.current;
    const next = { ...current };

    if (edge === "left") {
      const nextSize = clampPanelSize(config, {
        width: current.width - deltaX,
        height: current.height,
      });
      next.width = nextSize.width;
      next.x = current.x + current.width - nextSize.width;
    } else if (edge === "right") {
      next.width = clampPanelSize(config, {
        width: current.width + deltaX,
        height: current.height,
      }).width;
    } else if (edge === "top") {
      const nextSize = clampPanelSize(config, {
        width: current.width,
        height: current.height - deltaY,
      });
      next.height = nextSize.height;
      next.y = current.y + current.height - nextSize.height;
    } else {
      next.height = clampPanelSize(config, {
        width: current.width,
        height: current.height + deltaY,
      }).height;
    }

    const previewGeometry = onResizeSessionPreview(config.id, edge, next);
    const visualNext = previewGeometry ?? next;
    visualGeometryRef.current = visualNext;
    setVisualGeometry(visualNext);
  };

  const handleResizeEnd = () => {
    isInteractingRef.current = false;
    if (onResizeSessionEnd(config.id)) return;
    const geometry = visualGeometryRef.current;
    updatePanelSize(config.id, {
      width: geometry.width,
      height: geometry.height,
    });
    if (mode === "placed") {
      updateModalPanelPosition(config.id, {
        x: geometry.x,
        y: geometry.y,
      });
    }
    if (side === "bottom" && mode === "anchored") {
      setBottomHeight(geometry.height);
    }
  };

  const frameStyle: CSSProperties = {
    left: visualGeometry.x,
    top: visualGeometry.y,
    width: visualGeometry.width,
    height: visualGeometry.height,
    zIndex: isMoving ? layout.nextModalZIndex : (placedState?.zIndex ?? 30),
  };

  const PanelComponent = config.component;
  const content = (
    <PanelComponent
      isActive={true}
      side={side}
      displayMode={mode === "placed" ? "floating" : "panel"}
      onClose={undefined}
    />
  );
  return (
    <div
      ref={wrapperRef}
      className="panel-wrapper workspace-panel-frame"
      data-panel={config.id}
      data-active={mode !== "hidden"}
      data-mode={mode}
      data-side={side}
      data-dragging={isMoving}
      data-clustered={isClustered}
      style={frameStyle}
      onPointerDown={() => {
        if (mode === "placed") focusModalPanel(config.id);
      }}
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
      <div className="workspace-panel-content">
        <Activity mode={mode === "hidden" ? "hidden" : "visible"}>
          {content}
        </Activity>
      </div>
      {resizeEdges.map((edge) => (
        <PanelResizeHandle
          key={edge}
          edge={edge}
          config={config}
          geometry={visualGeometry}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      ))}
    </div>
  );
});

function PanelWorkspaceContent() {
  const { layout, togglePanel, fitPanelClusters, setLayout } = usePanelLayout();
  const [resizePreviewLayout, setResizePreviewLayout] =
    useState<PanelLayoutState | null>(null);
  const resizeBaseLayoutRef = useRef<PanelLayoutState | null>(null);
  const resizePreviewLayoutRef = useRef<PanelLayoutState | null>(null);
  const effectiveLayout = resizePreviewLayout ?? layout;
  const configs = useMemo(() => PanelRegistry.getAllPanels(), []);
  const placedIds = useMemo(
    () => new Set(effectiveLayout.modalPanels.map((panel) => panel.panelId)),
    [effectiveLayout.modalPanels],
  );
  const activeLeftPanels = effectiveLayout.activeLeftPanels.filter(
    (panelId) => !placedIds.has(panelId),
  );
  const activeRightPanels = effectiveLayout.activeRightPanels.filter(
    (panelId) => !placedIds.has(panelId),
  );

  useEffect(() => mountPanelWorkspaceDiagnostics(), []);

  useLayoutEffect(() => {
    recordPanelWorkspaceCommit();
  });

  const beginResizeSession = useCallback(
    (panelId: PanelId) => {
      resizePreviewLayoutRef.current = null;
      setResizePreviewLayout(null);
      resizeBaseLayoutRef.current = panelBelongsToCluster(layout, panelId)
        ? layout
        : null;
    },
    [layout],
  );

  const previewResizeSession = useCallback(
    (
      panelId: PanelId,
      edge: PanelResizeEdge,
      geometry: PanelFrameGeometry,
    ): PanelFrameGeometry | null => {
      const baseLayout = resizeBaseLayoutRef.current;
      if (!baseLayout) return null;

      const previewLayout = previewPanelClusterResize(
        baseLayout,
        panelId,
        edge,
        geometry,
        {
          width: window.innerWidth,
          height: Math.max(0, window.innerHeight - HEADER_HEIGHT),
        },
      );
      const panel = previewLayout.modalPanels.find(
        (candidate) => candidate.panelId === panelId,
      );
      if (!panel) return null;

      resizePreviewLayoutRef.current = previewLayout;
      setResizePreviewLayout(previewLayout);
      return {
        x: panel.position.x,
        y: panel.position.y,
        width: panel.size.width,
        height: panel.size.height,
      };
    },
    [],
  );

  const endResizeSession = useCallback(
    (_panelId: PanelId): boolean => {
      const previewLayout = resizePreviewLayoutRef.current;
      resizeBaseLayoutRef.current = null;
      resizePreviewLayoutRef.current = null;
      setResizePreviewLayout(null);
      if (!previewLayout) return false;

      setLayout(previewLayout);
      return true;
    },
    [setLayout],
  );

  useEffect(() => {
    const fit = () => fitPanelClusters();
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fitPanelClusters]);

  return (
    <div className="panel-workspace" aria-label="패널 작업 영역">
      <div
        className="panel-rail-measure panel-rail-measure-left"
        style={{ width: PANEL_RAIL_SIZE }}
        ref={(element) => registerPanelElement("left", element)}
      />
      <div
        className="panel-rail-measure panel-rail-measure-right"
        style={{ width: PANEL_RAIL_SIZE }}
        ref={(element) => registerPanelElement("right", element)}
      />

      <div
        className="panel-activity-rail"
        data-side="left"
        style={{ zIndex: effectiveLayout.nextModalZIndex + 1 }}
      >
        <PanelNav
          side="left"
          panelIds={effectiveLayout.leftPanels}
          activePanels={effectiveLayout.activeLeftPanels}
          onPanelClick={(panelId) => togglePanel("left", panelId)}
        />
      </div>
      <div
        className="panel-activity-rail"
        data-side="right"
        style={{ zIndex: effectiveLayout.nextModalZIndex + 1 }}
      >
        <PanelNav
          side="right"
          panelIds={effectiveLayout.rightPanels}
          activePanels={effectiveLayout.activeRightPanels}
          onPanelClick={(panelId) => togglePanel("right", panelId)}
        />
      </div>
      <div
        className="panel-activity-rail"
        data-side="bottom"
        style={{ zIndex: effectiveLayout.nextModalZIndex + 1 }}
      >
        <PanelNav
          side="bottom"
          panelIds={effectiveLayout.bottomPanels}
          activePanels={effectiveLayout.activeBottomPanels}
          onPanelClick={(panelId) => togglePanel("bottom", panelId)}
        />
      </div>

      {configs.map((config) => {
        const placedState = effectiveLayout.modalPanels.find(
          (panel) => panel.panelId === config.id,
        );
        const side =
          getPanelSide(effectiveLayout, config.id) ?? config.defaultPosition;
        const isActive = isPanelActive(effectiveLayout, config.id, side);
        const mode: PanelFrameMode = isActive
          ? placedState
            ? "placed"
            : "anchored"
          : "hidden";
        const activePanels =
          side === "left"
            ? activeLeftPanels
            : side === "right"
              ? activeRightPanels
              : effectiveLayout.activeBottomPanels;
        const offset =
          side === "bottom"
            ? PANEL_RAIL_SIZE + PANEL_GAP
            : panelOffset(config.id, activePanels, effectiveLayout);

        return (
          <PanelFrame
            key={config.id}
            config={config}
            layout={effectiveLayout}
            mode={mode}
            side={side}
            placedState={placedState}
            offset={offset}
            onResizeSessionStart={beginResizeSession}
            onResizeSessionPreview={previewResizeSession}
            onResizeSessionEnd={endResizeSession}
          />
        );
      })}
    </div>
  );
}

export function PanelWorkspace() {
  return (
    <PanelSnapInteractionProvider>
      <PanelWorkspaceContent />
    </PanelSnapInteractionProvider>
  );
}
