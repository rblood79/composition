/**
 * ADR-187 Phase 0 production baseline counters.
 *
 * This module is observation-only. It does not own scheduling or mutation.
 * Production measurement is enabled by `?adr187Metrics=1`; development builds
 * also expose an opt-in controller so an exact Builder URL can be measured
 * without leaving counters active during ordinary editing.
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
  beforeFirstCanonicalWrite: {
    counters: EditorPresentationPhase0Counters;
    durations: Record<DurationMetric, EditorPresentationPhase0DurationSnapshot>;
  } | null;
  beforeLastTerminal: {
    counters: EditorPresentationPhase0Counters;
    durations: Record<DurationMetric, EditorPresentationPhase0DurationSnapshot>;
  } | null;
  counters: EditorPresentationPhase0Counters;
  durations: Record<DurationMetric, EditorPresentationPhase0DurationSnapshot>;
  enabled: boolean;
}

const queryEnabled =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("adr187Metrics");
const exposed =
  typeof window !== "undefined" && (import.meta.env.DEV || queryEnabled);
let enabled = queryEnabled;

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
let beforeFirstCanonicalWrite: EditorPresentationPhase0Snapshot["beforeFirstCanonicalWrite"] =
  null;
let beforeLastTerminal: EditorPresentationPhase0Snapshot["beforeLastTerminal"] =
  null;
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
  beforeLastTerminal = {
    counters: { ...counters },
    durations: snapshotCurrentDurations(),
  };
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
  if (enabled && beforeFirstCanonicalWrite === null) {
    beforeFirstCanonicalWrite = {
      counters: { ...counters },
      durations: snapshotCurrentDurations(),
    };
  }
  increment("canonicalWriteCount");
}

export function isEditorPresentationPhase0MetricsEnabled(): boolean {
  return enabled;
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

function snapshotCurrentDurations(): Record<
  DurationMetric,
  EditorPresentationPhase0DurationSnapshot
> {
  return {
    actionRaf: snapshotDurations(durationSamples.actionRaf),
    controlRaf: snapshotDurations(durationSamples.controlRaf),
    frameApply: snapshotDurations(durationSamples.frameApply),
    projectionSignature: snapshotDurations(durationSamples.projectionSignature),
  };
}

export function getEditorPresentationPhase0Snapshot(): EditorPresentationPhase0Snapshot {
  return {
    beforeFirstCanonicalWrite,
    beforeLastTerminal,
    counters: { ...counters },
    durations: snapshotCurrentDurations(),
    enabled,
  };
}

export function resetEditorPresentationPhase0Metrics(): void {
  counters = createCounters();
  beforeFirstCanonicalWrite = null;
  beforeLastTerminal = null;
  terminalSeen = false;
  previewFullDocumentRepresentativeBytes = 0;
  durationSamples = {
    actionRaf: [],
    controlRaf: [],
    frameApply: [],
    projectionSignature: [],
  };
}

export function enableEditorPresentationPhase0Metrics(): void {
  resetEditorPresentationPhase0Metrics();
  enabled = true;
}

export function disableEditorPresentationPhase0Metrics(): void {
  resetEditorPresentationPhase0Metrics();
  enabled = false;
}

declare global {
  interface Window {
    __composition_EDITOR_PRESENTATION_PHASE0_METRICS_DOM_ABORT__?: AbortController;
    __composition_EDITOR_PRESENTATION_PHASE0_METRICS__?: {
      disable: typeof disableEditorPresentationPhase0Metrics;
      enable: typeof enableEditorPresentationPhase0Metrics;
      recordFrameApply: typeof recordEditorPresentationFrameApply;
      recordLegacyWrite: typeof recordEditorPresentationLegacyWrite;
      reset: typeof resetEditorPresentationPhase0Metrics;
      snapshot: typeof getEditorPresentationPhase0Snapshot;
    };
  }
}

if (exposed) {
  window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__ = {
    disable: disableEditorPresentationPhase0Metrics,
    enable: enableEditorPresentationPhase0Metrics,
    recordFrameApply: recordEditorPresentationFrameApply,
    recordLegacyWrite: recordEditorPresentationLegacyWrite,
    reset: resetEditorPresentationPhase0Metrics,
    snapshot: getEditorPresentationPhase0Snapshot,
  };
}

if (typeof document !== "undefined" && import.meta.env.DEV) {
  window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS_DOM_ABORT__?.abort();
  const controller = new AbortController();
  window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS_DOM_ABORT__ =
    controller;
  const writeDomSnapshot = () => {
    const snapshot =
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.snapshot();
    if (snapshot) {
      document.documentElement.dataset.compositionAdr187Metrics =
        JSON.stringify(snapshot);
    }
  };
  document.addEventListener(
    "composition:adr187-metrics-enable",
    () => {
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.enable();
      writeDomSnapshot();
    },
    { signal: controller.signal },
  );
  document.addEventListener(
    "composition:adr187-metrics-reset",
    () => {
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.reset();
      writeDomSnapshot();
    },
    { signal: controller.signal },
  );
  document.addEventListener(
    "composition:adr187-metrics-snapshot",
    writeDomSnapshot,
    { signal: controller.signal },
  );
  document.addEventListener(
    "composition:adr187-metrics-disable",
    () => {
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.disable();
      writeDomSnapshot();
    },
    { signal: controller.signal },
  );

  const commands = {
    disable: () =>
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.disable(),
    enable: () =>
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.enable(),
    reset: () =>
      window.__composition_EDITOR_PRESENTATION_PHASE0_METRICS__?.reset(),
    snapshot: () => undefined,
  } as const;
  for (const [commandIndex, [command, run]] of Object.entries(
    commands,
  ).entries()) {
    const selector = `[data-adr187-metrics-command="${command}"]`;
    let button = document.querySelector<HTMLButtonElement>(selector);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
      button.dataset.adr187MetricsCommand = command;
      document.documentElement.append(button);
    }
    Object.assign(button.style, {
      border: "0",
      height: "1px",
      left: `${commandIndex}px`,
      opacity: "0",
      padding: "0",
      position: "fixed",
      top: "0",
      width: "1px",
      zIndex: "2147483647",
    });
    button.onclick = () => {
      run();
      writeDomSnapshot();
    };
  }
}
