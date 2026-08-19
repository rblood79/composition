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
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceLayoutV2,
} from "../layout/panelWorkspaceLayoutV2";
import { migratePanelLayoutV1ToV2 } from "../layout/panelWorkspaceLayoutV2Migration";
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
  return TEST_PANELS.map(createPanelWorkspaceRegistryEntry);
}

function createWorkspaceLayout(): PanelWorkspaceLayoutV2 {
  return migratePanelLayoutV1ToV2(createV1Layout(), registry(), "hook-test");
}

function findPlacement(layout: PanelWorkspaceLayoutV2, panelId: PanelId) {
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

describe("usePanelLayout Photoshop식 v2 panel commands", () => {
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
    expect(findPlacement(layout, "properties")?.cluster.anchor).toBe("right");

    act(() => result.current.togglePanel("properties"));
    layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.visibility.properties).toBe(true);
    expect(findPlacement(layout, "properties")?.cluster.anchor).toBe("right");
  });

  it("float command는 기존 placement를 floating cluster로 정확히 한 번 옮긴다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.floatPanel("styles", { x: 120, y: 80 }));
    const layout = useStore.getState().panelWorkspaceLayout!;

    expect(findPlacement(layout, "styles")?.cluster).toMatchObject({
      anchor: "floating",
      position: { x: 120, y: 80 },
    });
    expect(
      layout.clusters.flatMap((cluster) =>
        cluster.columns.flatMap((column) =>
          column.rows.filter((row) => row.panelId === "styles"),
        ),
      ),
    ).toHaveLength(1);
  });

  it("floating focus command는 cluster order만 갱신한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.floatPanel("properties", { x: 40, y: 40 }));
    act(() => result.current.floatPanel("styles", { x: 360, y: 180 }));
    act(() => result.current.focusFloatingPanel("properties"));

    const layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.floatingFocusOrder.at(-1)).toContain("properties");
    expect(findPlacement(layout, "properties")?.cluster.anchor).toBe(
      "floating",
    );
  });

  it("v1 compatibility action alias를 노출하지 않는다", () => {
    const { result } = renderHook(() => usePanelLayout());

    expect(Object.keys(result.current).sort()).toEqual(
      [
        "floatPanel",
        "focusFloatingPanel",
        "initializeWorkspaceLayout",
        "setWorkspaceLayout",
        "togglePanel",
        "workspaceLayout",
      ].sort(),
    );
  });
});
