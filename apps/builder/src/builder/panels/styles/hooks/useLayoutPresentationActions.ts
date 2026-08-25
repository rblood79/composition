import { useCallback, useEffect, useRef, useState } from "react";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import {
  parsePresentationLayoutPx,
  resolveLayoutPresentationPilotTarget,
  type LayoutPresentationProperty,
} from "../../../presentation/editorPresentationLayoutPilot";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationHandle,
} from "../../../presentation/editorPresentationTypes";

let nextLayoutOwnerId = 1;

interface LayoutPresentationState {
  readonly handle: EditorPresentationHandle;
  readonly property: LayoutPresentationProperty;
  readonly selectedElementId: string;
  phase: "active" | "cancelled" | "failed";
}

export interface LayoutPresentationActions {
  isLayoutPresentationOwned: (property: LayoutPresentationProperty) => boolean;
  previewLayoutPresentation: (
    property: LayoutPresentationProperty,
    value: string,
  ) => boolean;
  commitLayoutPresentation: (
    property: LayoutPresentationProperty,
    value: string,
  ) => boolean;
  cancelLayoutPresentation: (reason: EditorPresentationCancelReason) => boolean;
}

/**
 * G6 scoped layout owner. Numeric px width/height and non-grid spacing use this
 * runtime when the targeted consumer can publish an affected ancestry atomically;
 * unsupported layout values fall back to the existing canonical action.
 */
export function useLayoutPresentationActions(): LayoutPresentationActions {
  const stateRef = useRef<LayoutPresentationState | null>(null);
  const [ownerId] = useState(() => `style-layout-owner-${nextLayoutOwnerId++}`);

  useEffect(() => {
    const unsubscribeSelection = useStore.subscribe(() => {
      const active = stateRef.current;
      if (!active) return;
      const { selectedElementId } = readImmediateSelectionSnapshot();
      if (selectedElementId !== active.selectedElementId) {
        active.handle.cancel("selection-change");
        active.phase = "cancelled";
      }
    });
    const handleWindowBlur = (): void => {
      const active = stateRef.current;
      if (active?.phase === "active") {
        active.handle.cancel("blur");
        active.phase = "cancelled";
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      stateRef.current?.handle.cancel("unmount");
      stateRef.current = null;
      unsubscribeSelection();
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const isLayoutPresentationOwned = useCallback(
    (property: LayoutPresentationProperty): boolean =>
      resolveLayoutPresentationPilotTarget(
        readImmediateSelectionSnapshot().selectedElementId,
        property,
      ) !== null,
    [],
  );

  const previewLayoutPresentation = useCallback(
    (property: LayoutPresentationProperty, value: string): boolean => {
      const parsed = parsePresentationLayoutPx(value);
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const existing = stateRef.current;
      if (parsed === null || !selectedElementId) {
        if (existing?.phase === "active") existing.handle.cancel("superseded");
        stateRef.current = null;
        return false;
      }
      if (existing?.phase === "cancelled") {
        if (existing.selectedElementId !== selectedElementId) return true;
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
        const pilot = resolveLayoutPresentationPilotTarget(
          selectedElementId,
          property,
        );
        if (!pilot) return false;
        active = {
          handle: editorPresentationFillPilotRuntime.beginEditorPresentation({
            commitIntent: `style-layout-${property}`,
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

      if (!active) return false;

      const pilot = resolveLayoutPresentationPilotTarget(
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
    [ownerId],
  );

  const commitLayoutPresentation = useCallback(
    (property: LayoutPresentationProperty, value: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      if (parsePresentationLayoutPx(value) === null) {
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
      if (!active && !previewLayoutPresentation(property, value)) return false;
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
      const pilot = resolveLayoutPresentationPilotTarget(
        selectedElementId,
        property,
      );
      if (!pilot) {
        current.handle.cancel("superseded");
        stateRef.current = null;
        return false;
      }
      const result = current.handle.finish({
        patch: { [property]: value },
        target: pilot.target,
        type: "style.patch",
      });
      if (result.status === "failed") current.phase = "failed";
      else stateRef.current = null;
      return true;
    },
    [previewLayoutPresentation],
  );

  const cancelLayoutPresentation = useCallback(
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
    cancelLayoutPresentation,
    commitLayoutPresentation,
    isLayoutPresentationOwned,
    previewLayoutPresentation,
  };
}
