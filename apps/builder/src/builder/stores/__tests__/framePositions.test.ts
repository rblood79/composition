// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../env/supabase.client", () => ({
  supabase: {},
}));

import { useStore } from "../index";

describe("ADR-111 P3-α framePositions store", () => {
  beforeEach(() => {
    useStore.setState({
      framePositions: {},
      framePositionsVersion: 0,
    });
  });

  it("신규 frame 좌표를 insert 하고 미주입 필드는 0 으로 초기화", () => {
    useStore.getState().updateFramePosition("frame-A", { x: 100, y: 50 });

    const state = useStore.getState();
    expect(state.framePositions["frame-A"]).toEqual({
      x: 100,
      y: 50,
      width: 0,
      height: 0,
    });
    expect(state.framePositionsVersion).toBe(1);
  });

  it("기존 frame 의 위치만 patch 하면 width/height 보존", () => {
    useStore.setState({
      framePositions: {
        "frame-A": { x: 0, y: 0, width: 320, height: 200 },
      },
      framePositionsVersion: 1,
    });

    useStore.getState().updateFramePosition("frame-A", { x: 80, y: 40 });

    const entry = useStore.getState().framePositions["frame-A"];
    expect(entry).toEqual({ x: 80, y: 40, width: 320, height: 200 });
    expect(useStore.getState().framePositionsVersion).toBe(2);
  });

  it("기존 frame 의 size 만 patch 하면 x/y 보존", () => {
    useStore.setState({
      framePositions: {
        "frame-A": { x: 80, y: 40, width: 320, height: 200 },
      },
      framePositionsVersion: 5,
    });

    useStore
      .getState()
      .updateFramePosition("frame-A", { width: 480, height: 300 });

    const entry = useStore.getState().framePositions["frame-A"];
    expect(entry).toEqual({ x: 80, y: 40, width: 480, height: 300 });
    expect(useStore.getState().framePositionsVersion).toBe(6);
  });

  it("removeFramePosition 은 entry 를 제거하고 version 을 증분", () => {
    useStore.setState({
      framePositions: {
        "frame-A": { x: 0, y: 0, width: 100, height: 100 },
        "frame-B": { x: 200, y: 0, width: 100, height: 100 },
      },
      framePositionsVersion: 2,
    });

    useStore.getState().removeFramePosition("frame-A");

    const state = useStore.getState();
    expect(state.framePositions).not.toHaveProperty("frame-A");
    expect(state.framePositions["frame-B"]).toEqual({
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(state.framePositionsVersion).toBe(3);
  });

  it("미존재 frame 의 removeFramePosition 은 no-op (version 미증분)", () => {
    useStore.setState({
      framePositions: {
        "frame-A": { x: 0, y: 0, width: 100, height: 100 },
      },
      framePositionsVersion: 7,
    });

    useStore.getState().removeFramePosition("frame-NOT-EXIST");

    const state = useStore.getState();
    expect(state.framePositions["frame-A"]).toBeDefined();
    expect(state.framePositionsVersion).toBe(7);
  });
});
