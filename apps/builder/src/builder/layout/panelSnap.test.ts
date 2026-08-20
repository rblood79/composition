import { describe, expect, it } from "vitest";
import {
  PANEL_SNAP_GAP,
  panelDragMovedBeyondSnapThreshold,
  resolvePanelSnap,
} from "./panelSnap";

const target = {
  panelId: "properties" as const,
  geometry: { x: 900, y: 40, width: 280, height: 360 },
};

describe("panel-relative snap", () => {
  it("cluster detach suppression은 drag 시작점에서 snap threshold를 벗어날 때 해제한다", () => {
    const start = { x: 100, y: 100, width: 240, height: 200 };

    expect(panelDragMovedBeyondSnapThreshold(start, { ...start, x: 128 })).toBe(
      false,
    );
    expect(panelDragMovedBeyondSnapThreshold(start, { ...start, x: 129 })).toBe(
      true,
    );
  });

  it.each([
    ["top", { x: 900, y: 40 - 200 - PANEL_SNAP_GAP }],
    ["right", { x: 900 + 280 + PANEL_SNAP_GAP, y: 40 }],
    ["bottom", { x: 900, y: 40 + 360 + PANEL_SNAP_GAP }],
    ["left", { x: 900 - 240 - PANEL_SNAP_GAP, y: 40 }],
  ] as const)("target panel의 %s 방향에 붙인다", (edge, position) => {
    const candidate = resolvePanelSnap(
      { x: position.x + 8, y: position.y - 6, width: 240, height: 200 },
      [target],
    );

    expect(candidate).toEqual(
      expect.objectContaining({
        targetPanelId: "properties",
        edge,
        position,
      }),
    );
  });

  it("panel edge에서 threshold보다 멀면 viewport나 panel에 강제로 붙이지 않는다", () => {
    expect(
      resolvePanelSnap({ x: 300, y: 300, width: 240, height: 200 }, [target]),
    ).toBeNull();
  });

  it("상하 edge band가 겹치면 좌상단 정렬 없이도 stack 후보가 된다", () => {
    const candidate = resolvePanelSnap(
      { x: 1040, y: 404, width: 240, height: 200 },
      [target],
    );

    expect(candidate).toEqual(
      expect.objectContaining({
        targetPanelId: "properties",
        edge: "bottom",
        position: { x: 900, y: 404 },
      }),
    );
  });

  it("좌우 edge band가 겹치면 top 정렬 없이도 column 후보가 된다", () => {
    const candidate = resolvePanelSnap(
      { x: 1184, y: 180, width: 240, height: 200 },
      [target],
    );

    expect(candidate).toEqual(
      expect.objectContaining({
        targetPanelId: "properties",
        edge: "right",
        position: { x: 1184, y: 40 },
      }),
    );
  });
});
