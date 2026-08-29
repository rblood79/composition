const LEGACY_NAVIGATOR_PANEL_ID = "nodes";
const NAVIGATOR_PANEL_ID = "navigator";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalPanelId(value: unknown): unknown {
  return value === LEGACY_NAVIGATOR_PANEL_ID ? NAVIGATOR_PANEL_ID : value;
}

function canonicalPanelIds(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const hasCanonical = value.includes(NAVIGATOR_PANEL_ID);
  return [
    ...new Set(
      value
        .filter(
          (candidate) =>
            !hasCanonical || candidate !== LEGACY_NAVIGATOR_PANEL_ID,
        )
        .map(canonicalPanelId),
    ),
  ];
}

function canonicalPanelIdRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === LEGACY_NAVIGATOR_PANEL_ID) continue;
    result[key] = entry;
  }
  if (!(NAVIGATOR_PANEL_ID in result) && LEGACY_NAVIGATOR_PANEL_ID in value) {
    result[NAVIGATOR_PANEL_ID] = value[LEGACY_NAVIGATOR_PANEL_ID];
  }
  return result;
}

function canonicalRows(value: unknown, hasCanonicalRow: boolean): unknown {
  if (!Array.isArray(value)) return value;
  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [candidate];
    if (hasCanonicalRow && candidate.panelId === LEGACY_NAVIGATOR_PANEL_ID) {
      return [];
    }
    return [{ ...candidate, panelId: canonicalPanelId(candidate.panelId) }];
  });
}

function canonicalClusters(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const hasCanonicalRow = value.some(
    (cluster) =>
      isRecord(cluster) &&
      Array.isArray(cluster.columns) &&
      cluster.columns.some(
        (column) =>
          isRecord(column) &&
          Array.isArray(column.rows) &&
          column.rows.some(
            (row) => isRecord(row) && row.panelId === NAVIGATOR_PANEL_ID,
          ),
      ),
  );
  return value.map((cluster) => {
    if (!isRecord(cluster) || !Array.isArray(cluster.columns)) return cluster;
    return {
      ...cluster,
      columns: cluster.columns.map((column) =>
        isRecord(column)
          ? {
              ...column,
              rows: canonicalRows(column.rows, hasCanonicalRow),
              panelIds: canonicalPanelIds(column.panelIds),
            }
          : column,
      ),
    };
  });
}

function canonicalModalPanels(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const hasCanonical = value.some(
    (panel) => isRecord(panel) && panel.panelId === NAVIGATOR_PANEL_ID,
  );
  return value.flatMap((panel) => {
    if (!isRecord(panel)) return [panel];
    if (hasCanonical && panel.panelId === LEGACY_NAVIGATOR_PANEL_ID) return [];
    return [{ ...panel, panelId: canonicalPanelId(panel.panelId) }];
  });
}

/**
 * v1/v2/v3 persisted layout의 panel ID 필드만 canonical Navigator ID로
 * 올린다. cluster id와 focus order는 panel ID가 아니므로 보존한다.
 */
export function canonicalizePersistedPanelIds(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const result: Record<string, unknown> = {
    ...input,
    visibility: canonicalPanelIdRecord(input.visibility),
    panelSizes: canonicalPanelIdRecord(input.panelSizes),
    clusters: canonicalClusters(input.clusters),
    panelClusters: canonicalClusters(input.panelClusters),
    modalPanels: canonicalModalPanels(input.modalPanels),
  };

  if (isRecord(input.railOrder)) {
    result.railOrder = {
      ...input.railOrder,
      left: canonicalPanelIds(input.railOrder.left),
      right: canonicalPanelIds(input.railOrder.right),
      bottom: canonicalPanelIds(input.railOrder.bottom),
    };
  }

  for (const key of [
    "leftPanels",
    "rightPanels",
    "bottomPanels",
    "activeLeftPanels",
    "activeRightPanels",
    "activeBottomPanels",
  ]) {
    if (key in input) result[key] = canonicalPanelIds(input[key]);
  }
  for (const key of ["activeLeftPanel", "activeRightPanel"]) {
    if (key in input) result[key] = canonicalPanelId(input[key]);
  }
  return result;
}
