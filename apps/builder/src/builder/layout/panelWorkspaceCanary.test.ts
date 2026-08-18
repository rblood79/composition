import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createPanelWorkspaceAppliedVersionTracker,
  summarizePanelWorkspaceAppliedFrames,
} from "./panelWorkspaceCanary";

describe("ADR-922 real-frame canary", () => {
  it("G2b 통과 뒤 임시 canary gate를 production source에서 제거한다", async () => {
    const [workspace, metrics] = await Promise.all([
      readFile(resolve(__dirname, "PanelWorkspace.tsx"), "utf-8"),
      readFile(resolve(__dirname, "panelWorkspaceCanary.ts"), "utf-8"),
    ]);

    expect(workspace).not.toContain("panelLayoutCanary");
    expect(metrics).not.toContain("panelLayoutCanary");
    expect(metrics).not.toContain("createPanelWorkspaceRealFrameCanary");
  });

  it("source와 affected neighbor가 같은 version으로 DOM commit된 뒤에만 applied로 판정한다", () => {
    const tracker = createPanelWorkspaceAppliedVersionTracker();
    tracker.recordInput({
      inputAtMs: 100,
      expectedVersion: 7,
      affectedPanelIds: ["properties", "history"],
    });
    tracker.recordFrameApplied("properties", 7);

    expect(tracker.takeReadyPresentation(108)).toBeNull();

    tracker.recordFrameApplied("history", 6);
    expect(tracker.takeReadyPresentation(112)).toBeNull();

    tracker.recordFrameApplied("history", 7);
    expect(tracker.takeReadyPresentation(116)).toEqual({
      inputToAppliedFrameMs: 16,
      appliedVersionMismatchCount: 0,
      version: 7,
    });
  });

  it("expected version을 건너뛰고 더 새 version만 적용한 frame은 mismatch로 판정한다", () => {
    const tracker = createPanelWorkspaceAppliedVersionTracker();
    tracker.recordInput({
      inputAtMs: 100,
      expectedVersion: 7,
      affectedPanelIds: ["properties", "history"],
    });
    tracker.recordFrameApplied("properties", 8);
    tracker.recordFrameApplied("history", 8);

    expect(tracker.takeReadyPresentation(116)).toEqual({
      inputToAppliedFrameMs: 16,
      appliedVersionMismatchCount: 1,
      version: 7,
    });
  });

  it("같은 RAF version의 연속 input은 affected frame과 최초 timestamp를 합친다", () => {
    const tracker = createPanelWorkspaceAppliedVersionTracker();
    tracker.recordInput({
      inputAtMs: 100,
      expectedVersion: 4,
      affectedPanelIds: ["properties", "history"],
    });
    tracker.recordInput({
      inputAtMs: 104,
      expectedVersion: 4,
      affectedPanelIds: ["properties"],
    });
    tracker.recordFrameApplied("properties", 4);

    expect(tracker.takeReadyPresentation(112)).toBeNull();
    tracker.recordFrameApplied("history", 4);
    expect(tracker.takeReadyPresentation(116)).toEqual({
      inputToAppliedFrameMs: 16,
      appliedVersionMismatchCount: 0,
      version: 4,
    });
  });

  it("p95와 native display-period Gate를 store publish가 아니라 applied frame 표본으로 계산한다", () => {
    const summary = summarizePanelWorkspaceAppliedFrames({
      displayPeriodMs: 8.3,
      baselineFrameDelivery: 0.99,
      interactionFrameDelivery: 0.96,
      inputToAppliedFrameMs: [8, 12, 15, 16, 20],
      appliedVersionMismatchCount: 0,
      longTaskCount: 0,
      pointerDomGeometryQueryCount: 0,
    });

    expect(summary.inputToAppliedFrameP95Ms).toBe(20);
    expect(summary.frameDeliveryDelta).toBeCloseTo(-0.03, 5);
    expect(summary.passesG2b).toBe(false);

    const passing = summarizePanelWorkspaceAppliedFrames({
      ...summary,
      inputToAppliedFrameMs: [8, 10, 12, 14, 16],
    });
    expect(passing.passesG2b).toBe(true);
  });
});
