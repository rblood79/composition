import { useCallback, useEffect, useRef } from "react";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import {
  resolveBorderColorPresentationPilotTarget,
  resolveBoxShadowPresentationPilotTarget,
} from "../../../presentation/editorPresentationStylePilot";
import { parseBoxShadowEffects } from "../../../workspace/canvas/styleConversion/styleConverter";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationHandle,
  EditorPresentationTargetRef,
} from "../../../presentation/editorPresentationTypes";

let nextStyleOwnerId = 1;

function canPatchBoxShadowInPlace(
  baseBoxShadow: unknown,
  nextBoxShadow: string,
): boolean {
  if (typeof baseBoxShadow !== "string") return false;
  const baseEffects = parseBoxShadowEffects(baseBoxShadow);
  const nextEffects = parseBoxShadowEffects(nextBoxShadow);
  return (
    baseEffects.length > 0 &&
    baseEffects.length === nextEffects.length &&
    baseEffects.every(
      (effect, index) => effect.inner === nextEffects[index]?.inner,
    )
  );
}

export interface StylePresentationActions {
  isBorderColorPresentationOwned: () => boolean;
  previewBorderColorPresentation: (color: string) => boolean;
  commitBorderColorPresentation: (color: string) => boolean;
  cancelBorderColorPresentation: (
    reason: EditorPresentationCancelReason,
  ) => boolean;
  isBoxShadowPresentationOwned: () => boolean;
  previewBoxShadowPresentation: (boxShadow: string) => boolean;
  commitBoxShadowPresentation: (boxShadow: string) => boolean;
  cancelBoxShadowPresentation: (
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
  const shadowPresentationRef = useRef<{
    baseStyle: Readonly<Record<string, unknown>>;
    handle: EditorPresentationHandle;
    phase: "active" | "cancelled" | "failed";
    selectedElementId: string;
    target: EditorPresentationTargetRef;
  } | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const shadowOwnerIdRef = useRef<string | null>(null);
  const ownerId =
    ownerIdRef.current ?? `style-border-color-owner-${nextStyleOwnerId++}`;
  ownerIdRef.current = ownerId;
  const shadowOwnerId =
    shadowOwnerIdRef.current ?? `style-box-shadow-owner-${nextStyleOwnerId++}`;
  shadowOwnerIdRef.current = shadowOwnerId;

  useEffect(() => {
    const unsubscribeSelection = useStore.subscribe(() => {
      const presentation = presentationRef.current;
      const { selectedElementId } = readImmediateSelectionSnapshot();
      if (
        presentation &&
        selectedElementId !== presentation.selectedElementId
      ) {
        presentation.handle.cancel("selection-change");
        presentation.phase = "cancelled";
      }
      const shadowPresentation = shadowPresentationRef.current;
      if (
        shadowPresentation &&
        selectedElementId !== shadowPresentation.selectedElementId
      ) {
        shadowPresentation.handle.cancel("selection-change");
        shadowPresentation.phase = "cancelled";
      }
    });
    const handleWindowBlur = (): void => {
      const presentation = presentationRef.current;
      if (presentation?.phase === "active") {
        presentation.handle.cancel("blur");
        presentation.phase = "cancelled";
      }
      const shadowPresentation = shadowPresentationRef.current;
      if (shadowPresentation?.phase === "active") {
        shadowPresentation.handle.cancel("blur");
        shadowPresentation.phase = "cancelled";
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      presentationRef.current?.handle.cancel("unmount");
      shadowPresentationRef.current?.handle.cancel("unmount");
      presentationRef.current = null;
      shadowPresentationRef.current = null;
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

  const isBoxShadowPresentationOwned = useCallback(
    () =>
      resolveBoxShadowPresentationPilotTarget(
        readImmediateSelectionSnapshot().selectedElementId,
      ) !== null,
    [],
  );

  const previewBoxShadowPresentation = useCallback(
    (boxShadow: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const existing = shadowPresentationRef.current;
      if (existing?.phase === "cancelled") {
        if (existing.selectedElementId !== selectedElementId) return true;
        shadowPresentationRef.current = null;
      }
      if (existing?.phase === "failed") {
        existing.handle.cancel("superseded");
        shadowPresentationRef.current = null;
      }

      let presentation = shadowPresentationRef.current;
      if (
        presentation &&
        presentation.selectedElementId !== selectedElementId
      ) {
        presentation.handle.cancel("selection-change");
        presentation = null;
        shadowPresentationRef.current = null;
      }
      if (!presentation) {
        const pilot =
          resolveBoxShadowPresentationPilotTarget(selectedElementId);
        if (!pilot || !selectedElementId) return false;
        if (!canPatchBoxShadowInPlace(pilot.style.boxShadow, boxShadow)) {
          return false;
        }
        presentation = {
          baseStyle: pilot.style,
          handle: editorPresentationFillPilotRuntime.beginEditorPresentation({
            commitIntent: "style-box-shadow",
            ownerId: shadowOwnerId,
            projectId: pilot.projectId,
            targets: [pilot.target],
          }),
          phase: "active",
          selectedElementId,
          target: pilot.target,
        };
        shadowPresentationRef.current = presentation;
      }

      if (
        !canPatchBoxShadowInPlace(presentation.baseStyle.boxShadow, boxShadow)
      ) {
        presentation.handle.cancel("superseded");
        shadowPresentationRef.current = null;
        return false;
      }

      const descriptor: EditorMutationDescriptor = {
        patch: { boxShadow },
        target: presentation.target,
        type: "style.patch",
      };
      if (!presentation.handle.publish(descriptor)) {
        presentation.phase = "cancelled";
      }
      return true;
    },
    [shadowOwnerId],
  );

  const commitBoxShadowPresentation = useCallback(
    (boxShadow: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const active = shadowPresentationRef.current;
      if (active?.phase === "cancelled") {
        shadowPresentationRef.current = null;
        return true;
      }
      if (!active && !previewBoxShadowPresentation(boxShadow)) return false;
      const presentation = shadowPresentationRef.current;
      if (
        !presentation ||
        presentation.selectedElementId !== selectedElementId
      ) {
        presentation?.handle.cancel("selection-change");
        shadowPresentationRef.current = null;
        return true;
      }
      if (
        !canPatchBoxShadowInPlace(presentation.baseStyle.boxShadow, boxShadow)
      ) {
        presentation.handle.cancel("superseded");
        shadowPresentationRef.current = null;
        return false;
      }
      const result = presentation.handle.finish({
        patch: { boxShadow },
        target: presentation.target,
        type: "style.patch",
      });
      if (result.status === "failed") presentation.phase = "failed";
      else shadowPresentationRef.current = null;
      return true;
    },
    [previewBoxShadowPresentation],
  );

  const cancelBoxShadowPresentation = useCallback(
    (reason: EditorPresentationCancelReason): boolean => {
      const presentation = shadowPresentationRef.current;
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
    cancelBoxShadowPresentation,
    commitBoxShadowPresentation,
    isBoxShadowPresentationOwned,
    previewBoxShadowPresentation,
  };
}
