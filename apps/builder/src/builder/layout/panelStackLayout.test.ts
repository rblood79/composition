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
  previewPanelClusterResize,
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
  it("cluster가 없는 placed panel도 viewport 안으로 복귀시킨다", () => {
    const layout: PanelLayoutState = {
      ...createLayout(),
      modalPanels: [
        {
          panelId: "properties",
          mode: "floating",
          position: { x: 2312, y: 960 },
          size: { width: 247, height: 638 },
          zIndex: 1000,
        },
      ],
    };

    const fitted = fitPanelClustersToWorkspace(layout, {
      width: 2111,
      height: 1227,
    });
    const properties = fitted.modalPanels[0];

    expect(fitted.panelClusters).toEqual([]);
    expect(
      (properties?.position.x ?? 0) + (properties?.size.width ?? 0),
    ).toBeLessThanOrEqual(2111 - PANEL_STACK_MARGIN);
    expect(
      (properties?.position.y ?? 0) + (properties?.size.height ?? 0),
    ).toBeLessThanOrEqual(1227 - PANEL_STACK_MARGIN);
  });

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

  it("세로 stack의 내부 경계를 resize하면 인접 panel을 같은 delta로 즉시 보정한다", () => {
    const snapped = snapPanelIntoCluster(
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
    const properties = snapped.modalPanels.find(
      (panel) => panel.panelId === "properties",
    );
    const preview = previewPanelClusterResize(
      snapped,
      "properties",
      "bottom",
      {
        x: properties?.position.x ?? 0,
        y: properties?.position.y ?? 0,
        width: properties?.size.width ?? 0,
        height: 420,
      },
      { width: 1200, height: 900 },
    );
    const resized = preview.modalPanels.find(
      (panel) => panel.panelId === "properties",
    );
    const neighbor = preview.modalPanels.find(
      (panel) => panel.panelId === "styles",
    );

    expect(resized?.size.height).toBe(420);
    expect(neighbor?.size.height).toBe(300);
    expect(neighbor?.position.y).toBe(
      (resized?.position.y ?? 0) +
        (resized?.size.height ?? 0) +
        PANEL_STACK_GAP,
    );
    expect((resized?.size.height ?? 0) + (neighbor?.size.height ?? 0)).toBe(
      720,
    );
    expect(
      snapped.modalPanels.find((panel) => panel.panelId === "styles")?.size
        .height,
    ).toBe(360);
  });

  it("인접 column 경계를 resize하면 전체 폭을 유지하며 두 column을 함께 보정한다", () => {
    const snapped = snapPanelIntoCluster(
      createLayout(),
      "styles",
      {
        targetPanelId: "properties",
        edge: "right",
        source: { x: 1004, y: 100, width: 260, height: 360 },
        target: { x: 700, y: 100, width: 300, height: 360 },
      },
      { width: 1400, height: 900 },
    );
    const properties = snapped.modalPanels.find(
      (panel) => panel.panelId === "properties",
    );
    const preview = previewPanelClusterResize(
      snapped,
      "properties",
      "right",
      {
        x: properties?.position.x ?? 0,
        y: properties?.position.y ?? 0,
        width: 320,
        height: properties?.size.height ?? 0,
      },
      { width: 1400, height: 900 },
    );
    const resized = preview.modalPanels.find(
      (panel) => panel.panelId === "properties",
    );
    const neighbor = preview.modalPanels.find(
      (panel) => panel.panelId === "styles",
    );

    expect(resized?.size.width).toBe(320);
    expect(neighbor?.size.width).toBe(240);
    expect(neighbor?.position.x).toBe(
      (resized?.position.x ?? 0) + (resized?.size.width ?? 0) + PANEL_STACK_GAP,
    );
    expect((resized?.size.width ?? 0) + (neighbor?.size.width ?? 0)).toBe(560);
  });
});
