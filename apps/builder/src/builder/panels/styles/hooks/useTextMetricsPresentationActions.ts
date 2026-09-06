import { usePresentationLifecycle } from "./usePresentationLifecycle";
import { useCallback, useRef, useState } from "react";
import { readImmediateSelectionSnapshot } from "../../../stores";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import {
  parsePresentationFontSize,
  parsePresentationFontWeight,
  resolveTextMetricPresentationPilotTarget,
  type TextMetricPresentationProperty,
} from "../../../presentation/editorPresentationTextMetrics";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationHandle,
} from "../../../presentation/editorPresentationTypes";

let nextTextMetricOwnerId = 1;

interface TextMetricPresentationState {
  readonly handle: EditorPresentationHandle;
  readonly property: TextMetricPresentationProperty;
  readonly selectedElementId: string;
  phase: "active" | "cancelled" | "failed";
}

export interface TextMetricsPresentationActions {
  isTextMetricPresentationOwned: (
    property: TextMetricPresentationProperty,
  ) => boolean;
  previewTextMetricPresentation: (
    property: TextMetricPresentationProperty,
    value: string,
  ) => boolean;
  commitTextMetricPresentation: (
    property: TextMetricPresentationProperty,
    value: string,
  ) => boolean;
  cancelTextMetricPresentation: (
    reason: EditorPresentationCancelReason,
  ) => boolean;
}

/** G8 scoped owner for the fixed-box Text font-size slice. */
export function useTextMetricsPresentationActions(): TextMetricsPresentationActions {
  const stateRef = useRef<TextMetricPresentationState | null>(null);
  const [ownerId] = useState(
    () => `style-text-metric-owner-${nextTextMetricOwnerId++}`,
  );
  const parsePropertyValue = useCallback(
    (
      property: TextMetricPresentationProperty,
      value: unknown,
    ): number | null =>
      property === "fontSize"
        ? parsePresentationFontSize(value)
        : parsePresentationFontWeight(value),
    [],
  );

  usePresentationLifecycle(stateRef);

  const isTextMetricPresentationOwned = useCallback(
    (property: TextMetricPresentationProperty) =>
      resolveTextMetricPresentationPilotTarget(
        readImmediateSelectionSnapshot().selectedElementId,
        property,
      ) !== null,
    [],
  );

  const previewTextMetricPresentation = useCallback(
    (property: TextMetricPresentationProperty, value: string): boolean => {
      const parsed = parsePropertyValue(property, value);
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const existing = stateRef.current;
      if (parsed === null || !selectedElementId) {
        if (existing?.phase === "active") existing.handle.cancel("superseded");
        stateRef.current = null;
        return false;
      }
      if (existing?.phase === "cancelled") {
        if (
          existing.selectedElementId !== selectedElementId ||
          existing.property !== property
        ) {
          return true;
        }
        stateRef.current = null;
      } else if (existing?.phase === "failed") {
        existing.handle.cancel("superseded");
        stateRef.current = null;
      }

      let active = stateRef.current;
      if (
        active &&
        (active.selectedElementId !== selectedElementId ||
          active.property !== property)
      ) {
        active.handle.cancel("selection-change");
        active = null;
        stateRef.current = null;
      }
      if (!active) {
        const pilot = resolveTextMetricPresentationPilotTarget(
          selectedElementId,
          property,
        );
        if (!pilot) return false;
        active = {
          handle: editorPresentationFillPilotRuntime.beginEditorPresentation({
            commitIntent: "style-text-metrics",
            ownerId,
            projectId: pilot.projectId,
            targets: [pilot.target],
          }),
          phase: "active",
          property,
          selectedElementId,
        };
        stateRef.current = active;
      }

      const pilot = resolveTextMetricPresentationPilotTarget(
        selectedElementId,
        property,
      );
      if (!pilot) {
        active.handle.cancel("superseded");
        stateRef.current = null;
        return false;
      }
      const descriptor: EditorMutationDescriptor = {
        patch: { [property]: parsed },
        target: pilot.target,
        type: "style.patch",
      };
      if (!active.handle.publish(descriptor)) {
        stateRef.current = { ...active, phase: "cancelled" };
      }
      return true;
    },
    [ownerId, parsePropertyValue],
  );

  const commitTextMetricPresentation = useCallback(
    (property: TextMetricPresentationProperty, value: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const parsed = parsePropertyValue(property, value);
      if (parsed === null) {
        const active = stateRef.current;
        if (active?.phase === "active") active.handle.cancel("superseded");
        stateRef.current = null;
        return false;
      }
      const active = stateRef.current;
      if (active?.phase === "cancelled") {
        stateRef.current = null;
        return true;
      }
      if (!active && !previewTextMetricPresentation(property, value)) {
        return false;
      }
      const current = stateRef.current;
      if (
        !current ||
        current.selectedElementId !== selectedElementId ||
        current.property !== property
      ) {
        current?.handle.cancel("selection-change");
        stateRef.current = null;
        return true;
      }
      const pilot = resolveTextMetricPresentationPilotTarget(
        selectedElementId,
        property,
      );
      if (!pilot) {
        current.handle.cancel("superseded");
        stateRef.current = null;
        return false;
      }
      const result = current.handle.finish({
        patch: { [property]: parsed },
        target: pilot.target,
        type: "style.patch",
      });
      if (result.status === "failed") current.phase = "failed";
      else stateRef.current = null;
      return true;
    },
    [parsePropertyValue, previewTextMetricPresentation],
  );

  const cancelTextMetricPresentation = useCallback(
    (reason: EditorPresentationCancelReason): boolean => {
      const active = stateRef.current;
      if (!active || active.phase !== "active") return false;
      active.handle.cancel(reason);
      active.phase = "cancelled";
      return true;
    },
    [],
  );

  return {
    cancelTextMetricPresentation,
    commitTextMetricPresentation,
    isTextMetricPresentationOwned,
    previewTextMetricPresentation,
  };
}
