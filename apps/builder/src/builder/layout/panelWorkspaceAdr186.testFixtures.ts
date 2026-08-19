import type { PanelId } from "../panels/core/types";
import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRailSide,
  PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";

export const ADR_186_PLACEMENT_ZONES = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export type Adr186PlacementZoneFixture =
  (typeof ADR_186_PLACEMENT_ZONES)[number];

export const ADR_186_DEFAULT_ZONE_BY_RAIL: Record<
  PanelWorkspaceRailSide,
  Adr186PlacementZoneFixture
> = {
  left: "top-left",
  right: "top-right",
  bottom: "bottom",
};

export const ADR_186_SURFACE_RECT_FIXTURE = {
  width: 1200,
  height: 800,
} as const;

export const ADR_186_CLUSTER_SIZE_FIXTURE = {
  width: 200,
  height: 100,
} as const;

export const ADR_186_ZONE_ORIGIN_FIXTURES: ReadonlyArray<{
  zone: Adr186PlacementZoneFixture;
  x: number;
  y: number;
}> = [
  { zone: "top-left", x: 0, y: 0 },
  { zone: "top", x: 500, y: 0 },
  { zone: "top-right", x: 1000, y: 0 },
  { zone: "left", x: 0, y: 350 },
  { zone: "center", x: 500, y: 350 },
  { zone: "right", x: 1000, y: 350 },
  { zone: "bottom-left", x: 0, y: 700 },
  { zone: "bottom", x: 500, y: 700 },
  { zone: "bottom-right", x: 1000, y: 700 },
];

const FLOATING_PANEL_IDS = [
  "nodes",
  "properties",
  "monitor",
  "components",
  "library",
  "datatable",
  "datatableEditor",
  "settings",
  "history",
  "styles",
  "events",
  "ai",
] as const satisfies readonly PanelId[];

const RAIL_BY_PANEL: Record<
  (typeof FLOATING_PANEL_IDS)[number],
  PanelWorkspaceRailSide
> = {
  nodes: "left",
  properties: "right",
  monitor: "bottom",
  components: "left",
  library: "left",
  datatable: "left",
  datatableEditor: "left",
  settings: "left",
  history: "right",
  styles: "right",
  events: "right",
  ai: "right",
};

function registryEntry(panelId: (typeof FLOATING_PANEL_IDS)[number]) {
  return {
    id: panelId,
    defaultPosition: RAIL_BY_PANEL[panelId],
    minWidth: 80,
    maxWidth: 640,
    defaultWidth: ADR_186_CLUSTER_SIZE_FIXTURE.width,
    minHeight: 60,
    maxHeight: 800,
    defaultHeight: ADR_186_CLUSTER_SIZE_FIXTURE.height,
  } satisfies PanelWorkspaceRegistryEntry;
}

export interface Adr186TenPlusFloatingFixture {
  layout: PanelWorkspaceLayoutV2;
  registry: readonly PanelWorkspaceRegistryEntry[];
  mixedRailClusterId: string;
}

export function createAdr186TenPlusFloatingFixture(): Adr186TenPlusFloatingFixture {
  const mixedRailClusterId = "floating:mixed-rail-overflow";
  const singlePanelIds = FLOATING_PANEL_IDS.slice(3);
  const singleClusters = ADR_186_ZONE_ORIGIN_FIXTURES.map(
    ({ zone, x, y }, index) => {
      const panelId = singlePanelIds[index];
      if (!panelId) throw new Error(`Missing panel fixture for ${zone}`);
      return {
        id: `floating:${zone}`,
        anchor: "floating" as const,
        position: { x, y },
        columns: [
          {
            id: `floating:${zone}:column:0`,
            width: ADR_186_CLUSTER_SIZE_FIXTURE.width,
            rows: [
              {
                panelId,
                height: ADR_186_CLUSTER_SIZE_FIXTURE.height,
              },
            ],
          },
        ],
      };
    },
  );

  return {
    registry: FLOATING_PANEL_IDS.map(registryEntry),
    mixedRailClusterId,
    layout: {
      version: 2,
      visibility: Object.fromEntries(
        FLOATING_PANEL_IDS.map((panelId, index) => [panelId, index !== 7]),
      ),
      railOrder: {
        left: [
          "nodes",
          "components",
          "library",
          "datatable",
          "datatableEditor",
          "settings",
        ],
        right: ["properties", "history", "styles", "events", "ai"],
        bottom: ["monitor"],
      },
      clusters: [
        {
          id: mixedRailClusterId,
          anchor: "floating",
          position: { x: 460, y: 320 },
          columns: [
            {
              id: `${mixedRailClusterId}:column:0`,
              width: 200,
              rows: [
                { panelId: "nodes", height: 100 },
                { panelId: "properties", height: 100 },
              ],
            },
            {
              id: `${mixedRailClusterId}:column:1`,
              width: 240,
              rows: [{ panelId: "monitor", height: 120 }],
            },
          ],
        },
        ...singleClusters,
      ],
      floatingFocusOrder: [
        mixedRailClusterId,
        ...singleClusters.map((cluster) => cluster.id),
      ],
    },
  };
}
