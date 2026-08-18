import { describe, expect, it, vi } from "vitest";
import {
  mountPanelWorkspaceDiagnostics,
  summarizePanelWorkspaceTrace,
} from "./panelWorkspaceDiagnostics";

describe("summarizePanelWorkspaceTrace", () => {
  it("derives native refresh delivery and interaction counters without a 60Hz cap", () => {
    const report = summarizePanelWorkspaceTrace({
      durationMs: 5_000,
      idleFrameIntervals: [8.2, 8.4, 8.3, 8.1, 8.3],
      interactionFrameIntervals: [8.3, 8.2, 16.7, 8.3, 25],
      pointerMoveCount: 5,
      solveCount: 5,
      workspaceCommitCount: 2,
      frameCommitCounts: new Map([
        ["history", 5],
        ["properties", 4],
      ]),
      longTaskDurations: [51, 72],
    });

    expect(report.displayPeriodMs).toBeCloseTo(8.3, 5);
    expect(report.estimatedRefreshHz).toBeCloseTo(1000 / 8.3, 5);
    expect(report.expectedPeriods).toBe(602);
    expect(report.missedPeriods).toBe(3);
    expect(report.frameDelivery).toBeCloseTo(599 / 602, 5);
    expect(report.pointerMoveCount).toBe(5);
    expect(report.solveCount).toBe(5);
    expect(report.workspaceCommitCount).toBe(2);
    expect(report.frameCommitCount).toBe(9);
    expect(report.frameCommitCounts).toEqual({ history: 5, properties: 4 });
    expect(report.longTaskCount).toBe(2);
    expect(report.longTaskTotalDurationMs).toBe(123);
    expect(report.maxLongTaskMs).toBe(72);
  });

  it("reports unmeasured refresh data explicitly when idle samples are absent", () => {
    const report = summarizePanelWorkspaceTrace({
      durationMs: 5_000,
      idleFrameIntervals: [],
      interactionFrameIntervals: [],
      pointerMoveCount: 0,
      solveCount: 0,
      workspaceCommitCount: 0,
      frameCommitCounts: new Map(),
      longTaskDurations: [],
    });

    expect(report.displayPeriodMs).toBeNull();
    expect(report.estimatedRefreshHz).toBeNull();
    expect(report.expectedPeriods).toBeNull();
    expect(report.missedPeriods).toBeNull();
    expect(report.frameDelivery).toBeNull();
  });

  it("does not mount document listeners without the explicit trace query", () => {
    window.history.replaceState({}, "", "/builder/test");
    const listenerSpy = vi.spyOn(document, "addEventListener");

    try {
      const cleanup = mountPanelWorkspaceDiagnostics();

      expect(listenerSpy).not.toHaveBeenCalled();
      cleanup();
    } finally {
      listenerSpy.mockRestore();
    }
  });
});
