import { act, renderHook } from "@testing-library/react";
import { PaintRoller, PanelLeft, PanelTop } from "lucide-react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import {
  migratePanelLayoutV1ToV2,
  projectV2ToLegacyView,
} from "../layout/panelWorkspaceLayoutV2Migration";
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

function createLayout(): PanelLayoutState {
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
  return migratePanelLayoutV1ToV2(createLayout(), registry(), "hook-test");
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

describe("usePanelLayout Photoshop식 v2 panel placement", () => {
  beforeAll(() => {
    for (const config of TEST_PANELS) {
      if (!PanelRegistry.hasPanel(config.id)) PanelRegistry.register(config);
    }
  });

  beforeEach(() => {
    localStorage.clear();
    useStore.getState().initializePanelWorkspaceLayout(registry());
    const workspaceLayout = createWorkspaceLayout();
    useStore.setState({
      panelWorkspaceLayout: workspaceLayout,
      panelLayout: projectV2ToLegacyView(
        workspaceLayout,
        registry(),
        DEFAULT_PANEL_LAYOUT,
      ).layout,
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: null,
    });
  });

  it("anchor 이동 시 floating placement를 제거하고 새 side에 정확히 한 번 배치한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.floatPanel("styles", { x: 120, y: 80 }));
    expect(
      findPlacement(useStore.getState().panelWorkspaceLayout!, "styles")
        ?.cluster,
    ).toMatchObject({ anchor: "floating", position: { x: 120, y: 80 } });

    act(() => result.current.dockPanel("styles", "left"));
    const layout = useStore.getState().panelWorkspaceLayout!;
    const placement = findPlacement(layout, "styles");

    expect(placement?.cluster.anchor).toBe("left");
    expect(layout.railOrder.left).toContain("styles");
    expect(layout.railOrder.right).not.toContain("styles");
    expect(
      layout.clusters.flatMap((cluster) =>
        cluster.columns.flatMap((column) =>
          column.rows.filter((row) => row.panelId === "styles"),
        ),
      ),
    ).toHaveLength(1);
  });

  it("bottom은 일반 anchor로 유지하고 hide는 placement를 보존한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.dockPanel("styles", "bottom"));
    let layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.railOrder.bottom).toEqual(["monitor", "styles"]);
    expect(layout.visibility.styles).toBe(true);
    expect(findPlacement(layout, "styles")?.cluster.anchor).toBe("bottom");

    act(() => result.current.hidePanel("styles"));
    layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.visibility.styles).toBe(false);
    expect(findPlacement(layout, "styles")?.cluster.anchor).toBe("bottom");
  });

  it("패널 크기를 registry 범위로 clamp하고 v2 placement에 저장한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.floatPanel("styles", { x: 40, y: 40 }));
    act(() =>
      result.current.updatePanelSize("styles", {
        width: 999,
        height: 80,
      }),
    );

    const placement = findPlacement(
      useStore.getState().panelWorkspaceLayout!,
      "styles",
    );
    expect(placement?.column.width).toBe(640);
    expect(placement?.row.height).toBe(160);
  });

  it("floating 위치는 rail toggle 왕복 뒤에도 보존된다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.placePanel("styles", { x: 360, y: 180 }));
    act(() => result.current.togglePanel("right", "styles"));
    let layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.visibility.styles).toBe(false);
    expect(findPlacement(layout, "styles")?.cluster).toMatchObject({
      anchor: "floating",
      position: { x: 360, y: 180 },
    });

    act(() => result.current.togglePanel("right", "styles"));
    layout = useStore.getState().panelWorkspaceLayout!;
    expect(layout.visibility.styles).toBe(true);
    expect(findPlacement(layout, "styles")?.cluster).toMatchObject({
      anchor: "floating",
      position: { x: 360, y: 180 },
    });
  });

  it("toggle은 side show flag 없이 panel visibility 하나만 전환한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.togglePanel("right", "properties"));
    expect(
      useStore.getState().panelWorkspaceLayout?.visibility.properties,
    ).toBe(false);

    act(() => result.current.togglePanel("left", "properties"));
    expect(
      useStore.getState().panelWorkspaceLayout?.visibility.properties,
    ).toBe(true);
    expect(
      findPlacement(useStore.getState().panelWorkspaceLayout!, "properties")
        ?.cluster.anchor,
    ).toBe("right");
  });

  it("snap 관계는 toggle로 숨겨도 cluster row 순서를 보존한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() =>
      result.current.snapPanel("styles", {
        targetPanelId: "properties",
        edge: "bottom",
        source: { x: 900, y: 404, width: 260, height: 300 },
        target: { x: 900, y: 40, width: 300, height: 360 },
      }),
    );
    const rows = () =>
      findPlacement(
        useStore.getState().panelWorkspaceLayout!,
        "properties",
      )?.column.rows.map((row) => row.panelId);
    expect(rows()).toEqual(["properties", "styles"]);

    act(() => result.current.togglePanel("right", "styles"));
    expect(rows()).toEqual(["properties", "styles"]);
    act(() => result.current.togglePanel("right", "styles"));
    expect(rows()).toEqual(["properties", "styles"]);
  });
});
