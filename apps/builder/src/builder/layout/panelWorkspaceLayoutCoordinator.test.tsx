// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PanelId } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { solvePanelWorkspaceLayoutV3 } from "./panelWorkspaceLayoutV3";
import { createPanelWorkspaceLayoutV3Fixture } from "./panelWorkspaceLayoutV3.testFixtures";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  createPanelWorkspaceLayoutCoordinator,
  type PanelWorkspaceLayoutCoordinatorInput,
  type PanelWorkspaceLayoutFrameScheduler,
} from "./panelWorkspaceLayoutCoordinator";
import {
  usePanelWorkspaceFrameSnapshot,
  usePanelWorkspaceLayoutSnapshot,
} from "./usePanelWorkspaceLayoutSnapshot";

class TestFrameScheduler implements PanelWorkspaceLayoutFrameScheduler {
  private nextHandle = 1;
  private callbacks = new Map<number, FrameRequestCallback>();

  request(callback: FrameRequestCallback): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }

  flush(timestamp = 0): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    callbacks.forEach((callback) => callback(timestamp));
  }
}

function createInput(
  overrides: Partial<PanelWorkspaceLayoutCoordinatorInput> = {},
): PanelWorkspaceLayoutCoordinatorInput {
  return {
    layout: createPanelWorkspaceLayoutV3Fixture(),
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    workspaceRect: { width: 1400, height: 900 },
    ...overrides,
  };
}

function requireCoordinator(
  input: PanelWorkspaceLayoutCoordinatorInput,
  scheduler: PanelWorkspaceLayoutFrameScheduler,
  solve = solvePanelWorkspaceLayoutV3,
) {
  const result = createPanelWorkspaceLayoutCoordinator(input, {
    scheduler,
    solve,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("ADR-922 PanelWorkspaceLayoutCoordinator", () => {
  it("하나의 immutable snapshot에 frame/shell/splitter version을 함께 고정한다", () => {
    const scheduler = new TestFrameScheduler();
    const source = createPanelWorkspaceLayoutV2();
    source.visibility.history = true;
    const rightCluster = source.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    if (!rightCluster) throw new Error("right cluster is required");
    rightCluster.columns = [
      {
        id: "right:history",
        width: 320,
        rows: [{ panelId: "history", height: 450 }],
      },
      {
        id: "right:properties",
        width: 233,
        rows: [{ panelId: "properties", height: 520 }],
      },
    ];
    const migrated = migratePanelWorkspaceLayoutV2ToV3(
      source,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        surfaceRect: { width: 1400, height: 900 },
        migrationId: "coordinator-column-fixture",
      },
    );
    if (!migrated.ok) throw new Error(migrated.error);
    const coordinator = requireCoordinator(
      createInput({ layout: migrated.value }),
      scheduler,
    );

    const snapshot = coordinator.getSnapshot();

    expect(snapshot.version).toBe(0);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.workspaceRect)).toBe(true);
    expect(Object.isFrozen(snapshot.mainContentRect)).toBe(true);
    expect(Object.isFrozen(snapshot.occupiedInsets)).toBe(true);
    expect(Object.isFrozen(snapshot.frameGeometries)).toBe(true);
    expect(Object.isFrozen(snapshot.visiblePanelIds)).toBe(true);
    expect("set" in snapshot.frameGeometries).toBe(false);
    expect("add" in snapshot.visiblePanelIds).toBe(false);
    expect(snapshot.splitters).toHaveLength(1);
    expect(snapshot.splitters[0]).toMatchObject({
      kind: "column",
      orientation: "vertical",
      layoutVersion: 0,
      beforePanelIds: ["history"],
      afterPanelIds: ["properties"],
    });
    expect(Object.isFrozen(snapshot.splitters[0])).toBe(true);
    for (const geometry of snapshot.frameGeometries.values()) {
      expect(geometry.layoutVersion).toBe(snapshot.version);
      expect(Object.isFrozen(geometry)).toBe(true);
    }
  });

  it("같은 column의 visible row 사이에서 horizontal splitter를 파생한다", () => {
    const scheduler = new TestFrameScheduler();
    const layout = createPanelWorkspaceLayoutV3Fixture();
    layout.visibility.history = true;
    const coordinator = requireCoordinator(createInput({ layout }), scheduler);

    expect(coordinator.getSnapshot().splitters).toEqual([
      expect.objectContaining({
        kind: "row",
        orientation: "horizontal",
        layoutVersion: 0,
        beforePanelIds: ["properties"],
        afterPanelIds: ["history"],
        geometry: { x: 1080, y: 520, width: 320, height: 4 },
      }),
    ]);
  });

  it("frame outer resize edge는 rail이 아니라 snapshot anchor와 shared boundary에서 파생한다", () => {
    const scheduler = new TestFrameScheduler();
    const source = createPanelWorkspaceLayoutV2();
    source.visibility.history = true;
    const rightCluster = source.clusters.find(
      (cluster) => cluster.anchor === "right",
    );
    if (!rightCluster) throw new Error("right cluster is required");
    rightCluster.columns = [
      {
        id: "right:history",
        width: 320,
        rows: [{ panelId: "history", height: 450 }],
      },
      {
        id: "right:properties",
        width: 233,
        rows: [{ panelId: "properties", height: 520 }],
      },
    ];
    const migrated = migratePanelWorkspaceLayoutV2ToV3(
      source,
      PANEL_WORKSPACE_TEST_REGISTRY,
      {
        surfaceRect: { width: 1400, height: 900 },
        migrationId: "coordinator-edge-fixture",
      },
    );
    if (!migrated.ok) throw new Error(migrated.error);
    const coordinator = requireCoordinator(
      createInput({ layout: migrated.value }),
      scheduler,
    );
    const snapshot = coordinator.getSnapshot();

    expect(snapshot.frameGeometries.get("history")?.resizeEdges).toEqual([
      "left",
      "bottom",
    ]);
    expect(snapshot.frameGeometries.get("properties")?.resizeEdges).toEqual([
      "bottom",
    ]);
  });

  it("같은 display frame의 여러 input을 최신 값으로 합쳐 solve/publish를 한 번만 수행한다", () => {
    const scheduler = new TestFrameScheduler();
    const solve = vi.fn(solvePanelWorkspaceLayoutV3);
    const coordinator = requireCoordinator(createInput(), scheduler, solve);
    solve.mockClear();
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const publishedSnapshots: unknown[] = [];
    coordinator.subscribe(() => {
      listenerA();
      publishedSnapshots.push(coordinator.getSnapshot());
    });
    coordinator.subscribe(() => {
      listenerB();
      publishedSnapshots.push(coordinator.getSnapshot());
    });

    coordinator.queueInput(
      createInput({ workspaceRect: { width: 1300, height: 900 } }),
    );
    coordinator.queueInput(
      createInput({ workspaceRect: { width: 1200, height: 860 } }),
    );

    expect(scheduler.pendingCount).toBe(1);
    expect(coordinator.getSnapshot().version).toBe(0);
    scheduler.flush(8.3);

    expect(solve).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(publishedSnapshots[0]).toBe(publishedSnapshots[1]);
    expect(coordinator.getSnapshot()).toMatchObject({
      version: 1,
      workspaceRect: { width: 1200, height: 860 },
    });
  });

  it("drag preview는 committed graph solve 없이 RAF당 최신 geometry 한 번만 publish하고 clear 시 base frame을 복원한다", () => {
    const scheduler = new TestFrameScheduler();
    const solve = vi.fn(solvePanelWorkspaceLayoutV3);
    const coordinator = requireCoordinator(createInput(), scheduler, solve);
    solve.mockClear();
    const listener = vi.fn();
    coordinator.subscribe(listener);
    const baseFrame = coordinator.getSnapshot().frameGeometries.get("nodes");
    const basePropertiesFrame = coordinator
      .getSnapshot()
      .frameGeometries.get("properties");
    if (!baseFrame) throw new Error("nodes frame is required");
    if (!basePropertiesFrame) throw new Error("properties frame is required");

    coordinator.queuePreview("nodes", {
      x: 240,
      y: 120,
      width: baseFrame.width,
      height: baseFrame.height,
    });
    coordinator.queuePreview("nodes", {
      x: 360,
      y: 180,
      width: baseFrame.width,
      height: baseFrame.height,
    });

    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(solve).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(coordinator.getSnapshot().version).toBe(1);
    expect(
      coordinator.getSnapshot().frameGeometries.get("nodes"),
    ).toMatchObject({ x: 360, y: 180 });
    expect(coordinator.getSnapshot().frameGeometries.get("nodes")).not.toBe(
      baseFrame,
    );
    expect(coordinator.getSnapshot().frameGeometries.get("properties")).toBe(
      basePropertiesFrame,
    );

    coordinator.clearPreview();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.flush();
    expect(solve).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(coordinator.getSnapshot().version).toBe(2);
    expect(
      coordinator.getSnapshot().frameGeometries.get("nodes"),
    ).toMatchObject({ x: baseFrame.x, y: baseFrame.y });
    expect(coordinator.getSnapshot().frameGeometries.get("nodes")).toBe(
      baseFrame,
    );
    expect(coordinator.getSnapshot().frameGeometries.get("properties")).toBe(
      basePropertiesFrame,
    );
  });

  it("invalid queued input은 현재 snapshot을 유지하고 publish하지 않는다", () => {
    const scheduler = new TestFrameScheduler();
    const coordinator = requireCoordinator(createInput(), scheduler);
    const initialSnapshot = coordinator.getSnapshot();
    const listener = vi.fn();
    coordinator.subscribe(listener);

    coordinator.queueInput(
      createInput({
        registry: [
          ...PANEL_WORKSPACE_TEST_REGISTRY,
          PANEL_WORKSPACE_TEST_REGISTRY[0]!,
        ],
      }),
    );
    scheduler.flush();

    expect(listener).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot()).toBe(initialSnapshot);
    expect(coordinator.getLastError()).toContain("Duplicate panel registry id");
  });

  it("destroy는 pending RAF와 subscriber를 정리한다", () => {
    const scheduler = new TestFrameScheduler();
    const coordinator = requireCoordinator(createInput(), scheduler);
    const listener = vi.fn();
    coordinator.subscribe(listener);
    coordinator.queueInput(
      createInput({ workspaceRect: { width: 1200, height: 800 } }),
    );

    coordinator.destroy();
    scheduler.flush();

    expect(scheduler.pendingCount).toBe(0);
    expect(listener).not.toHaveBeenCalled();
    expect(coordinator.getSnapshot().version).toBe(0);
  });
});

describe("ADR-922 useSyncExternalStore snapshot selectors", () => {
  it("root와 panel selector가 같은 published version을 소비한다", () => {
    const scheduler = new TestFrameScheduler();
    const coordinator = requireCoordinator(createInput(), scheduler);
    const panelId: PanelId = "nodes";
    const root = renderHook(() => usePanelWorkspaceLayoutSnapshot(coordinator));
    const frame = renderHook(() =>
      usePanelWorkspaceFrameSnapshot(coordinator, panelId),
    );

    expect(root.result.current.version).toBe(0);
    expect(frame.result.current?.layoutVersion).toBe(0);

    const layout = createPanelWorkspaceLayoutV3Fixture();
    layout.visibility.nodes = false;
    act(() => {
      coordinator.queueInput(createInput({ layout }));
      scheduler.flush(8.3);
    });

    expect(root.result.current.version).toBe(1);
    expect(frame.result.current).toBeNull();
  });
});
