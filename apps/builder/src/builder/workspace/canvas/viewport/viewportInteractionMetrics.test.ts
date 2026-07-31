import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getViewportInteractionBaselineSnapshot,
  getViewportInteractionMetricsSnapshot,
  recordViewportInteractionListenerFanout,
  recordViewportInteractionMirrorCommit,
  recordViewportInteractionRawInput,
  recordViewportInteractionRafFrame,
  recordViewportInteractionTransientApply,
  resetViewportInteractionMetrics,
} from "./viewportInteractionMetrics";

describe("viewport interaction metrics", () => {
  beforeEach(() => {
    resetViewportInteractionMetrics();
  });

  it("keeps G1 interaction counters separate", () => {
    recordViewportInteractionRawInput();
    recordViewportInteractionRawInput();
    recordViewportInteractionTransientApply();
    recordViewportInteractionListenerFanout(3);
    recordViewportInteractionMirrorCommit();

    expect(getViewportInteractionMetricsSnapshot()).toMatchObject({
      rawInputCount: 2,
      transientApplyCount: 1,
      listenerFanoutCount: 1,
      listenerInvocationCount: 3,
      mirrorCommitCount: 1,
    });
  });

  it("records RAF wall intervals independently of input counters", () => {
    recordViewportInteractionRafFrame(100);
    recordViewportInteractionRafFrame(108);
    recordViewportInteractionRafFrame(125);

    expect(getViewportInteractionMetricsSnapshot()).toMatchObject({
      rawInputCount: 0,
      rafWallInterval: {
        count: 2,
        p50: 17,
        p95: 17,
        max: 17,
      },
    });
  });

  it("reset clears counters and the preceding RAF timestamp", () => {
    recordViewportInteractionRawInput();
    recordViewportInteractionRafFrame(100);
    resetViewportInteractionMetrics();
    recordViewportInteractionRafFrame(300);

    expect(getViewportInteractionMetricsSnapshot()).toMatchObject({
      rawInputCount: 0,
      rafWallInterval: {
        count: 0,
      },
    });
  });

  it("keeps viewport counters distinct from handler, renderer, and long-task samples", () => {
    recordViewportInteractionRawInput();

    expect(getViewportInteractionBaselineSnapshot()).toMatchObject({
      viewport: {
        rawInputCount: 1,
      },
      perf: {
        input: {
          drag: null,
          wheelPan: null,
          wheelZoom: null,
        },
        longTasks: [],
        renderFrame: null,
      },
    });
  });

  it("wires every current continuous input route to the baseline counters", async () => {
    const [controlSource, controllerSource] = await Promise.all([
      readFile(resolve(__dirname, "./useViewportControl.ts"), "utf8"),
      readFile(resolve(__dirname, "./ViewportController.ts"), "utf8"),
    ]);

    expect(controlSource).toContain("PERF_LABEL.INPUT_VIEWPORT_DRAG");
    expect(controlSource).toContain("PERF_LABEL.INPUT_VIEWPORT_WHEEL_PAN");
    expect(controlSource).toContain("PERF_LABEL.INPUT_VIEWPORT_WHEEL_ZOOM");
    expect(controlSource).toContain("recordViewportInteractionRawInput");
    expect(controlSource).toContain("recordViewportInteractionTransientApply");
    expect(controlSource).toContain("recordViewportInteractionMirrorCommit");
    expect(controlSource).toContain("recordViewportInteractionRafFrame");
    expect(controllerSource).toContain(
      "recordViewportInteractionListenerFanout",
    );
  });
});
