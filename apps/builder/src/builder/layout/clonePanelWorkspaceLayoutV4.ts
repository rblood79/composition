import type { PanelWorkspaceLayoutV4 } from "./panelWorkspaceLayoutV4";

export function clonePanelWorkspaceLayoutV4(
  layout: PanelWorkspaceLayoutV4,
): PanelWorkspaceLayoutV4 {
  return {
    version: 4,
    ...(layout.migrationSource
      ? { migrationSource: { ...layout.migrationSource } }
      : {}),
    visibility: { ...layout.visibility },
    railOrder: {
      left: [...layout.railOrder.left],
      right: [...layout.railOrder.right],
      bottom: [...layout.railOrder.bottom],
    },
    clusters: layout.clusters.map((cluster) => ({
      id: cluster.id,
      placementZone: cluster.placementZone,
      ...(cluster.originOffset
        ? { originOffset: { ...cluster.originOffset } }
        : {}),
      columns: cluster.columns.map((column) => ({
        id: column.id,
        width: column.width,
        rows: column.rows.map((row) => ({ ...row })),
      })),
    })),
    clusterFocusOrder: [...layout.clusterFocusOrder],
  };
}
