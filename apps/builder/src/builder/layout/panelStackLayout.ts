import type {
  ModalPanelState,
  PanelClusterState,
  PanelFrameGeometry,
  PanelId,
  PanelLayoutState,
  PanelResizeEdge,
  PanelSnapPlacement,
} from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";

export const PANEL_STACK_GAP = 4;
export const PANEL_STACK_MARGIN = 4;
export const PANEL_STACK_MIN_HEIGHT = 96;
export const PANEL_COLUMN_MIN_WIDTH = 200;

export interface PanelWorkspaceSize {
  width: number;
  height: number;
}

function panelIsActive(layout: PanelLayoutState, panelId: PanelId): boolean {
  if (layout.leftPanels.includes(panelId)) {
    return layout.showLeft && layout.activeLeftPanels.includes(panelId);
  }
  if (layout.rightPanels.includes(panelId)) {
    return layout.showRight && layout.activeRightPanels.includes(panelId);
  }
  if (layout.bottomPanels.includes(panelId)) {
    return layout.showBottom && layout.activeBottomPanels.includes(panelId);
  }
  return true;
}

function fitTracks(
  desired: number[],
  available: number,
  preferredMinimum: number,
): number[] {
  if (desired.length === 0) return [];
  const safeAvailable = Math.max(0, available);
  const total = desired.reduce((sum, value) => sum + value, 0);
  if (total <= safeAvailable) return desired;

  const effectiveMinimum = Math.min(
    preferredMinimum,
    safeAvailable / desired.length,
  );
  const result = desired.map((value) => Math.max(0, value));
  let overflow = total - safeAvailable;

  for (let index = result.length - 1; index >= 0 && overflow > 0; index--) {
    const shrinkable = Math.max(0, result[index] - effectiveMinimum);
    const reduction = Math.min(shrinkable, overflow);
    result[index] -= reduction;
    overflow -= reduction;
  }

  if (overflow > 0) {
    const equalSize = safeAvailable / result.length;
    return result.map(() => equalSize);
  }
  return result;
}

function cloneClusters(clusters: PanelClusterState[]): PanelClusterState[] {
  return clusters.map((cluster) => ({
    ...cluster,
    position: { ...cluster.position },
    columns: cluster.columns.map((column) => ({
      ...column,
      panelIds: [...column.panelIds],
    })),
  }));
}

function detachPanel(
  clusters: PanelClusterState[],
  panelId: PanelId,
): PanelClusterState[] {
  return clusters
    .map((cluster) => ({
      ...cluster,
      columns: cluster.columns
        .map((column) => ({
          ...column,
          panelIds: column.panelIds.filter((id) => id !== panelId),
        }))
        .filter((column) => column.panelIds.length > 0),
    }))
    .filter(
      (cluster) =>
        cluster.columns.reduce(
          (count, column) => count + column.panelIds.length,
          0,
        ) >= 2,
    );
}

export function detachPanelFromClusters(
  layout: PanelLayoutState,
  panelId: PanelId,
): PanelLayoutState {
  return {
    ...layout,
    panelClusters: detachPanel(cloneClusters(layout.panelClusters), panelId),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)));
}

interface TrackRange {
  min: number;
  max: number;
}

function panelHeightRange(panelId: PanelId, current: number): TrackRange {
  const config = PanelRegistry.getPanel(panelId);
  return {
    min: Math.min(config?.minHeight ?? 160, current),
    max: Math.max(config?.maxHeight ?? 800, current),
  };
}

function columnWidthRange(panelIds: PanelId[], current: number): TrackRange {
  const minimum = Math.max(
    PANEL_COLUMN_MIN_WIDTH,
    ...panelIds.map(
      (panelId) => PanelRegistry.getPanel(panelId)?.minWidth ?? 0,
    ),
  );
  const maximum = Math.min(
    ...panelIds.map(
      (panelId) => PanelRegistry.getPanel(panelId)?.maxWidth ?? 800,
    ),
  );
  return {
    min: Math.min(minimum, current),
    max: Math.max(maximum, current),
  };
}

function pairedDelta(
  requested: number,
  sourceCurrent: number,
  sourceRange: TrackRange,
  neighborCurrent: number,
  neighborRange: TrackRange,
): number {
  const minimum = Math.max(
    sourceRange.min - sourceCurrent,
    neighborCurrent - neighborRange.max,
  );
  const maximum = Math.min(
    sourceRange.max - sourceCurrent,
    neighborCurrent - neighborRange.min,
  );
  return clamp(requested, minimum, maximum);
}

export function fitPanelClustersToWorkspace(
  layout: PanelLayoutState,
  workspace: PanelWorkspaceSize,
): PanelLayoutState {
  if (layout.panelClusters.length === 0) return layout;

  const modalPanels = layout.modalPanels.map((panel) => ({
    ...panel,
    position: { ...panel.position },
    size: { ...panel.size },
  }));
  const panelsById = new Map(
    modalPanels.map((panel) => [panel.panelId, panel] as const),
  );
  const availableWidth = Math.max(0, workspace.width - PANEL_STACK_MARGIN * 2);
  const availableHeight = Math.max(
    0,
    workspace.height - PANEL_STACK_MARGIN * 2,
  );
  const fittedClusters: PanelClusterState[] = [];

  for (const cluster of cloneClusters(layout.panelClusters)) {
    const columns = cluster.columns
      .map((column) => ({
        ...column,
        panelIds: column.panelIds.filter((panelId) => panelsById.has(panelId)),
      }))
      .filter((column) => column.panelIds.length > 0);
    const panelCount = columns.reduce(
      (count, column) => count + column.panelIds.length,
      0,
    );
    if (panelCount < 2) continue;

    const horizontalGap = PANEL_STACK_GAP * Math.max(0, columns.length - 1);
    const columnWidths = fitTracks(
      columns.map((column) => column.width),
      Math.max(0, availableWidth - horizontalGap),
      PANEL_COLUMN_MIN_WIDTH,
    );
    const columnHeights: number[] = [];

    columns.forEach((column, columnIndex) => {
      column.width = columnWidths[columnIndex] ?? column.width;
      const activePanelIds = column.panelIds.filter((panelId) =>
        panelIsActive(layout, panelId),
      );
      const verticalGap =
        PANEL_STACK_GAP * Math.max(0, activePanelIds.length - 1);
      const heights = fitTracks(
        activePanelIds.map(
          (panelId) =>
            layout.panelSizes[panelId]?.height ??
            panelsById.get(panelId)?.size.height ??
            0,
        ),
        Math.max(0, availableHeight - verticalGap),
        PANEL_STACK_MIN_HEIGHT,
      );
      let columnHeight = verticalGap;
      heights.forEach((height, index) => {
        const panelId = activePanelIds[index];
        const panel = panelId ? panelsById.get(panelId) : undefined;
        if (!panel) return;
        panel.size = { width: column.width, height };
        columnHeight += height;
      });
      for (const panelId of column.panelIds) {
        const panel = panelsById.get(panelId);
        if (!panel || activePanelIds.includes(panelId)) continue;
        panel.size = { ...panel.size, width: column.width };
      }
      columnHeights.push(columnHeight);
    });

    const clusterWidth =
      columnWidths.reduce((sum, width) => sum + width, 0) + horizontalGap;
    const clusterHeight = Math.max(0, ...columnHeights);
    cluster.position = {
      x: clamp(
        cluster.position.x,
        PANEL_STACK_MARGIN,
        workspace.width - PANEL_STACK_MARGIN - clusterWidth,
      ),
      y: clamp(
        cluster.position.y,
        PANEL_STACK_MARGIN,
        workspace.height - PANEL_STACK_MARGIN - clusterHeight,
      ),
    };

    let x = cluster.position.x;
    columns.forEach((column, columnIndex) => {
      let y = cluster.position.y;
      for (const panelId of column.panelIds) {
        const panel = panelsById.get(panelId);
        if (!panel || !panelIsActive(layout, panelId)) continue;
        panel.position = { x, y };
        y += panel.size.height + PANEL_STACK_GAP;
      }
      x += column.width + PANEL_STACK_GAP;
      columns[columnIndex] = column;
    });

    fittedClusters.push({ ...cluster, columns });
  }

  return {
    ...layout,
    modalPanels,
    panelClusters: fittedClusters,
  };
}

export function previewPanelClusterResize(
  layout: PanelLayoutState,
  panelId: PanelId,
  edge: PanelResizeEdge,
  geometry: PanelFrameGeometry,
  workspace: PanelWorkspaceSize,
): PanelLayoutState {
  const panelClusters = cloneClusters(layout.panelClusters);
  const cluster = panelClusters.find((candidate) =>
    candidate.columns.some((column) => column.panelIds.includes(panelId)),
  );
  if (!cluster) return layout;

  const modalPanels = layout.modalPanels.map((panel) => ({
    ...panel,
    position: { ...panel.position },
    size: { ...panel.size },
  }));
  const panelsById = new Map(
    modalPanels.map((panel) => [panel.panelId, panel] as const),
  );
  const panelSizes = { ...layout.panelSizes };
  for (const column of cluster.columns) {
    for (const id of column.panelIds) {
      const panel = panelsById.get(id);
      if (panel) panelSizes[id] = { ...panel.size };
    }
  }

  const columnIndex = cluster.columns.findIndex((column) =>
    column.panelIds.includes(panelId),
  );
  const column = cluster.columns[columnIndex];
  const panel = panelsById.get(panelId);
  if (!column || !panel) return layout;

  if (edge === "top" || edge === "bottom") {
    const activePanelIds = column.panelIds.filter((id) =>
      panelIsActive(layout, id),
    );
    const panelIndex = activePanelIds.indexOf(panelId);
    if (panelIndex < 0) return layout;
    const neighborIndex = edge === "top" ? panelIndex - 1 : panelIndex + 1;
    const neighborId = activePanelIds[neighborIndex];
    const currentHeight = panel.size.height;
    let nextHeight = geometry.height;

    if (neighborId) {
      const neighbor = panelsById.get(neighborId);
      if (!neighbor) return layout;
      const delta = pairedDelta(
        geometry.height - currentHeight,
        currentHeight,
        panelHeightRange(panelId, currentHeight),
        neighbor.size.height,
        panelHeightRange(neighborId, neighbor.size.height),
      );
      nextHeight = currentHeight + delta;
      panelSizes[neighborId] = {
        ...neighbor.size,
        height: neighbor.size.height - delta,
      };
    } else {
      const range = panelHeightRange(panelId, currentHeight);
      nextHeight = clamp(geometry.height, range.min, range.max);
      if (edge === "top") {
        cluster.position.y += currentHeight - nextHeight;
      }
    }
    panelSizes[panelId] = { ...panel.size, height: nextHeight };
  } else {
    const neighborColumnIndex =
      edge === "left" ? columnIndex - 1 : columnIndex + 1;
    const neighborColumn = cluster.columns[neighborColumnIndex];
    const currentWidth = column.width;
    let nextWidth = geometry.width;

    if (neighborColumn) {
      const delta = pairedDelta(
        geometry.width - currentWidth,
        currentWidth,
        columnWidthRange(column.panelIds, currentWidth),
        neighborColumn.width,
        columnWidthRange(neighborColumn.panelIds, neighborColumn.width),
      );
      nextWidth = currentWidth + delta;
      neighborColumn.width -= delta;
      for (const id of neighborColumn.panelIds) {
        const size = panelSizes[id];
        if (size) panelSizes[id] = { ...size, width: neighborColumn.width };
      }
    } else {
      const range = columnWidthRange(column.panelIds, currentWidth);
      nextWidth = clamp(geometry.width, range.min, range.max);
      if (edge === "left") {
        cluster.position.x += currentWidth - nextWidth;
      }
    }
    column.width = nextWidth;
    for (const id of column.panelIds) {
      const size = panelSizes[id];
      if (size) panelSizes[id] = { ...size, width: nextWidth };
    }
  }

  return fitPanelClustersToWorkspace(
    {
      ...layout,
      panelSizes,
      modalPanels,
      panelClusters,
    },
    workspace,
  );
}

function upsertFloatingPanel(
  panels: ModalPanelState[],
  panelId: PanelId,
  geometry: PanelFrameGeometry,
  zIndex: number,
): { panels: ModalPanelState[]; created: boolean } {
  const existingIndex = panels.findIndex((panel) => panel.panelId === panelId);
  const nextPanel: ModalPanelState = {
    panelId,
    mode: "floating",
    position: { x: geometry.x, y: geometry.y },
    size: { width: geometry.width, height: geometry.height },
    zIndex:
      existingIndex >= 0 ? (panels[existingIndex]?.zIndex ?? zIndex) : zIndex,
  };
  if (existingIndex < 0)
    return { panels: [...panels, nextPanel], created: true };
  return {
    panels: panels.map((panel, index) =>
      index === existingIndex ? nextPanel : panel,
    ),
    created: false,
  };
}

export function snapPanelIntoCluster(
  layout: PanelLayoutState,
  panelId: PanelId,
  placement: PanelSnapPlacement,
  workspace: PanelWorkspaceSize,
): PanelLayoutState {
  let panelClusters = detachPanel(cloneClusters(layout.panelClusters), panelId);
  let modalPanels = layout.modalPanels.map((panel) => ({
    ...panel,
    position: { ...panel.position },
    size: { ...panel.size },
  }));
  let nextZIndex = layout.nextModalZIndex;

  const targetResult = upsertFloatingPanel(
    modalPanels,
    placement.targetPanelId,
    placement.target,
    nextZIndex,
  );
  modalPanels = targetResult.panels;
  if (targetResult.created) nextZIndex++;
  const sourceResult = upsertFloatingPanel(
    modalPanels,
    panelId,
    placement.source,
    nextZIndex,
  );
  modalPanels = sourceResult.panels;
  if (sourceResult.created) nextZIndex++;

  let cluster = panelClusters.find((candidate) =>
    candidate.columns.some((column) =>
      column.panelIds.includes(placement.targetPanelId),
    ),
  );
  if (!cluster) {
    cluster = {
      id: `panel-cluster-${placement.targetPanelId}-${panelId}-${nextZIndex}`,
      position: { x: placement.target.x, y: placement.target.y },
      columns: [
        {
          panelIds: [placement.targetPanelId],
          width: placement.target.width,
        },
      ],
    };
    panelClusters.push(cluster);
  }

  const targetColumnIndex = cluster.columns.findIndex((column) =>
    column.panelIds.includes(placement.targetPanelId),
  );
  const targetColumn = cluster.columns[targetColumnIndex];
  if (!targetColumn) return layout;
  const targetIndex = targetColumn.panelIds.indexOf(placement.targetPanelId);

  if (placement.edge === "top" || placement.edge === "bottom") {
    const insertionIndex =
      placement.edge === "top" ? targetIndex : targetIndex + 1;
    targetColumn.panelIds.splice(insertionIndex, 0, panelId);
  } else {
    const insertionIndex =
      placement.edge === "left" ? targetColumnIndex : targetColumnIndex + 1;
    cluster.columns.splice(insertionIndex, 0, {
      panelIds: [panelId],
      width: placement.source.width,
    });
  }

  const clusterPanelIds = new Set(
    cluster.columns.flatMap((column) => column.panelIds),
  );
  modalPanels = modalPanels.map((panel) =>
    clusterPanelIds.has(panel.panelId)
      ? { ...panel, zIndex: nextZIndex }
      : panel,
  );
  nextZIndex++;

  const panelSizes = { ...layout.panelSizes };
  const sourcePanel = modalPanels.find((panel) => panel.panelId === panelId);
  const targetPanel = modalPanels.find(
    (panel) => panel.panelId === placement.targetPanelId,
  );
  if (sourcePanel && !panelSizes[panelId]) {
    panelSizes[panelId] = sourcePanel.size;
  }
  if (targetPanel && !panelSizes[placement.targetPanelId]) {
    panelSizes[placement.targetPanelId] = targetPanel.size;
  }

  return fitPanelClustersToWorkspace(
    {
      ...layout,
      panelSizes,
      modalPanels,
      panelClusters,
      nextModalZIndex: nextZIndex,
    },
    workspace,
  );
}

export function panelBelongsToCluster(
  layout: PanelLayoutState,
  panelId: PanelId,
): boolean {
  return layout.panelClusters.some((cluster) =>
    cluster.columns.some((column) => column.panelIds.includes(panelId)),
  );
}
