import { describe, expect, it } from "vitest";
import { panelDragMovedBeyondSnapThreshold } from "./panelSnap";

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
});
