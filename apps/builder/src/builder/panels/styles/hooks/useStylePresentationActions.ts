import { useCallback, useEffect, useRef } from "react";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import { resolveBorderColorPresentationPilotTarget } from "../../../presentation/editorPresentationStylePilot";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationHandle,
  EditorPresentationTargetRef,
} from "../../../presentation/editorPresentationTypes";

let nextStyleOwnerId = 1;

export interface StylePresentationActions {
  isBorderColorPresentationOwned: () => boolean;
  previewBorderColorPresentation: (color: string) => boolean;
  commitBorderColorPresentation: (color: string) => boolean;
  cancelBorderColorPresentation: (
    reason: EditorPresentationCancelReason,
  ) => boolean;
}

export function useStylePresentationActions(): StylePresentationActions {
  const presentationRef = useRef<{
    baseStyle: Readonly<Record<string, unknown>>;
    handle: EditorPresentationHandle;
    phase: "active" | "cancelled" | "failed";
    selectedElementId: string;
    target: EditorPresentationTargetRef;
  } | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const ownerId =
    ownerIdRef.current ?? `style-border-color-owner-${nextStyleOwnerId++}`;
  ownerIdRef.current = ownerId;

  useEffect(() => {
    const unsubscribeSelection = useStore.subscribe(() => {
      const presentation = presentationRef.current;
      if (!presentation) return;
      const { selectedElementId } = readImmediateSelectionSnapshot();
      if (selectedElementId === presentation.selectedElementId) return;
      presentation.handle.cancel("selection-change");
      presentation.phase = "cancelled";
    });
    const handleWindowBlur = (): void => {
      const presentation = presentationRef.current;
      if (!presentation || presentation.phase !== "active") return;
      presentation.handle.cancel("blur");
      presentation.phase = "cancelled";
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      presentationRef.current?.handle.cancel("unmount");
      presentationRef.current = null;
      unsubscribeSelection();
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const isBorderColorPresentationOwned = useCallback(
    () =>
      resolveBorderColorPresentationPilotTarget(
        readImmediateSelectionSnapshot().selectedElementId,
      ) !== null,
    [],
  );

  const previewBorderColorPresentation = useCallback(
    (color: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const existing = presentationRef.current;
      if (existing?.phase === "cancelled") {
        if (existing.selectedElementId !== selectedElementId) return true;
        presentationRef.current = null;
      }
      if (existing?.phase === "failed") {
        existing.handle.cancel("superseded");
        presentationRef.current = null;
      }

      let presentation = presentationRef.current;
      if (
        presentation &&
        presentation.selectedElementId !== selectedElementId
      ) {
        presentation.handle.cancel("selection-change");
        presentation = null;
        presentationRef.current = null;
      }
      if (!presentation) {
        const pilot =
          resolveBorderColorPresentationPilotTarget(selectedElementId);
        if (!pilot || !selectedElementId) return false;
        presentation = {
          baseStyle: pilot.style,
          handle: editorPresentationFillPilotRuntime.beginEditorPresentation({
            commitIntent: "style-border-color",
            ownerId,
            projectId: pilot.projectId,
            targets: [pilot.target],
          }),
          phase: "active",
          selectedElementId,
          target: pilot.target,
        };
        presentationRef.current = presentation;
      }

      const descriptor: EditorMutationDescriptor = {
        patch: { borderColor: color },
        target: presentation.target,
        type: "style.patch",
      };
      if (!presentation.handle.publish(descriptor)) {
        presentation.phase = "cancelled";
      }
      return true;
    },
    [ownerId],
  );

  const commitBorderColorPresentation = useCallback(
    (color: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const active = presentationRef.current;
      if (active?.phase === "cancelled") {
        presentationRef.current = null;
        return true;
      }
      if (!active && !previewBorderColorPresentation(color)) return false;
      const presentation = presentationRef.current;
      if (
        !presentation ||
        presentation.selectedElementId !== selectedElementId
      ) {
        presentation?.handle.cancel("selection-change");
        presentationRef.current = null;
        return true;
      }
      const result = presentation.handle.finish({
        patch: { borderColor: color },
        target: presentation.target,
        type: "style.patch",
      });
      if (result.status === "failed") presentation.phase = "failed";
      else presentationRef.current = null;
      return true;
    },
    [previewBorderColorPresentation],
  );

  const cancelBorderColorPresentation = useCallback(
    (reason: EditorPresentationCancelReason): boolean => {
      const presentation = presentationRef.current;
      if (!presentation || presentation.phase !== "active") return false;
      presentation.handle.cancel(reason);
      presentation.phase = "cancelled";
      return true;
    },
    [],
  );

  return {
    cancelBorderColorPresentation,
    commitBorderColorPresentation,
    isBorderColorPresentationOwned,
    previewBorderColorPresentation,
  };
}
