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
import { PanelToggleGroup } from "./PanelToggleGroup";
import { getPanelLabel } from "./panelLabels";
import { registerPanelWorkspaceActivationDispatcher } from "./panelWorkspaceActivationDispatcher";
import {
  PanelSnapInteractionProvider,
  usePanelSnapInteractionActions,
  usePanelSnapInteractionState,
} from "./PanelSnapContext";
import { panelDragMovedBeyondSnapThreshold } from "./panelSnap";
import type { PanelDropCandidate } from "./panelWorkspaceZoneDrop";
import { PanelSplitter } from "./PanelSplitter";
import type {
  PanelWorkspaceFrameSnapshot,
  PanelWorkspaceLayoutSnapshot,
  PanelWorkspaceSplitterGeometry,
} from "./panelWorkspaceLayoutCoordinator";
import {
  createPanelWorkspaceRegistryEntry,
  PANEL_WORKSPACE_GAP,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  PANEL_WORKSPACE_SNAP_ZONES,
  type PanelWorkspaceClusterV4,
  type PanelWorkspaceLayoutV4,
} from "./panelWorkspaceLayoutV4";
import {
  createPanelWorkspaceRuntime,
  type PanelWorkspaceRuntime,
} from "./panelWorkspaceRuntime";
import {
  usePanelWorkspaceFrameSnapshot,
  usePanelWorkspaceLayoutSnapshot,
} from "./usePanelWorkspaceLayoutSnapshot";
import { useI18n } from "../../i18n";
import "./PanelWorkspace.css";

type PanelFrameMode = "hidden" | "placed";

function isRightAnchoredPlacementZone(
  placementZone: PanelWorkspaceClusterV4["placementZone"] | undefined,
): boolean {
  return Boolean(
    placementZone &&
    (placementZone === "right" || placementZone.endsWith("-right")),
  );
}

const RESIZE_EDGE_TRANSLATION_KEYS: Record<PanelResizeEdge, string> = {
  left: "workspace.left",
  right: "workspace.right",
  top: "workspace.top",
  bottom: "workspace.bottom",
};

function railSideForPanel(
  layout: PanelWorkspaceLayoutV4,
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
  const layout = runtime.getLayout();
  const cached = multiPanelClusterMembershipCache.get(runtime);
  if (cached?.layout === layout) return cached.panelIds.has(panelId);

  const panelIds = new Set<PanelId>();
  for (const cluster of layout.clusters) {
    let clusterPanelCount = 0;
    for (const column of cluster.columns) {
      clusterPanelCount += column.rows.length;
    }
    if (clusterPanelCount <= 1) continue;
    for (const column of cluster.columns) {
      for (const row of column.rows) panelIds.add(row.panelId);
    }
  }

  multiPanelClusterMembershipCache.set(runtime, { layout, panelIds });
  return panelIds.has(panelId);
}

const multiPanelClusterMembershipCache = new WeakMap<
  PanelWorkspaceRuntime,
  { layout: PanelWorkspaceLayoutV4; panelIds: ReadonlySet<PanelId> }
>();

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
  if (!layout.clusterFocusOrder.includes(clusterId)) return 30;
  return 1_000 + Math.max(0, layout.clusterFocusOrder.indexOf(clusterId));
}

const registryLookupCache = new WeakMap<
  readonly PanelWorkspaceRegistryEntry[],
  ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>
>();

function registryEntryMap(
  registry: readonly PanelWorkspaceRegistryEntry[],
): ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry> {
  const cached = registryLookupCache.get(registry);
  if (cached) return cached;
  const entries = new Map(registry.map((entry) => [entry.id, entry] as const));
  registryLookupCache.set(registry, entries);
  return entries;
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
  registry: readonly PanelWorkspaceRegistryEntry[],
  configsByPanelId: ReadonlyMap<PanelId, PanelConfig>,
  getPanelName: (config: PanelConfig) => string,
  t: (key: string, params?: Record<string, string | number>) => string,
): SharedSplitterContract | null {
  const panelId = splitter.beforePanelIds[0];
  if (!panelId) return null;
  const frame = snapshot.frameGeometries.get(panelId);
  if (!frame) return null;
  const entriesByPanelId = registryEntryMap(registry);
  const beforeConfigs = splitter.beforePanelIds.flatMap((candidate) => {
    const config = configsByPanelId.get(candidate);
    return config ? [config] : [];
  });
  if (beforeConfigs.length === 0) return null;
  const beforeEntries = splitter.beforePanelIds.flatMap((candidate) => {
    const entry = entriesByPanelId.get(candidate);
    return entry ? [entry] : [];
  });
  if (beforeEntries.length === 0) return null;
  const beforeNames = beforeConfigs.map(getPanelName).join(", ");
  const afterNames = splitter.afterPanelIds
    .flatMap((candidate) => {
      const config = configsByPanelId.get(candidate);
      return config ? [getPanelName(config)] : [];
    })
    .join(", ");

  if (splitter.kind === "row") {
    return {
      controls: `panel-${panelId}-content`,
      edge: "bottom",
      label: t("workspace.resizeRow", {
        before: beforeNames,
        after: afterNames,
      }),
      maxValue: Math.max(
        Math.max(...beforeEntries.map((entry) => entry.minHeight)),
        snapshot.workspaceRect.height,
      ),
      minValue: Math.max(...beforeEntries.map((entry) => entry.minHeight)),
      panelId,
      value: frame.height,
    };
  }

  const minValue = Math.max(...beforeEntries.map((entry) => entry.minWidth));
  const maxValue = Math.max(
    minValue,
    Math.min(...beforeEntries.map((entry) => entry.maxWidth)),
  );
  return {
    controls: splitter.beforePanelIds
      .map((candidate) => `panel-${candidate}-content`)
      .join(" "),
    edge: "right",
    label: t("workspace.resizeColumn", {
      before: beforeNames,
      after: afterNames,
    }),
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
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV4) => boolean;
}

interface PanelWorkspaceSharedSplittersProps extends PanelWorkspaceRuntimeProps {
  configs: readonly PanelConfig[];
  dockOrigin: PanelDockOrigin;
}

function PanelWorkspaceSharedSplitters({
  configs,
  dockOrigin,
  runtime,
  setWorkspaceLayout,
}: PanelWorkspaceSharedSplittersProps) {
  const { t } = useI18n();
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);
  const configsByPanelId = useMemo(
    () => new Map(configs.map((config) => [config.id, config] as const)),
    [configs],
  );

  return (
    <>
      {snapshot.splitters.map((splitter) => {
        const contract = sharedSplitterContract(
          splitter,
          snapshot,
          runtime.getRegistry(),
          configsByPanelId,
          (config) => getPanelLabel(config, t),
          t,
        );
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
              runtime.resizePanelFromReference(
                contract.panelId,
                contract.edge,
                deltaX,
                deltaY,
              );
            }}
            onResizeEnd={() => setWorkspaceLayout(runtime.endInteraction())}
          />
        );
      })}
    </>
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
    // `data-panel-id` 는 `useActiveScope` 가 "지금 어느 패널에 포커스가 있는가"
    // 를 읽는 유일한 표식이다. emitter 가 없어 판정이 늘 "보이는 첫 우측 패널"
    // 폴백으로 떨어졌고, 그래서 좌측 레이어 트리에 포커스를 둬도 scope 가
    // panel:styles 로 잡혔다 (2026-08-27 code-review #13 실측).
    <div
      id={contentId}
      data-panel-id={config.id}
      className="workspace-panel-content"
    >
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
  onCommitLayout: (layout: PanelWorkspaceLayoutV4) => boolean;
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
  const { t } = useI18n();
  const { beginPanelDrag, updatePanelDropCandidate, endPanelDrag } =
    usePanelSnapInteractionActions();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const visualGeometryRef = useRef<PanelFrameGeometry>({
    x: snapshotFrame?.x ?? 0,
    y: snapshotFrame?.y ?? 0,
    width: snapshotFrame?.width ?? 0,
    height: snapshotFrame?.height ?? 0,
  });
  const dragStartGeometryRef = useRef<PanelFrameGeometry | null>(null);
  const scrollMemoryRef = useRef(
    new Map<Element, { top: number; left: number }>(),
  );
  const isActiveRef = useRef(snapshotFrame !== null);
  const restoringRef = useRef(false);
  const isInteractingRef = useRef(false);
  const suppressSnapRef = useRef(false);
  const interactionCancelledRef = useRef(false);
  const pendingDropCandidateRef = useRef<PanelDropCandidate>(null);
  const dropCandidateFrameRef = useRef<number | null>(null);

  const flushDropCandidate = useCallback(() => {
    if (dropCandidateFrameRef.current !== null) {
      cancelAnimationFrame(dropCandidateFrameRef.current);
      dropCandidateFrameRef.current = null;
    }
    const candidate = pendingDropCandidateRef.current;
    pendingDropCandidateRef.current = null;
    updatePanelDropCandidate(candidate);
  }, [updatePanelDropCandidate]);

  const scheduleDropCandidate = useCallback(
    (candidate: PanelDropCandidate) => {
      pendingDropCandidateRef.current = candidate;
      if (dropCandidateFrameRef.current !== null) return;
      dropCandidateFrameRef.current = requestAnimationFrame(() => {
        dropCandidateFrameRef.current = null;
        const nextCandidate = pendingDropCandidateRef.current;
        pendingDropCandidateRef.current = null;
        updatePanelDropCandidate(nextCandidate);
      });
    },
    [updatePanelDropCandidate],
  );

  useEffect(
    () => () => {
      if (dropCandidateFrameRef.current !== null) {
        cancelAnimationFrame(dropCandidateFrameRef.current);
      }
    },
    [],
  );
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const isActive = snapshotFrame !== null;
  const mode = frameMode(snapshotFrame);
  const isClustered = panelBelongsToMultiPanelCluster(runtime, config.id);
  const contentId = `panel-${config.id}-content`;
  const panelName = getPanelLabel(config, t);

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
    dragStartGeometryRef.current = null;
    pointerRef.current = null;
    flushDropCandidate();
    endPanelDrag();
  }, [endPanelDrag, flushDropCandidate, runtime]);

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
      dragStartGeometryRef.current = { ...visualGeometryRef.current };
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
      const candidate = mutation.ok ? mutation.value.candidate : null;
      const dragStart = dragStartGeometryRef.current;
      if (
        suppressSnapRef.current &&
        dragStart &&
        panelDragMovedBeyondSnapThreshold(dragStart, next)
      ) {
        suppressSnapRef.current = false;
      }
      if (suppressSnapRef.current) {
        runtime.suppressDragCandidate();
        scheduleDropCandidate(null);
      } else {
        scheduleDropCandidate(candidate);
      }
    },
    onMoveEnd: () => {
      if (!snapshotFrame) return;
      if (interactionCancelledRef.current) {
        interactionCancelledRef.current = false;
        isInteractingRef.current = false;
        setIsMoving(false);
        suppressSnapRef.current = false;
        dragStartGeometryRef.current = null;
        pointerRef.current = null;
        flushDropCandidate();
        endPanelDrag();
        return;
      }
      const ended = runtime.endDrag(config.id);
      flushDropCandidate();
      if (ended.ok) {
        if (ended.value.committed) {
          onCommitLayout(ended.value.layout);
        }
      }
      isInteractingRef.current = false;
      setIsMoving(false);
      suppressSnapRef.current = false;
      dragStartGeometryRef.current = null;
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
  const registry = runtime.getRegistry();
  const registryEntry = useMemo(
    () => registry.find((entry) => entry.id === config.id),
    [config.id, registry],
  );
  const minWidth = registryEntry?.minWidth ?? 200;
  const maxWidth = registryEntry?.maxWidth ?? 800;
  const minHeight = registryEntry?.minHeight ?? 160;

  const handleResize = (
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ) => {
    runtime.resizePanelFromReference(config.id, edge, deltaX, deltaY);
  };

  const appliedGeometry = snapshotFrame ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };
  // 수평 렌더링 기준은 원래 rail이 아니라 현재 배치된 zone이어야 한다.
  // cross-rail snap 이후에도 railSideForPanel()은 rail identity를 보존하므로
  // side를 기준으로 하면 반대편 anchor가 무시된다.
  const rightAnchored = isRightAnchoredPlacementZone(
    snapshotFrame?.placementZone,
  );
  const frameStyle: CSSProperties = {
    ...(rightAnchored
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
        aria-label={t("workspace.movePanel", { panel: panelName })}
        onPointerDownCapture={(event) => {
          if (!snapshotFrame) return;
          const handleRect = event.currentTarget.getBoundingClientRect();
          pointerRef.current = {
            x: snapshotFrame.x + event.clientX - handleRect.left,
            y: snapshotFrame.y + event.clientY - handleRect.top,
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
          label={t("workspace.resizePanel", {
            panel: panelName,
            edge: t(RESIZE_EDGE_TRANSLATION_KEYS[edge]),
          })}
          controls={contentId}
          value={
            edge === "left" || edge === "right"
              ? appliedGeometry.width
              : appliedGeometry.height
          }
          minValue={edge === "left" || edge === "right" ? minWidth : minHeight}
          maxValue={
            edge === "left" || edge === "right"
              ? maxWidth
              : Math.max(
                  minHeight,
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
  onCommitLayout: (layout: PanelWorkspaceLayoutV4) => boolean;
  onFocusPanel: (panelId: PanelId) => void;
}

function SnapshotPanelFrame(props: SnapshotPanelFrameProps) {
  const snapshotFrame = usePanelWorkspaceFrameSnapshot(
    props.runtime.coordinator,
    props.config.id,
  );

  return <PanelFrame {...props} snapshotFrame={snapshotFrame} />;
}

function createRuntime(
  layout: PanelWorkspaceLayoutV4,
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
  chrome?: ReactNode;
  workspaceLayout: PanelWorkspaceLayoutV4;
  configs: readonly PanelConfig[];
  registry: readonly PanelWorkspaceRegistryEntry[];
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV4) => boolean;
  togglePanel: (panelId: PanelId) => void;
  focusPanel: (panelId: PanelId) => void;
  stageRect: PanelWorkspaceRect;
  stageRef: RefObject<HTMLDivElement | null>;
}

interface PanelWorkspaceOverlayProps {
  chrome?: ReactNode;
  configs: readonly PanelConfig[];
  focusPanel: (panelId: PanelId) => void;
  runtime: PanelWorkspaceRuntime;
  setWorkspaceLayout: (layout: PanelWorkspaceLayoutV4) => boolean;
  togglePanel: (panelId: PanelId) => void;
  workspaceLayout: PanelWorkspaceLayoutV4;
  stageRef: RefObject<HTMLDivElement | null>;
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
  clusters: readonly PanelWorkspaceClusterV4[],
  snapshot: PanelWorkspaceLayoutSnapshot,
): PanelDockColumnPresentation[] {
  const columns: PanelDockColumnPresentation[] = [];
  for (const cluster of clusters) {
    for (
      let columnIndex = 0;
      columnIndex < cluster.columns.length;
      columnIndex += 1
    ) {
      const column = cluster.columns[columnIndex];
      if (!column) continue;
      let x = Number.POSITIVE_INFINITY;
      let y = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      let hasFrame = false;
      for (const row of column.rows) {
        const frame = snapshot.frameGeometries.get(row.panelId);
        if (!frame) continue;
        hasFrame = true;
        x = Math.min(x, frame.x);
        y = Math.min(y, frame.y);
        right = Math.max(right, frame.x + frame.width);
        bottom = Math.max(bottom, frame.y + frame.height);
      }
      if (!hasFrame) continue;
      columns.push({
        clusterId: cluster.id,
        columnIndex,
        height: bottom - y,
        width: right - x,
        x,
        y,
      });
    }
  }
  return columns;
}

function panelClusterMap(
  layout: PanelWorkspaceLayoutV4,
  invalidationRevision: number,
): ReadonlyMap<string, PanelWorkspaceClusterV4> {
  // Runtime layout is mutable; the revision invalidates the memoized map.
  void invalidationRevision;
  return new Map(
    layout.clusters.map((cluster) => [cluster.id, cluster] as const),
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
  const layout = runtime.getLayout();
  const columns = panelDockColumns(layout.clusters, snapshot);
  const clustersById = useMemo(
    () => panelClusterMap(runtime.getLayout(), snapshot.version),
    [runtime, snapshot.version],
  );

  return (
    <>
      {columns.map((column) => {
        const left = column.x - dockOrigin.x;
        const top = column.y - dockOrigin.y;
        const cluster = clustersById.get(column.clusterId);
        const isRightAnchored = isRightAnchoredPlacementZone(
          cluster?.placementZone,
        );
        return (
          <div
            key={`${column.clusterId}:${column.columnIndex}`}
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
        );
      })}
    </>
  );
}

function PanelWorkspaceZoneOverlay() {
  const { draggedPanelId, dropCandidate } = usePanelSnapInteractionState();
  if (draggedPanelId === null) return null;

  return (
    <div className="panel-zone-overlay" aria-hidden="true">
      {PANEL_WORKSPACE_SNAP_ZONES.map((zone) => {
        const zoneIndex = PANEL_WORKSPACE_PLACEMENT_ZONES.indexOf(zone);
        return (
          <span
            key={zone}
            className="panel-zone-target"
            data-zone={zone}
            style={{
              gridColumn: (zoneIndex % 3) + 1,
              gridRow: Math.floor(zoneIndex / 3) + 1,
            }}
            data-active={
              dropCandidate?.kind === "zone" && dropCandidate.zone === zone
            }
          />
        );
      })}
    </div>
  );
}

interface PanelSnapGuideProps {
  candidate: Exclude<PanelDropCandidate, null | { kind: "zone" }>;
  dockOrigin: PanelDockOrigin;
  snapshot: PanelWorkspaceLayoutSnapshot;
}

function PanelSnapGuide({
  candidate,
  dockOrigin,
  snapshot,
}: PanelSnapGuideProps) {
  const target = snapshot.frameGeometries.get(candidate.panelId);
  if (!target) return null;

  const halfGap = PANEL_WORKSPACE_GAP / 2;
  const horizontal = candidate.edge === "top" || candidate.edge === "bottom";
  const targetLeft = target.x - dockOrigin.x;
  const targetTop = target.y - dockOrigin.y;
  const rawExtentStart = horizontal ? targetLeft : targetTop;
  const rawExtentEnd =
    rawExtentStart + (horizontal ? target.width : target.height);
  const workspaceExtent = horizontal
    ? snapshot.workspaceRect.width
    : snapshot.workspaceRect.height;
  const extentStart = Math.min(workspaceExtent, Math.max(0, rawExtentStart));
  const extentEnd = Math.min(
    workspaceExtent,
    Math.max(extentStart, rawExtentEnd),
  );
  const extent = extentEnd - extentStart;
  const guideCenter = horizontal
    ? candidate.edge === "top"
      ? targetTop - halfGap
      : targetTop + target.height + halfGap
    : candidate.edge === "left"
      ? targetLeft - halfGap
      : targetLeft + target.width + halfGap;
  const centeredGuidePosition = `clamp(0px, calc(${guideCenter}px - var(--panel-interaction-line-size) / 2), calc(100% - var(--panel-interaction-line-size)))`;
  const style: CSSProperties = {
    bottom: "auto",
    height: horizontal ? undefined : extent,
    left: horizontal ? extentStart : centeredGuidePosition,
    right: "auto",
    top: horizontal ? centeredGuidePosition : extentStart,
    width: horizontal ? extent : undefined,
  };

  return (
    <span
      className="panel-snap-target panel-snap-guide"
      data-edge={candidate.edge}
      style={style}
    />
  );
}

interface PanelDockRenderProps {
  origin: PanelDockOrigin;
}

interface PanelDockProps {
  children: (props: PanelDockRenderProps) => ReactNode;
  chrome?: ReactNode;
  stageRef: RefObject<HTMLDivElement | null>;
  surfaceWidth: number;
  version: number;
}

function PanelDock({
  children,
  chrome,
  stageRef,
  surfaceWidth,
  version,
}: PanelDockProps) {
  const origin = useMemo<PanelDockOrigin>(() => {
    const origin = {
      x: 0,
      y: 0,
      workspaceWidth: surfaceWidth,
    };
    return origin;
  }, [surfaceWidth]);

  return (
    <div
      className="panel-dock"
      data-column-limit="2"
      data-layout-type="floating"
      data-layout-version={version}
    >
      {chrome ? <div className="panel-dock-chrome">{chrome}</div> : null}
      <div ref={stageRef} className="panel-dock-stage">
        {children({ origin })}
      </div>
    </div>
  );
}

const PanelWorkspaceOverlay = memo(function PanelWorkspaceOverlay({
  chrome,
  configs,
  focusPanel,
  runtime,
  setWorkspaceLayout,
  togglePanel,
  workspaceLayout,
  stageRef,
}: PanelWorkspaceOverlayProps) {
  const { t } = useI18n();
  const snapshot = usePanelWorkspaceLayoutSnapshot(runtime.coordinator);
  const { dropCandidate } = usePanelSnapInteractionState();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [surfaceWidth, setSurfaceWidth] = useState(
    snapshot.workspaceRect.width,
  );
  const [surfaceHeight, setSurfaceHeight] = useState(
    snapshot.workspaceRect.height,
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const updateSurface = (): void => {
      if (surface.clientWidth <= 0) return;
      setSurfaceWidth((current) =>
        current === surface.clientWidth ? current : surface.clientWidth,
      );
      setSurfaceHeight((current) =>
        current === surface.clientHeight ? current : surface.clientHeight,
      );
    };
    updateSurface();
    const observer = new ResizeObserver(updateSurface);
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (
      surfaceWidth <= 0 ||
      surfaceHeight <= 0 ||
      (surfaceWidth === snapshot.workspaceRect.width &&
        surfaceHeight === snapshot.workspaceRect.height)
    ) {
      return;
    }
    runtime.updateWorkspaceRect({
      width: surfaceWidth,
      height: surfaceHeight,
    });
  }, [
    runtime,
    snapshot.workspaceRect.height,
    snapshot.workspaceRect.width,
    surfaceHeight,
    surfaceWidth,
  ]);

  const activePanelsBySide = useMemo(
    () =>
      (["left", "right", "bottom"] as const).reduce(
        (result, side) => {
          result[side] = workspaceLayout.railOrder[side].filter(
            (panelId) => workspaceLayout.visibility[panelId] === true,
          );
          return result;
        },
        {} as Record<PanelSide, PanelId[]>,
      ),
    [workspaceLayout],
  );

  const pageLayoutPanelMetrics = useMemo(() => {
    const leftFrames: PanelWorkspaceFrameSnapshot[] = [];
    const rightFrames: PanelWorkspaceFrameSnapshot[] = [];

    for (const frame of snapshot.frameGeometries.values()) {
      const isLeftPlacement =
        frame.placementZone === "left" || frame.placementZone.endsWith("-left");
      const isRightPlacement =
        frame.placementZone === "right" ||
        frame.placementZone.endsWith("-right");

      if (isLeftPlacement) {
        leftFrames.push(frame);
      } else if (isRightPlacement) {
        rightFrames.push(frame);
      }
    }

    const resolveFrameExtent = (
      frames: readonly PanelWorkspaceFrameSnapshot[],
    ): number => {
      if (frames.length === 0) return 0;
      const left = Math.min(...frames.map((frame) => frame.x));
      const right = Math.max(...frames.map((frame) => frame.x + frame.width));
      return Math.max(0, right - left);
    };

    return {
      leftWidth: resolveFrameExtent(leftFrames),
      rightWidth: resolveFrameExtent(rightFrames),
    };
  }, [snapshot.frameGeometries]);

  return (
    <div
      className="panel-workspace"
      aria-label={t("workspace.workArea")}
      data-page-layout-left-panel-width={pageLayoutPanelMetrics.leftWidth}
      data-page-layout-right-panel-width={pageLayoutPanelMetrics.rightWidth}
      data-page-layout-panel-gap={PANEL_WORKSPACE_GAP}
    >
      <PanelDock
        chrome={chrome}
        stageRef={stageRef}
        surfaceWidth={surfaceWidth}
        version={snapshot.version}
      >
        {({ origin }) => (
          <>
            {(["left", "right"] as const).map((side) => {
              const panelIds = workspaceLayout.railOrder[side];
              if (panelIds.length === 0) return null;
              return (
                <PanelToggleGroup
                  key={side}
                  side={side}
                  panelIds={panelIds}
                  activePanels={activePanelsBySide[side]}
                  onPanelToggle={togglePanel}
                />
              );
            })}

            <div ref={surfaceRef} className="panel-dock-surface">
              <PanelWorkspaceZoneOverlay />
              {dropCandidate?.kind === "panel-edge" && (
                <PanelSnapGuide
                  candidate={dropCandidate}
                  dockOrigin={origin}
                  snapshot={snapshot}
                />
              )}
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
                configs={configs}
                dockOrigin={origin}
                runtime={runtime}
                setWorkspaceLayout={setWorkspaceLayout}
              />
            </div>
          </>
        )}
      </PanelDock>
    </div>
  );
});

function HydratedPanelWorkspace({
  children,
  chrome,
  workspaceLayout,
  configs,
  registry,
  setWorkspaceLayout,
  togglePanel,
  focusPanel,
  stageRect,
  stageRef,
}: HydratedPanelWorkspaceProps) {
  const [runtime] = useState(() =>
    createRuntime(workspaceLayout, registry, stageRect),
  );
  // `data-layout-version` 은 useWorkspaceCanvasSizing 의 MutationObserver 가 읽는
  // 신호다. 루트가 snapshot 을 구독해 이 속성을 JSX 로 쓰면 패널 resize·move 의
  // 매 flush 마다 루트 전체 (frame 12개 element 생성 포함) 가 다시 렌더된다.
  // 속성 두 개만 필요하므로 coordinator 를 직접 구독해 DOM 에 쓴다 (2026-09-02).
  const hostRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const coordinator = runtime.coordinator;
    const applyLayoutVersion = (): void => {
      const version = String(coordinator.getSnapshot().version);
      hostRef.current?.setAttribute("data-layout-version", version);
      mainRef.current?.setAttribute("data-layout-version", version);
    };
    applyLayoutVersion();
    return coordinator.subscribe(applyLayoutVersion);
  }, [runtime]);

  useEffect(() => {
    if (runtime && workspaceLayout) {
      runtime.replaceCommittedLayout(workspaceLayout);
    }
  }, [runtime, workspaceLayout]);

  useEffect(() => {
    runtime.updateRegistry(registry);
  }, [registry, runtime]);

  useEffect(
    () =>
      registerPanelWorkspaceActivationDispatcher((panelId) => {
        const mutation = runtime.activatePanel(panelId);
        if (!mutation.ok) return false;
        return setWorkspaceLayout(runtime.endInteraction());
      }),
    [runtime, setWorkspaceLayout],
  );

  useEffect(
    () => () => {
      runtime?.destroy();
    },
    [runtime],
  );

  return (
    <div ref={hostRef} className="panel-workspace-host">
      <div ref={mainRef} className="panel-workspace-main">
        {children}
      </div>

      <PanelWorkspaceOverlay
        chrome={chrome}
        configs={configs}
        focusPanel={focusPanel}
        runtime={runtime}
        setWorkspaceLayout={setWorkspaceLayout}
        togglePanel={togglePanel}
        workspaceLayout={workspaceLayout}
        stageRef={stageRef}
      />
    </div>
  );
}

interface PanelWorkspaceContentProps {
  children: ReactNode;
  chrome?: ReactNode;
}

function PanelWorkspaceContent({
  children,
  chrome,
}: PanelWorkspaceContentProps) {
  const { t } = useI18n();
  const {
    workspaceLayout,
    initializeWorkspaceLayout,
    setWorkspaceLayout,
    togglePanel,
    focusPanel,
  } = usePanelLayout();
  const configs = useMemo(() => PanelRegistry.getAllPanels(), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageRect, setStageRect] = useState<PanelWorkspaceRect | null>(null);
  const registry = useMemo(
    () =>
      stageRect
        ? configs.map((config) =>
            createPanelWorkspaceRegistryEntry(config, stageRect),
          )
        : [],
    [configs, stageRect],
  );
  const isHydrated = workspaceLayout !== null;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updateRect = (): void => {
      const next = {
        width: stage.clientWidth,
        height: stage.clientHeight,
      };
      if (next.width <= 0 || next.height <= 0) return;
      setStageRect((current) =>
        current?.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [isHydrated]);

  useLayoutEffect(() => {
    if (!workspaceLayout && stageRect) {
      initializeWorkspaceLayout(registry, stageRect);
    }
  }, [initializeWorkspaceLayout, registry, stageRect, workspaceLayout]);

  if (!workspaceLayout || !stageRect) {
    return (
      <div className="panel-workspace-host">
        <div className="panel-workspace-main">{children}</div>
        <div className="panel-workspace" aria-label={t("workspace.workArea")}>
          <PanelDock
            chrome={chrome}
            stageRef={stageRef}
            surfaceWidth={0}
            version={0}
          >
            {() => null}
          </PanelDock>
        </div>
      </div>
    );
  }

  return (
    <HydratedPanelWorkspace
      children={children}
      chrome={chrome}
      workspaceLayout={workspaceLayout}
      configs={configs}
      registry={registry}
      setWorkspaceLayout={setWorkspaceLayout}
      togglePanel={togglePanel}
      focusPanel={focusPanel}
      stageRect={stageRect}
      stageRef={stageRef}
    />
  );
}

interface PanelWorkspaceProps {
  children: ReactNode;
  chrome?: ReactNode;
}

export function PanelWorkspace({ children, chrome }: PanelWorkspaceProps) {
  return (
    <PanelSnapInteractionProvider>
      <PanelWorkspaceContent chrome={chrome}>{children}</PanelWorkspaceContent>
    </PanelSnapInteractionProvider>
  );
}
