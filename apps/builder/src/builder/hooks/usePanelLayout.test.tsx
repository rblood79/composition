import { act, renderHook } from "@testing-library/react";
import { PaintRoller } from "lucide-react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { usePanelLayout } from "./usePanelLayout";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import {
  DEFAULT_PANEL_LAYOUT,
  type PanelLayoutState,
} from "../panels/core/types";
import { useStore } from "../stores";

function createLayout(): PanelLayoutState {
  return {
    ...DEFAULT_PANEL_LAYOUT,
    leftPanels: [...DEFAULT_PANEL_LAYOUT.leftPanels],
    rightPanels: [...DEFAULT_PANEL_LAYOUT.rightPanels],
    activeLeftPanels: [...DEFAULT_PANEL_LAYOUT.activeLeftPanels],
    activeRightPanels: [...DEFAULT_PANEL_LAYOUT.activeRightPanels],
    bottomPanels: [...DEFAULT_PANEL_LAYOUT.bottomPanels],
    activeBottomPanels: [...DEFAULT_PANEL_LAYOUT.activeBottomPanels],
    panelSizes: {},
    modalPanels: [],
    panelClusters: [],
  };
}

describe("usePanelLayout Photoshop식 panel placement", () => {
  beforeAll(() => {
    if (!PanelRegistry.hasPanel("styles")) {
      PanelRegistry.register({
        id: "styles",
        name: "스타일",
        icon: PaintRoller,
        component: () => null,
        category: "editor",
        defaultPosition: "right",
        minWidth: 233,
        maxWidth: 640,
        defaultHeight: 520,
      });
    }
  });

  beforeEach(() => {
    useStore.setState({ panelLayout: createLayout() });
  });

  it("dock 이동 시 이전 side와 floating 상태를 제거하고 새 side만 활성화한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.floatPanel("styles", { x: 120, y: 80 }));
    expect(useStore.getState().panelLayout.modalPanels).toEqual([
      expect.objectContaining({ panelId: "styles", mode: "floating" }),
    ]);

    act(() => result.current.dockPanel("styles", "left"));
    const layout = useStore.getState().panelLayout;

    expect(layout.modalPanels).toEqual([]);
    expect(layout.leftPanels).toContain("styles");
    expect(layout.activeLeftPanels).toContain("styles");
    expect(layout.rightPanels).not.toContain("styles");
    expect(layout.activeRightPanels).not.toContain("styles");
  });

  it("bottom dock은 단일 활성 패널 계약을 유지하고 close는 배치만 보존한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.dockPanel("styles", "bottom"));
    expect(useStore.getState().panelLayout).toEqual(
      expect.objectContaining({
        bottomPanels: ["monitor", "styles"],
        activeBottomPanels: ["styles"],
        showBottom: true,
      }),
    );

    act(() => result.current.hidePanel("styles"));
    const layout = useStore.getState().panelLayout;
    expect(layout.bottomPanels).toContain("styles");
    expect(layout.activeBottomPanels).not.toContain("styles");
  });

  it("패널 크기를 config 범위로 clamp하고 dock/floating 공통 값으로 저장한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.floatPanel("styles", { x: 40, y: 40 }));
    act(() =>
      result.current.updatePanelSize("styles", {
        width: 999,
        height: 80,
      }),
    );

    const layout = useStore.getState().panelLayout;
    expect(layout.panelSizes.styles).toEqual({ width: 640, height: 160 });
    expect(layout.modalPanels[0]?.size).toEqual({
      width: 640,
      height: 160,
    });
  });

  it("panel-relative snap 위치를 갱신하고 rail toggle 후에도 보존한다", () => {
    const { result } = renderHook(() => usePanelLayout());

    act(() => result.current.placePanel("styles", { x: 120, y: 80 }));
    act(() => result.current.placePanel("styles", { x: 360, y: 180 }));
    expect(useStore.getState().panelLayout.modalPanels).toEqual([
      expect.objectContaining({
        panelId: "styles",
        position: { x: 360, y: 180 },
      }),
    ]);

    act(() => result.current.togglePanel("right", "styles"));
    expect(useStore.getState().panelLayout.activeRightPanels).not.toContain(
      "styles",
    );
    expect(useStore.getState().panelLayout.modalPanels[0]?.position).toEqual({
      x: 360,
      y: 180,
    });

    act(() => result.current.togglePanel("right", "styles"));
    expect(useStore.getState().panelLayout.activeRightPanels).toContain(
      "styles",
    );
    expect(useStore.getState().panelLayout.modalPanels[0]?.position).toEqual({
      x: 360,
      y: 180,
    });
  });

  it("panel snap을 column 관계로 저장하고 rail toggle 시 관계를 보존한다", () => {
    useStore.setState({
      panelLayout: {
        ...createLayout(),
        activeRightPanels: ["properties", "styles"],
      },
    });
    const { result } = renderHook(() => usePanelLayout());

    act(() =>
      result.current.snapPanel("styles", {
        targetPanelId: "properties",
        edge: "bottom",
        source: { x: 900, y: 404, width: 260, height: 300 },
        target: { x: 900, y: 40, width: 300, height: 360 },
      }),
    );
    expect(useStore.getState().panelLayout.panelClusters[0]?.columns).toEqual([
      { panelIds: ["properties", "styles"], width: 300 },
    ]);

    act(() => result.current.togglePanel("right", "styles"));
    expect(useStore.getState().panelLayout.panelClusters[0]?.columns).toEqual([
      { panelIds: ["properties", "styles"], width: 300 },
    ]);

    act(() => result.current.togglePanel("right", "styles"));
    const panels = useStore.getState().panelLayout.modalPanels;
    const properties = panels.find((panel) => panel.panelId === "properties");
    const styles = panels.find((panel) => panel.panelId === "styles");
    expect(styles?.position.y).toBe(
      (properties?.position.y ?? 0) + (properties?.size.height ?? 0) + 4,
    );
  });
});
