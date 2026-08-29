import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRegistryEntry,
} from "./panelWorkspaceLayoutV2";

export const PANEL_WORKSPACE_TEST_REGISTRY: PanelWorkspaceRegistryEntry[] = [
  {
    id: "navigator",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 640,
    defaultWidth: 233,
    minHeight: 160,
    maxHeight: 800,
    defaultHeight: 520,
  },
  {
    id: "datatableEditor",
    defaultPosition: "left",
    minWidth: 490,
    maxWidth: 1000,
    defaultWidth: 490,
    minHeight: 160,
    maxHeight: 800,
    defaultHeight: 600,
  },
  {
    id: "settings",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 1000,
    defaultWidth: 400,
    minHeight: 160,
    maxHeight: 800,
    defaultHeight: 500,
  },
  {
    id: "properties",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultWidth: 233,
    minHeight: 160,
    maxHeight: 800,
    defaultHeight: 520,
  },
  {
    id: "history",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultWidth: 320,
    minHeight: 160,
    maxHeight: 800,
    defaultHeight: 450,
  },
  {
    id: "monitor",
    defaultPosition: "bottom",
    minWidth: 233,
    maxWidth: 1600,
    defaultWidth: 600,
    minHeight: 150,
    maxHeight: 600,
    defaultHeight: 240,
  },
];

export function createPanelWorkspaceLayoutV2(): PanelWorkspaceLayoutV2 {
  return {
    version: 2,
    visibility: {
      navigator: true,
      datatableEditor: false,
      settings: false,
      properties: true,
      history: false,
      monitor: false,
    },
    railOrder: {
      left: ["navigator", "datatableEditor", "settings"],
      right: ["properties", "history"],
      bottom: ["monitor"],
    },
    clusters: [
      {
        id: "anchor:left",
        anchor: "left",
        columns: [
          {
            id: "anchor:left:column:0",
            width: 490,
            rows: [
              { panelId: "navigator", height: 520 },
              { panelId: "datatableEditor", height: 600 },
              { panelId: "settings", height: 500 },
            ],
          },
        ],
      },
      {
        id: "anchor:right",
        anchor: "right",
        columns: [
          {
            id: "anchor:right:column:0",
            width: 320,
            rows: [
              { panelId: "properties", height: 520 },
              { panelId: "history", height: 450 },
            ],
          },
        ],
      },
      {
        id: "anchor:bottom",
        anchor: "bottom",
        columns: [
          {
            id: "anchor:bottom:column:0",
            width: 600,
            rows: [{ panelId: "monitor", height: 240 }],
          },
        ],
      },
    ],
    floatingFocusOrder: [],
  };
}
