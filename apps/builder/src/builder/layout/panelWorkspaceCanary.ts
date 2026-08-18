import type { PanelId } from "../panels/core/types";

export interface PanelWorkspaceAppliedInput {
  inputAtMs: number;
  expectedVersion: number;
  affectedPanelIds: readonly PanelId[];
}

export interface PanelWorkspaceAppliedPresentation {
  inputToAppliedFrameMs: number;
  appliedVersionMismatchCount: number;
  version: number;
}

export interface PanelWorkspaceAppliedVersionTracker {
  recordInput(input: PanelWorkspaceAppliedInput): void;
  recordFrameApplied(panelId: PanelId, version: number): void;
  takeReadyPresentation(
    nowMs: number,
  ): PanelWorkspaceAppliedPresentation | null;
}

export interface PanelWorkspaceAppliedFrameSummaryInput {
  displayPeriodMs: number | null;
  baselineFrameDelivery: number | null;
  interactionFrameDelivery: number | null;
  inputToAppliedFrameMs: readonly number[];
  appliedVersionMismatchCount: number;
  longTaskCount: number;
  pointerDomGeometryQueryCount: number;
}

export interface PanelWorkspaceAppliedFrameSummary extends PanelWorkspaceAppliedFrameSummaryInput {
  inputToAppliedFrameP95Ms: number | null;
  frameDeliveryDelta: number | null;
  passesG2b: boolean;
}

export function createPanelWorkspaceAppliedVersionTracker(): PanelWorkspaceAppliedVersionTracker {
  const appliedVersions = new Map<PanelId, Set<number>>();
  const pendingByVersion = new Map<number, PanelWorkspaceAppliedInput>();
  let mismatchCount = 0;
  const mismatchSignatures = new Set<string>();

  return {
    recordInput(input): void {
      const existing = pendingByVersion.get(input.expectedVersion);
      pendingByVersion.set(input.expectedVersion, {
        inputAtMs: Math.min(
          existing?.inputAtMs ?? input.inputAtMs,
          input.inputAtMs,
        ),
        expectedVersion: input.expectedVersion,
        affectedPanelIds: [
          ...new Set([
            ...(existing?.affectedPanelIds ?? []),
            ...input.affectedPanelIds,
          ]),
        ],
      });
    },
    recordFrameApplied(panelId, version): void {
      const versions = appliedVersions.get(panelId) ?? new Set<number>();
      versions.add(version);
      while (versions.size > 8) {
        const oldest = Math.min(...versions);
        versions.delete(oldest);
      }
      appliedVersions.set(panelId, versions);
    },
    takeReadyPresentation(nowMs): PanelWorkspaceAppliedPresentation | null {
      const pending = [...pendingByVersion.values()].sort(
        (left, right) => left.expectedVersion - right.expectedVersion,
      )[0];
      if (!pending) return null;
      const versions = pending.affectedPanelIds.map((panelId) =>
        appliedVersions.get(panelId),
      );
      if (versions.some((version) => version === undefined)) return null;
      const latestVersions = versions.map((panelVersions) =>
        panelVersions ? Math.max(...panelVersions) : -Infinity,
      );
      if (
        latestVersions.some(
          (latestVersion) => latestVersion < pending.expectedVersion,
        )
      ) {
        return null;
      }
      const skippedExpectedVersion = versions.some((panelVersions) =>
        panelVersions ? !panelVersions.has(pending.expectedVersion) : true,
      );
      if (skippedExpectedVersion) {
        const signature = `${pending.expectedVersion}:${versions
          .map((panelVersions) =>
            panelVersions ? [...panelVersions].join(",") : "missing",
          )
          .join(":")}`;
        if (!mismatchSignatures.has(signature)) {
          mismatchCount += 1;
          mismatchSignatures.add(signature);
        }
      }
      const result = {
        inputToAppliedFrameMs: Math.max(0, nowMs - pending.inputAtMs),
        appliedVersionMismatchCount: mismatchCount,
        version: pending.expectedVersion,
      };
      pendingByVersion.delete(pending.expectedVersion);
      mismatchCount = 0;
      mismatchSignatures.clear();
      return result;
    },
  };
}

function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
}

export function summarizePanelWorkspaceAppliedFrames(
  input: PanelWorkspaceAppliedFrameSummaryInput,
): PanelWorkspaceAppliedFrameSummary {
  const inputToAppliedFrameP95Ms = percentile95(input.inputToAppliedFrameMs);
  const frameDeliveryDelta =
    input.baselineFrameDelivery === null ||
    input.interactionFrameDelivery === null
      ? null
      : input.interactionFrameDelivery - input.baselineFrameDelivery;
  const passesG2b =
    input.displayPeriodMs !== null &&
    input.displayPeriodMs > 0 &&
    inputToAppliedFrameP95Ms !== null &&
    inputToAppliedFrameP95Ms <= input.displayPeriodMs * 2 &&
    frameDeliveryDelta !== null &&
    frameDeliveryDelta >= -0.05 &&
    input.appliedVersionMismatchCount === 0 &&
    input.longTaskCount === 0 &&
    input.pointerDomGeometryQueryCount === 0;
  return {
    ...input,
    inputToAppliedFrameP95Ms,
    frameDeliveryDelta,
    passesG2b,
  };
}
