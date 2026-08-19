import type {
  PanelFrameGeometry,
  PanelId,
  PanelResizeEdge,
} from "../panels/core/types";
import {
  solvePanelWorkspaceLayoutV2,
  type PanelWorkspaceAnchorPresentation,
  type PanelWorkspaceClusterV2,
  type PanelWorkspaceLayoutSolution,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRailSizes,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
  type PanelWorkspaceSolvedFrameGeometry,
  type PanelWorkspaceSolveOptions,
} from "./panelWorkspaceLayoutV2";

export interface PanelWorkspaceLayoutCoordinatorInput extends PanelWorkspaceSolveOptions {
  layout: PanelWorkspaceLayoutV2;
  registry: readonly PanelWorkspaceRegistryEntry[];
}

export interface PanelWorkspaceFrameSnapshot extends PanelWorkspaceSolvedFrameGeometry {
  layoutVersion: number;
  resizeEdges: readonly PanelResizeEdge[];
}

export type PanelWorkspaceSplitterKind = "row" | "column";
export type PanelWorkspaceSplitterOrientation = "horizontal" | "vertical";

export interface PanelWorkspaceSplitterGeometry {
  id: string;
  kind: PanelWorkspaceSplitterKind;
  orientation: PanelWorkspaceSplitterOrientation;
  clusterId: string;
  columnId?: string;
  beforePanelIds: readonly PanelId[];
  afterPanelIds: readonly PanelId[];
  geometry: Readonly<PanelFrameGeometry>;
  layoutVersion: number;
}

export interface PanelWorkspaceLayoutSnapshot {
  version: number;
  workspaceRect: Readonly<{ width: number; height: number }>;
  mainContentRect: Readonly<PanelFrameGeometry>;
  frameGeometries: ReadonlyMap<PanelId, PanelWorkspaceFrameSnapshot>;
  occupiedInsets: Readonly<PanelWorkspaceRailSizes>;
  presentations: Readonly<
    Record<"left" | "right" | "bottom", PanelWorkspaceAnchorPresentation>
  >;
  splitters: readonly PanelWorkspaceSplitterGeometry[];
  visiblePanelIds: ReadonlySet<PanelId>;
  panelOrder: readonly PanelId[];
  constrainedOverlayOrder: readonly ("left" | "right" | "bottom")[];
}

export interface PanelWorkspaceLayoutFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export type PanelWorkspaceLayoutSolver = (
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  options: PanelWorkspaceSolveOptions,
) => PanelWorkspaceResult<PanelWorkspaceLayoutSolution>;

export interface PanelWorkspaceLayoutCoordinatorOptions {
  scheduler?: PanelWorkspaceLayoutFrameScheduler;
  solve?: PanelWorkspaceLayoutSolver;
}

export interface PanelWorkspaceLayoutCoordinator {
  getSnapshot: () => PanelWorkspaceLayoutSnapshot;
  subscribe: (listener: () => void) => () => void;
  queueInput: (input: PanelWorkspaceLayoutCoordinatorInput) => void;
  queuePreview: (panelId: PanelId, geometry: PanelFrameGeometry) => void;
  clearPreview: () => void;
  getLastError: () => string | null;
  destroy: () => void;
}

interface PanelWorkspaceFramePreview {
  panelId: PanelId;
  geometry: Readonly<PanelFrameGeometry>;
}

const BROWSER_FRAME_SCHEDULER: PanelWorkspaceLayoutFrameScheduler = {
  request: (callback): number => requestAnimationFrame(callback),
  cancel: (handle): void => cancelAnimationFrame(handle),
};

function freezeRect<T extends PanelFrameGeometry>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function readonlyMapView<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const view: ReadonlyMap<K, V> = {
    get size(): number {
      return source.size;
    },
    entries: () => source.entries(),
    forEach: (callback, thisArg): void => {
      source.forEach((value, key) => callback.call(thisArg, value, key, view));
    },
    get: (key): V | undefined => source.get(key),
    has: (key): boolean => source.has(key),
    keys: () => source.keys(),
    values: () => source.values(),
    [Symbol.iterator]: () => source[Symbol.iterator](),
  };
  return Object.freeze(view);
}

function readonlySetView<T>(source: ReadonlySet<T>): ReadonlySet<T> {
  const view: ReadonlySet<T> = {
    get size(): number {
      return source.size;
    },
    entries: () => source.entries(),
    forEach: (callback, thisArg): void => {
      source.forEach((value) => callback.call(thisArg, value, value, view));
    },
    has: (value): boolean => source.has(value),
    keys: () => source.keys(),
    values: () => source.values(),
    [Symbol.iterator]: () => source[Symbol.iterator](),
  };
  return Object.freeze(view);
}

function visiblePanelIdsForColumn(
  cluster: PanelWorkspaceClusterV2,
  columnIndex: number,
  frames: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometry>,
): PanelId[] {
  const column = cluster.columns[columnIndex];
  if (!column) return [];
  return column.rows
    .map((row) => row.panelId)
    .filter((panelId) => frames.has(panelId));
}

function createRowSplitters(
  cluster: PanelWorkspaceClusterV2,
  columnIndex: number,
  frames: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometry>,
  layoutVersion: number,
): PanelWorkspaceSplitterGeometry[] {
  const column = cluster.columns[columnIndex];
  if (!column) return [];
  const panelIds = visiblePanelIdsForColumn(cluster, columnIndex, frames);
  const splitters: PanelWorkspaceSplitterGeometry[] = [];
  for (let index = 0; index < panelIds.length - 1; index += 1) {
    const beforePanelId = panelIds[index];
    const afterPanelId = panelIds[index + 1];
    if (!beforePanelId || !afterPanelId) continue;
    const before = frames.get(beforePanelId);
    const after = frames.get(afterPanelId);
    if (!before || !after) continue;
    splitters.push(
      Object.freeze({
        id: `${cluster.id}:row:${column.id}:${beforePanelId}:${afterPanelId}`,
        kind: "row" as const,
        orientation: "horizontal" as const,
        clusterId: cluster.id,
        columnId: column.id,
        beforePanelIds: Object.freeze([beforePanelId]),
        afterPanelIds: Object.freeze([afterPanelId]),
        geometry: freezeRect({
          x: before.x,
          y: before.y + before.height,
          width: before.width,
          height: Math.max(0, after.y - (before.y + before.height)),
        }),
        layoutVersion,
      }),
    );
  }
  return splitters;
}

function createColumnSplitters(
  cluster: PanelWorkspaceClusterV2,
  frames: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometry>,
  layoutVersion: number,
): PanelWorkspaceSplitterGeometry[] {
  const visibleColumns = cluster.columns.flatMap((column, columnIndex) => {
    const panelIds = visiblePanelIdsForColumn(cluster, columnIndex, frames);
    return panelIds.length > 0 ? [{ column, panelIds }] : [];
  });
  const splitters: PanelWorkspaceSplitterGeometry[] = [];
  for (let index = 0; index < visibleColumns.length - 1; index += 1) {
    const before = visibleColumns[index];
    const after = visibleColumns[index + 1];
    if (!before || !after) continue;
    const beforeFrames = before.panelIds.flatMap((panelId) => {
      const geometry = frames.get(panelId);
      return geometry ? [geometry] : [];
    });
    const afterFrames = after.panelIds.flatMap((panelId) => {
      const geometry = frames.get(panelId);
      return geometry ? [geometry] : [];
    });
    if (beforeFrames.length === 0 || afterFrames.length === 0) continue;
    const beforeRight = Math.max(
      ...beforeFrames.map((geometry) => geometry.x + geometry.width),
    );
    const afterLeft = Math.min(...afterFrames.map((geometry) => geometry.x));
    const top = Math.min(
      ...beforeFrames.map((geometry) => geometry.y),
      ...afterFrames.map((geometry) => geometry.y),
    );
    const bottom = Math.max(
      ...beforeFrames.map((geometry) => geometry.y + geometry.height),
      ...afterFrames.map((geometry) => geometry.y + geometry.height),
    );
    splitters.push(
      Object.freeze({
        id: `${cluster.id}:column:${before.column.id}:${after.column.id}`,
        kind: "column" as const,
        orientation: "vertical" as const,
        clusterId: cluster.id,
        beforePanelIds: Object.freeze([...before.panelIds]),
        afterPanelIds: Object.freeze([...after.panelIds]),
        geometry: freezeRect({
          x: beforeRight,
          y: top,
          width: Math.max(0, afterLeft - beforeRight),
          height: Math.max(0, bottom - top),
        }),
        layoutVersion,
      }),
    );
  }
  return splitters;
}

function createSplitters(
  solution: PanelWorkspaceLayoutSolution,
  frames: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometry>,
  layoutVersion: number,
): readonly PanelWorkspaceSplitterGeometry[] {
  const splitters: PanelWorkspaceSplitterGeometry[] = [];
  for (const cluster of solution.layout.clusters) {
    cluster.columns.forEach((_column, columnIndex) => {
      splitters.push(
        ...createRowSplitters(cluster, columnIndex, frames, layoutVersion),
      );
    });
    splitters.push(...createColumnSplitters(cluster, frames, layoutVersion));
  }
  return Object.freeze(splitters);
}

function createFrameResizeEdges(
  panelId: PanelId,
  anchor: PanelWorkspaceSolvedFrameGeometry["anchor"],
  splitters: readonly PanelWorkspaceSplitterGeometry[],
): readonly PanelResizeEdge[] {
  const edges: PanelResizeEdge[] =
    anchor === "floating"
      ? ["left", "right", "bottom"]
      : anchor === "left"
        ? ["right", "bottom"]
        : anchor === "right"
          ? ["left", "bottom"]
          : ["top"];
  const internalEdges = new Set<PanelResizeEdge>();

  for (const splitter of splitters) {
    if (splitter.kind === "row") {
      if (splitter.beforePanelIds.includes(panelId))
        internalEdges.add("bottom");
      if (splitter.afterPanelIds.includes(panelId)) internalEdges.add("top");
      continue;
    }
    if (splitter.beforePanelIds.includes(panelId)) internalEdges.add("right");
    if (splitter.afterPanelIds.includes(panelId)) internalEdges.add("left");
  }

  return Object.freeze(edges.filter((edge) => !internalEdges.has(edge)));
}

function createSnapshot(
  solution: PanelWorkspaceLayoutSolution,
  registry: readonly PanelWorkspaceRegistryEntry[],
  version: number,
): PanelWorkspaceLayoutSnapshot {
  const splitters = createSplitters(
    solution,
    solution.frameGeometries,
    version,
  );
  const mutableFrames = new Map<PanelId, PanelWorkspaceFrameSnapshot>();
  for (const [panelId, geometry] of solution.frameGeometries) {
    mutableFrames.set(
      panelId,
      Object.freeze({
        ...geometry,
        layoutVersion: version,
        resizeEdges: createFrameResizeEdges(
          panelId,
          geometry.anchor,
          splitters,
        ),
      }),
    );
  }
  const frameGeometries = readonlyMapView(mutableFrames);
  const visiblePanelIds = readonlySetView(new Set(mutableFrames.keys()));
  return Object.freeze({
    version,
    workspaceRect: Object.freeze({ ...solution.workspaceRect }),
    mainContentRect: freezeRect(solution.mainContentRect),
    frameGeometries,
    occupiedInsets: Object.freeze({ ...solution.occupiedInsets }),
    presentations: Object.freeze({ ...solution.presentations }),
    splitters,
    visiblePanelIds,
    panelOrder: Object.freeze(registry.map((entry) => entry.id)),
    constrainedOverlayOrder: Object.freeze([
      ...solution.constrainedOverlayOrder,
    ]),
  });
}

function createTransientSnapshot(
  committedSnapshot: PanelWorkspaceLayoutSnapshot,
  version: number,
  preview: PanelWorkspaceFramePreview | null,
): PanelWorkspaceLayoutSnapshot {
  const mutableFrames = new Map<PanelId, PanelWorkspaceFrameSnapshot>();
  for (const [panelId, frame] of committedSnapshot.frameGeometries) {
    const geometry = preview?.panelId === panelId ? preview.geometry : frame;
    mutableFrames.set(
      panelId,
      Object.freeze({
        ...frame,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        layoutVersion: version,
      }),
    );
  }
  const frameGeometries = readonlyMapView(mutableFrames);
  return Object.freeze({
    ...committedSnapshot,
    version,
    frameGeometries,
    splitters: Object.freeze(
      committedSnapshot.splitters.map((splitter) =>
        Object.freeze({ ...splitter, layoutVersion: version }),
      ),
    ),
    visiblePanelIds: readonlySetView(new Set(mutableFrames.keys())),
  });
}

function copyInput(
  input: PanelWorkspaceLayoutCoordinatorInput,
): PanelWorkspaceLayoutCoordinatorInput {
  return {
    layout: input.layout,
    registry: input.registry,
    workspaceRect: { ...input.workspaceRect },
    railSizes: { ...input.railSizes },
  };
}

class PanelWorkspaceLayoutCoordinatorStore implements PanelWorkspaceLayoutCoordinator {
  private snapshot: PanelWorkspaceLayoutSnapshot;
  private committedSnapshot: PanelWorkspaceLayoutSnapshot;
  private pendingInput: PanelWorkspaceLayoutCoordinatorInput | null = null;
  private preview: PanelWorkspaceFramePreview | null = null;
  private previewDirty = false;
  private frameHandle: number | null = null;
  private lastError: string | null = null;
  private destroyed = false;
  private readonly listeners = new Set<() => void>();

  constructor(
    initialSnapshot: PanelWorkspaceLayoutSnapshot,
    private readonly scheduler: PanelWorkspaceLayoutFrameScheduler,
    private readonly solve: PanelWorkspaceLayoutSolver,
  ) {
    this.snapshot = initialSnapshot;
    this.committedSnapshot = initialSnapshot;
  }

  getSnapshot = (): PanelWorkspaceLayoutSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    if (this.destroyed) return () => undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  queueInput = (input: PanelWorkspaceLayoutCoordinatorInput): void => {
    if (this.destroyed) return;
    this.pendingInput = copyInput(input);
    this.scheduleFlush();
  };

  queuePreview = (panelId: PanelId, geometry: PanelFrameGeometry): void => {
    if (
      this.destroyed ||
      !Number.isFinite(geometry.x) ||
      !Number.isFinite(geometry.y) ||
      !Number.isFinite(geometry.width) ||
      !Number.isFinite(geometry.height) ||
      geometry.width <= 0 ||
      geometry.height <= 0
    ) {
      return;
    }
    this.preview = {
      panelId,
      geometry: freezeRect(geometry),
    };
    this.previewDirty = true;
    this.scheduleFlush();
  };

  clearPreview = (): void => {
    if (this.destroyed || (this.preview === null && !this.previewDirty)) return;
    this.preview = null;
    this.previewDirty = true;
    this.scheduleFlush();
  };

  getLastError = (): string | null => this.lastError;

  destroy = (): void => {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pendingInput = null;
    this.preview = null;
    this.previewDirty = false;
    if (this.frameHandle !== null) {
      this.scheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
    this.listeners.clear();
  };

  private readonly flushPendingInput = (): void => {
    this.frameHandle = null;
    if (this.destroyed) return;
    const input = this.pendingInput;
    this.pendingInput = null;
    const hadPreviewUpdate = this.previewDirty;
    this.previewDirty = false;
    if (!input && !hadPreviewUpdate) return;
    const nextVersion = this.snapshot.version + 1;
    if (input) {
      const solved = this.solve(input.layout, input.registry, {
        workspaceRect: input.workspaceRect,
        railSizes: input.railSizes,
      });
      if (!solved.ok) {
        this.lastError = solved.error;
        if (!hadPreviewUpdate) return;
      } else {
        this.lastError = null;
        this.committedSnapshot = createSnapshot(
          solved.value,
          input.registry,
          nextVersion,
        );
      }
    }
    this.snapshot = createTransientSnapshot(
      this.committedSnapshot,
      nextVersion,
      this.preview,
    );
    for (const listener of [...this.listeners]) listener();
  };

  private scheduleFlush(): void {
    if (this.frameHandle !== null) return;
    this.frameHandle = this.scheduler.request(this.flushPendingInput);
  }
}

export function createPanelWorkspaceLayoutCoordinator(
  input: PanelWorkspaceLayoutCoordinatorInput,
  options: PanelWorkspaceLayoutCoordinatorOptions = {},
): PanelWorkspaceResult<PanelWorkspaceLayoutCoordinator> {
  const solve = options.solve ?? solvePanelWorkspaceLayoutV2;
  const initial = solve(input.layout, input.registry, {
    workspaceRect: input.workspaceRect,
    railSizes: input.railSizes,
  });
  if (!initial.ok) return initial;
  return {
    ok: true,
    value: new PanelWorkspaceLayoutCoordinatorStore(
      createSnapshot(initial.value, input.registry, 0),
      options.scheduler ?? BROWSER_FRAME_SCHEDULER,
      solve,
    ),
  };
}
