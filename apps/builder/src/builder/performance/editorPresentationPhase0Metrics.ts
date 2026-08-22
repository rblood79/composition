/**
 * ADR-187 Phase 0 production baseline counters.
 *
 * This module is observation-only. It does not own scheduling or mutation and
 * is enabled only when the Builder URL contains `?adr187Metrics=1`.
 */

type DurationMetric =
  "actionRaf" | "controlRaf" | "frameApply" | "projectionSignature";

interface EditorPresentationPhase0Counters {
  actionRafCallbackCount: number;
  bridgeFullRebuildCount: number;
  canonicalWriteCount: number;
  controlRafCallbackCount: number;
  frameApplyCount: number;
  layoutPublishCount: number;
  legacyWriteCount: number;
  previewDeltaBytes: number;
  previewDeltaMessageCount: number;
  previewFullDocumentBytes: number;
  previewFullDocumentMessageCount: number;
  projectionSignatureCount: number;
  rawInputCount: number;
  staleCallbackAfterTerminalCount: number;
  targetIncrementalPatchCount: number;
  terminalEventCount: number;
}

export interface EditorPresentationPhase0DurationSnapshot {
  count: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface EditorPresentationPhase0Snapshot {
  counters: EditorPresentationPhase0Counters;
  durations: Record<DurationMetric, EditorPresentationPhase0DurationSnapshot>;
  enabled: boolean;
}

const enabled =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("adr187Metrics");

const createCounters = (): EditorPresentationPhase0Counters => ({
  actionRafCallbackCount: 0,
  bridgeFullRebuildCount: 0,
  canonicalWriteCount: 0,
  controlRafCallbackCount: 0,
  frameApplyCount: 0,
  layoutPublishCount: 0,
  legacyWriteCount: 0,
  previewDeltaBytes: 0,
  previewDeltaMessageCount: 0,
  previewFullDocumentBytes: 0,
  previewFullDocumentMessageCount: 0,
  projectionSignatureCount: 0,
  rawInputCount: 0,
  staleCallbackAfterTerminalCount: 0,
  targetIncrementalPatchCount: 0,
  terminalEventCount: 0,
});

let counters = createCounters();
let terminalSeen = false;
let previewFullDocumentRepresentativeBytes = 0;
let durationSamples: Record<DurationMetric, number[]> = {
  actionRaf: [],
  controlRaf: [],
  frameApply: [],
  projectionSignature: [],
};

function increment(
  key: keyof EditorPresentationPhase0Counters,
  amount = 1,
): void {
  if (!enabled) return;
  counters[key] += amount;
}

function recordDuration(metric: DurationMetric, durationMs: number): void {
  if (!enabled || !Number.isFinite(durationMs) || durationMs < 0) return;
  durationSamples[metric].push(durationMs);
}

function recordScheduledCallback(
  counter: "actionRafCallbackCount" | "controlRafCallbackCount",
  metric: "actionRaf" | "controlRaf",
  durationMs: number,
): void {
  if (!enabled) return;
  increment(counter);
  recordDuration(metric, durationMs);
  if (terminalSeen) increment("staleCallbackAfterTerminalCount");
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

function snapshotDurations(
  values: readonly number[],
): EditorPresentationPhase0DurationSnapshot {
  if (values.length === 0) {
    return { count: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const round = (value: number) => Number(value.toFixed(3));
  return {
    count: sorted.length,
    max: round(sorted[sorted.length - 1]),
    mean: round(total / sorted.length),
    p50: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
  };
}

export function recordEditorPresentationRawInput(): void {
  if (!enabled) return;
  terminalSeen = false;
  increment("rawInputCount");
}

export function recordEditorPresentationTerminalEvent(): void {
  if (!enabled) return;
  terminalSeen = true;
  increment("terminalEventCount");
}

export function recordEditorPresentationControlRaf(durationMs: number): void {
  recordScheduledCallback("controlRafCallbackCount", "controlRaf", durationMs);
}

export function recordEditorPresentationActionRaf(durationMs: number): void {
  recordScheduledCallback("actionRafCallbackCount", "actionRaf", durationMs);
}

export function recordEditorPresentationFrameApply(durationMs: number): void {
  if (!enabled) return;
  increment("frameApplyCount");
  recordDuration("frameApply", durationMs);
}

export function recordEditorPresentationCanonicalWrite(): void {
  increment("canonicalWriteCount");
}

export function recordEditorPresentationLegacyWrite(): void {
  increment("legacyWriteCount");
}

export function recordEditorPresentationLayoutPublish(): void {
  increment("layoutPublishCount");
}

export function recordEditorPresentationProjectionSignature(
  durationMs: number,
): void {
  if (!enabled) return;
  increment("projectionSignatureCount");
  recordDuration("projectionSignature", durationMs);
}

export function recordEditorPresentationBridgeFullRebuild(): void {
  increment("bridgeFullRebuildCount");
}

export function recordEditorPresentationTargetIncrementalPatches(
  count: number,
): void {
  increment("targetIncrementalPatchCount", count);
}

export function recordEditorPresentationPreviewFullDocumentMessage(
  payload: unknown,
): void {
  if (!enabled) return;
  increment("previewFullDocumentMessageCount");
  if (previewFullDocumentRepresentativeBytes === 0) {
    try {
      previewFullDocumentRepresentativeBytes = new TextEncoder().encode(
        JSON.stringify(payload),
      ).byteLength;
    } catch {
      previewFullDocumentRepresentativeBytes = -1;
    }
  }
  counters.previewFullDocumentBytes += previewFullDocumentRepresentativeBytes;
}

export function recordEditorPresentationPreviewDeltaMessage(
  payload: unknown,
): void {
  if (!enabled) return;
  increment("previewDeltaMessageCount");
  try {
    counters.previewDeltaBytes += new TextEncoder().encode(
      JSON.stringify(payload),
    ).byteLength;
  } catch {
    // structured-clone validator가 먼저 차단한다. 계측은 제품 전송을 막지 않는다.
  }
}

export function getEditorPresentationPhase0Snapshot(): EditorPresentationPhase0Snapshot {
  return {
    counters: { ...counters },
    durations: {
      actionRaf: snapshotDurations(durationSamples.actionRaf),
      controlRaf: snapshotDurations(durationSamples.controlRaf),
      frameApply: snapshotDurations(durationSamples.frameApply),
      projectionSignature: snapshotDurations(
        durationSamples.projectionSignature,
      ),
    },
    enabled,
  };
}

export function resetEditorPresentationPhase0Metrics(): void {
  counters = createCounters();
  terminalSeen = false;
  previewFullDocumentRepresentativeBytes = 0;
  durationSamples = {
    actionRaf: [],
    controlRaf: [],
    frameApply: [],
    projectionSignature: [],
  };
}

declare global {
  interface Window {
    __composition_EDITOR_PRESENTATION_PHASE0_METRICS__?: {
      recordFrameApply: typeof recordEditorPresentationFrameApply;
      recordLegacyWrite: typeof recordEditorPresentationLegacyWrite;
      reset: typeof resetEditorPresentationPhase0Metrics;
      snapshot: typeof getEditorPresentationPhase0Snapshot;
    };
  }
}

if (typeof window !== "undefined" && enabled) {
  window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__ = {
    recordFrameApply: recordEditorPresentationFrameApply,
    recordLegacyWrite: recordEditorPresentationLegacyWrite,
    reset: resetEditorPresentationPhase0Metrics,
    snapshot: getEditorPresentationPhase0Snapshot,
  };
}
