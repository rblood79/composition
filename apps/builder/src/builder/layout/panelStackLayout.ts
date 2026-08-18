import type {
  ModalPanelState,
  PanelClusterState,
  PanelFrameGeometry,
  PanelId,
  PanelLayoutState,
  PanelSnapPlacement,
} from "../panels/core/types";

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
