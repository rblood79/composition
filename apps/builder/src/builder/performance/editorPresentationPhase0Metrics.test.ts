// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__;
  window.history.replaceState({}, "", "/");
  vi.resetModules();
});

describe("ADR-187 Phase 0 presentation metrics", () => {
  it("is inert unless the production baseline query flag is present", async () => {
    const metrics = await import("./editorPresentationPhase0Metrics");
    metrics.recordEditorPresentationRawInput();
    metrics.recordEditorPresentationCanonicalWrite();

    expect(
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__,
    ).toBeUndefined();
    expect(metrics.getEditorPresentationPhase0Snapshot()).toMatchObject({
      enabled: false,
      counters: { canonicalWriteCount: 0, rawInputCount: 0 },
    });
  });

  it("records attribution counters, durations, bytes, and stale terminal callbacks", async () => {
    window.history.replaceState({}, "", "/builder/test?adr187Metrics=1");
    const metrics = await import("./editorPresentationPhase0Metrics");

    metrics.resetEditorPresentationPhase0Metrics();
    metrics.recordEditorPresentationRawInput();
    metrics.recordEditorPresentationControlRaf(2);
    metrics.recordEditorPresentationActionRaf(3);
    metrics.recordEditorPresentationFrameApply(4);
    metrics.recordEditorPresentationCanonicalWrite();
    metrics.recordEditorPresentationLegacyWrite();
    metrics.recordEditorPresentationLayoutPublish();
    metrics.recordEditorPresentationProjectionSignature(5);
    metrics.recordEditorPresentationBridgeFullRebuild();
    metrics.recordEditorPresentationTargetIncrementalPatches(3);
    metrics.recordEditorPresentationPreviewFullDocumentMessage({
      type: "UPDATE_CANONICAL_DOCUMENT",
      document: { version: "composition-1.0" },
    });
    metrics.recordEditorPresentationTerminalEvent();
    metrics.recordEditorPresentationActionRaf(1);

    const snapshot = metrics.getEditorPresentationPhase0Snapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.counters).toMatchObject({
      actionRafCallbackCount: 2,
      bridgeFullRebuildCount: 1,
      canonicalWriteCount: 1,
      controlRafCallbackCount: 1,
      frameApplyCount: 1,
      layoutPublishCount: 1,
      legacyWriteCount: 1,
      previewDeltaBytes: 0,
      previewDeltaMessageCount: 0,
      previewFullDocumentMessageCount: 1,
      projectionSignatureCount: 1,
      rawInputCount: 1,
      staleCallbackAfterTerminalCount: 1,
      targetIncrementalPatchCount: 3,
      terminalEventCount: 1,
    });
    expect(snapshot.counters.previewFullDocumentBytes).toBeGreaterThan(0);
    expect(snapshot.durations.frameApply).toEqual({
      count: 1,
      max: 4,
      mean: 4,
      p50: 4,
      p95: 4,
      p99: 4,
    });
  });
});
