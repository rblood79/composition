import { act, renderHook } from "@testing-library/react";
import { PaintRoller, PanelLeft, PanelTop } from "lucide-react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { usePanelLayout } from "./usePanelLayout";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import {
  DEFAULT_PANEL_LAYOUT,
  type PanelConfig,
  type PanelId,
  type PanelLayoutState,
} from "../panels/core/types";
import { createPanelWorkspaceRegistryEntry } from "../layout/panelWorkspaceLayoutV2";
import { migratePanelLayoutV1ToV2 } from "../layout/panelWorkspaceLayoutV2Migration";
import type { PanelWorkspaceLayoutV3 } from "../layout/panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "../layout/panelWorkspaceLayoutV3Migration";
import { useStore } from "../stores";

const TEST_PANELS: PanelConfig[] = [
  {
    id: "properties",
    name: "속성",
    icon: PanelLeft,
    component: () => null,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
  },
  {
    id: "styles",
    name: "스타일",
    icon: PaintRoller,
    component: () => null,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
  },
  {
    id: "monitor",
    name: "모니터",
    icon: PanelTop,
    component: () => null,
    category: "system",
    defaultPosition: "bottom",
    minWidth: 233,
    maxWidth: 1600,
    minHeight: 150,
    maxHeight: 600,
    defaultHeight: 240,
  },
];

function createV1Layout(): PanelLayoutState {
  return {
    ...DEFAULT_PANEL_LAYOUT,
    leftPanels: [],
    rightPanels: ["properties", "styles"],
    activeLeftPanels: [],
    activeRightPanels: ["properties"],
    bottomPanels: ["monitor"],
    activeBottomPanels: [],
    panelSizes: {},
    modalPanels: [],
    panelClusters: [],
  };
}

function registry() {
  return TEST_PANELS.map((config) => createPanelWorkspaceRegistryEntry(config));
}

function createWorkspaceLayout(): PanelWorkspaceLayoutV3 {
  const v2 = migratePanelLayoutV1ToV2(
    createV1Layout(),
    registry(),
    "hook-test",
  );
  const result = migratePanelWorkspaceLayoutV2ToV3(v2, registry(), {
    surfaceRect: { width: 1200, height: 800 },
    migrationId: "hook-test-v3",
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function findPlacement(layout: PanelWorkspaceLayoutV3, panelId: PanelId) {
  for (const cluster of layout.clusters) {
    for (const column of cluster.columns) {
      const row = column.rows.find(
        (candidate) => candidate.panelId === panelId,
      );
      if (row) return { cluster, column, row };
    }
  }
  return null;
}

describe("usePanelLayout Photoshop식 v3 panel commands", () => {
  beforeAll(() => {
    for (const config of TEST_PANELS) {
      if (!PanelRegistry.hasPanel(config.id)) PanelRegistry.register(config);
    }
  });

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(PanelRegistry, "getAllPanels").mockReturnValue(TEST_PANELS);
    useStore.getState().initializePanelWorkspaceLayout(registry(), {
      width: 1200,
      height: 800,
    });
    useStore.setState({
      panelWorkspaceLayout: createWorkspaceLayout(),
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: null,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("side 인자 없이 visibility만 전환하고 placement를 보존한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.togglePanel("properties"));
    let layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.visibility.properties).toBe(false);
    expect(findPlacement(layout, "properties")?.cluster.placementZone).toBe(
      "top-right",
    );

    act(() => result.current.togglePanel("properties"));
    layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.visibility.properties).toBe(true);
    expect(findPlacement(layout, "properties")?.cluster.placementZone).toBe(
      "top-right",
    );
  });

  it("focus command는 zone cluster order만 갱신한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.focusPanel("monitor"));
    act(() => result.current.focusPanel("properties"));
    const layout = useStore.getState().panelWorkspaceLayout!;

    expect(layout.clusterFocusOrder.at(-1)).toBe(
      findPlacement(layout, "properties")?.cluster.id,
    );
    expect(findPlacement(layout, "properties")?.cluster.placementZone).toBe(
      "top-right",
    );
  });

  it("explicit reset command는 registry default zone layout을 복원한다", () => {
    const { result } = renderHook(() => usePanelLayout());
    const moved = structuredClone(useStore.getState().panelWorkspaceLayout!);
    const properties = findPlacement(moved, "properties");
    if (!properties) throw new Error("properties placement is required");
    properties.cluster.placementZone = "bottom-right";
    useStore.getState().setPanelWorkspaceLayout(moved);

    let reset = false;
    act(() => {
      reset = result.current.resetWorkspaceLayout();
    });

    const layout = useStore.getState().panelWorkspaceLayout!;
    expect(reset).toBe(true);
    expect(layout.visibility.properties).toBe(true);
    expect(findPlacement(layout, "properties")?.cluster.placementZone).toBe(
      "top-right",
    );
  });

  it("v1 compatibility action alias를 노출하지 않는다", () => {
    const { result } = renderHook(() => usePanelLayout());

    expect(Object.keys(result.current).sort()).toEqual(
      [
        "focusPanel",
        "initializeWorkspaceLayout",
        "resetWorkspaceLayout",
        "setWorkspaceLayout",
        "togglePanel",
        "workspaceLayout",
      ].sort(),
    );
  });
});
