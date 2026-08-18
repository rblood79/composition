import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANEL_LAYOUT,
  type PanelLayoutState,
} from "../panels/core/types";
import {
  PANEL_STACK_GAP,
  PANEL_STACK_MARGIN,
  detachPanelFromClusters,
  fitPanelClustersToWorkspace,
  snapPanelIntoCluster,
} from "./panelStackLayout";

function createLayout(): PanelLayoutState {
  return {
    ...DEFAULT_PANEL_LAYOUT,
    leftPanels: [...DEFAULT_PANEL_LAYOUT.leftPanels],
    rightPanels: [...DEFAULT_PANEL_LAYOUT.rightPanels],
    activeLeftPanels: [...DEFAULT_PANEL_LAYOUT.activeLeftPanels],
    activeRightPanels: ["properties", "styles", "events"],
    bottomPanels: [...DEFAULT_PANEL_LAYOUT.bottomPanels],
    activeBottomPanels: [...DEFAULT_PANEL_LAYOUT.activeBottomPanels],
    panelSizes: {},
    modalPanels: [],
    panelClusters: [],
  };
}

describe("Photoshop식 panel column/stack layout", () => {
  it("세로 stack의 공통 폭과 4px 간격을 유지하며 viewport 높이에 맞춘다", () => {
    const layout = snapPanelIntoCluster(
      createLayout(),
      "styles",
      {
        targetPanelId: "properties",
        edge: "bottom",
        source: { x: 740, y: 504, width: 260, height: 400 },
        target: { x: 700, y: 100, width: 300, height: 400 },
      },
      { width: 1200, height: 700 },
    );
    const properties = layout.modalPanels.find(
      (panel) => panel.panelId === "properties",
    );
    const styles = layout.modalPanels.find(
      (panel) => panel.panelId === "styles",
    );

    expect(layout.panelClusters[0]?.columns).toEqual([
      { panelIds: ["properties", "styles"], width: 300 },
    ]);
    expect(properties?.size.width).toBe(300);
    expect(styles?.size.width).toBe(300);
    expect(styles?.position.y).toBe(
      (properties?.position.y ?? 0) +
        (properties?.size.height ?? 0) +
        PANEL_STACK_GAP,
    );
    expect(
      (styles?.position.y ?? 0) + (styles?.size.height ?? 0),
    ).toBeLessThanOrEqual(700 - PANEL_STACK_MARGIN);
  });

  it("좌우 snap은 대상 column 옆에 같은 y 기준의 새 column을 삽입한다", () => {
    const layout = snapPanelIntoCluster(
      createLayout(),
      "styles",
      {
        targetPanelId: "properties",
        edge: "left",
        source: { x: 396, y: 220, width: 260, height: 300 },
        target: { x: 660, y: 100, width: 300, height: 400 },
      },
      { width: 1200, height: 800 },
    );
    const properties = layout.modalPanels.find(
      (panel) => panel.panelId === "properties",
    );
    const styles = layout.modalPanels.find(
      (panel) => panel.panelId === "styles",
    );

    expect(
      layout.panelClusters[0]?.columns.map((column) => column.panelIds),
    ).toEqual([["styles"], ["properties"]]);
    expect(properties?.position.x).toBe(
      (styles?.position.x ?? 0) + (styles?.size.width ?? 0) + PANEL_STACK_GAP,
    );
    expect(properties?.position.y).toBe(styles?.position.y);
  });

  it("viewport가 낮아지면 마지막 panel부터 축소해 cluster를 화면 안에 유지한다", () => {
    let layout = snapPanelIntoCluster(
      createLayout(),
      "styles",
      {
        targetPanelId: "properties",
        edge: "bottom",
        source: { x: 700, y: 404, width: 300, height: 360 },
        target: { x: 700, y: 40, width: 300, height: 360 },
      },
      { width: 1200, height: 900 },
    );
    layout = fitPanelClustersToWorkspace(layout, { width: 1200, height: 520 });
    const panels = layout.modalPanels.filter((panel) =>
      ["properties", "styles"].includes(panel.panelId),
    );

    expect(
      Math.max(...panels.map((panel) => panel.position.y + panel.size.height)),
    ).toBeLessThanOrEqual(520 - PANEL_STACK_MARGIN);
    expect(
      panels.find((panel) => panel.panelId === "styles")?.size.height,
    ).toBeLessThan(360);

    const expanded = fitPanelClustersToWorkspace(layout, {
      width: 1200,
      height: 900,
    });
    expect(
      expanded.modalPanels.find((panel) => panel.panelId === "styles")?.size
        .height,
    ).toBe(360);
  });

  it("stack에서 panel을 분리하면 남은 단일 panel 관계를 제거한다", () => {
    const snapped = snapPanelIntoCluster(
      createLayout(),
      "styles",
      {
        targetPanelId: "properties",
        edge: "bottom",
        source: { x: 700, y: 404, width: 300, height: 300 },
        target: { x: 700, y: 40, width: 300, height: 360 },
      },
      { width: 1200, height: 900 },
    );

    expect(detachPanelFromClusters(snapped, "styles").panelClusters).toEqual(
      [],
    );
  });
});
