import { useCallback, useEffect, useRef } from "react";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import {
  resolveBorderColorPresentationPilotTarget,
  resolveBoxShadowPresentationPilotTarget,
  resolveTextColorPresentationPilotTarget,
} from "../../../presentation/editorPresentationStylePilot";
import {
  haveSameBoxShadowPresentationTopology,
  isBoxShadowPresentationValue,
  parseBoxShadowPresentation,
  serializeBoxShadowPresentation,
  type BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";
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
  const baseValue = parseBoxShadowPresentation(baseBoxShadow);
  const nextValue = parseBoxShadowPresentation(nextBoxShadow);
  return (
    baseValue !== null &&
    nextValue !== null &&
    haveSameBoxShadowPresentationTopology(baseValue, nextValue)
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
  previewBoxShadowModelPresentation: (
    value: BoxShadowPresentationValue,
  ) => boolean;
  commitBoxShadowModelPresentation: (
    value: BoxShadowPresentationValue,
  ) => boolean;
  isTextColorPresentationOwned: () => boolean;
  previewTextColorPresentation: (color: string) => boolean;
  commitTextColorPresentation: (color: string) => boolean;
  cancelTextColorPresentation: (
    reason: EditorPresentationCancelReason,
  ) => boolean;
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
    baseValue: BoxShadowPresentationValue;
    handle: EditorPresentationHandle;
    phase: "active" | "cancelled" | "failed";
    selectedElementId: string;
    target: EditorPresentationTargetRef;
  } | null>(null);
  const textColorPresentationRef = useRef<{
    baseStyle: Readonly<Record<string, unknown>>;
    handle: EditorPresentationHandle;
    phase: "active" | "cancelled" | "failed";
    selectedElementId: string;
    target: EditorPresentationTargetRef;
  } | null>(null);
  const ownerIdRef = useRef<string | null>(null);
  const shadowOwnerIdRef = useRef<string | null>(null);
  const textColorOwnerIdRef = useRef<string | null>(null);
  const ownerId =
    ownerIdRef.current ?? `style-border-color-owner-${nextStyleOwnerId++}`;
  ownerIdRef.current = ownerId;
  const shadowOwnerId =
    shadowOwnerIdRef.current ?? `style-box-shadow-owner-${nextStyleOwnerId++}`;
  shadowOwnerIdRef.current = shadowOwnerId;
  const textColorOwnerId =
    textColorOwnerIdRef.current ??
    `style-text-color-owner-${nextStyleOwnerId++}`;
  textColorOwnerIdRef.current = textColorOwnerId;

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
      const textColorPresentation = textColorPresentationRef.current;
      if (
        textColorPresentation &&
        selectedElementId !== textColorPresentation.selectedElementId
      ) {
        textColorPresentation.handle.cancel("selection-change");
        textColorPresentation.phase = "cancelled";
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
      const textColorPresentation = textColorPresentationRef.current;
      if (textColorPresentation?.phase === "active") {
        textColorPresentation.handle.cancel("blur");
        textColorPresentation.phase = "cancelled";
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      presentationRef.current?.handle.cancel("unmount");
      shadowPresentationRef.current?.handle.cancel("unmount");
      textColorPresentationRef.current?.handle.cancel("unmount");
      presentationRef.current = null;
      shadowPresentationRef.current = null;
      textColorPresentationRef.current = null;
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
        const baseBoxShadow = pilot.style.boxShadow;
        if (
          typeof baseBoxShadow !== "string" ||
          !canPatchBoxShadowInPlace(baseBoxShadow, boxShadow)
        ) {
          return false;
        }
        const baseValue = parseBoxShadowPresentation(baseBoxShadow);
        if (baseValue === null) return false;
        presentation = {
          baseStyle: pilot.style,
          baseValue,
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

  const previewBoxShadowModelPresentation = useCallback(
    (value: BoxShadowPresentationValue): boolean => {
      if (!isBoxShadowPresentationValue(value)) return false;
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
        const baseBoxShadow = pilot.style.boxShadow;
        if (typeof baseBoxShadow !== "string") return false;
        const baseValue = parseBoxShadowPresentation(baseBoxShadow);
        if (
          baseValue === null ||
          !haveSameBoxShadowPresentationTopology(baseValue, value)
        ) {
          return false;
        }
        presentation = {
          baseStyle: pilot.style,
          baseValue,
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
        !haveSameBoxShadowPresentationTopology(presentation.baseValue, value)
      ) {
        presentation.handle.cancel("superseded");
        shadowPresentationRef.current = null;
        return false;
      }

      const descriptor: EditorMutationDescriptor = {
        patch: { boxShadow: value },
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

  const commitBoxShadowModelPresentation = useCallback(
    (value: BoxShadowPresentationValue): boolean => {
      if (!isBoxShadowPresentationValue(value)) return false;
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const active = shadowPresentationRef.current;
      if (active?.phase === "cancelled") {
        shadowPresentationRef.current = null;
        return true;
      }
      if (!active && !previewBoxShadowModelPresentation(value)) return false;
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
        !haveSameBoxShadowPresentationTopology(presentation.baseValue, value)
      ) {
        presentation.handle.cancel("superseded");
        shadowPresentationRef.current = null;
        return false;
      }
      const result = presentation.handle.finish({
        patch: { boxShadow: serializeBoxShadowPresentation(value) },
        target: presentation.target,
        type: "style.patch",
      });
      if (result.status === "failed") presentation.phase = "failed";
      else shadowPresentationRef.current = null;
      return true;
    },
    [previewBoxShadowModelPresentation],
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

  const isTextColorPresentationOwned = useCallback(
    () =>
      resolveTextColorPresentationPilotTarget(
        readImmediateSelectionSnapshot().selectedElementId,
      ) !== null,
    [],
  );

  const previewTextColorPresentation = useCallback(
    (color: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const existing = textColorPresentationRef.current;
      if (existing?.phase === "cancelled") {
        if (existing.selectedElementId !== selectedElementId) return true;
        textColorPresentationRef.current = null;
      }
      if (existing?.phase === "failed") {
        existing.handle.cancel("superseded");
        textColorPresentationRef.current = null;
      }

      let presentation = textColorPresentationRef.current;
      if (
        presentation &&
        presentation.selectedElementId !== selectedElementId
      ) {
        presentation.handle.cancel("selection-change");
        presentation = null;
        textColorPresentationRef.current = null;
      }
      if (!presentation) {
        const pilot =
          resolveTextColorPresentationPilotTarget(selectedElementId);
        if (!pilot || !selectedElementId) return false;
        presentation = {
          baseStyle: pilot.style,
          handle: editorPresentationFillPilotRuntime.beginEditorPresentation({
            commitIntent: "style-text-color",
            ownerId: textColorOwnerId,
            projectId: pilot.projectId,
            targets: [pilot.target],
          }),
          phase: "active",
          selectedElementId,
          target: pilot.target,
        };
        textColorPresentationRef.current = presentation;
      }

      const descriptor: EditorMutationDescriptor = {
        patch: { color },
        target: presentation.target,
        type: "style.patch",
      };
      if (!presentation.handle.publish(descriptor)) {
        presentation.phase = "cancelled";
      }
      return true;
    },
    [textColorOwnerId],
  );

  const commitTextColorPresentation = useCallback(
    (color: string): boolean => {
      const { selectedElementId } = readImmediateSelectionSnapshot();
      const active = textColorPresentationRef.current;
      if (active?.phase === "cancelled") {
        textColorPresentationRef.current = null;
        return true;
      }
      if (!active && !previewTextColorPresentation(color)) return false;
      const presentation = textColorPresentationRef.current;
      if (
        !presentation ||
        presentation.selectedElementId !== selectedElementId
      ) {
        presentation?.handle.cancel("selection-change");
        textColorPresentationRef.current = null;
        return true;
      }
      const result = presentation.handle.finish({
        patch: { color },
        target: presentation.target,
        type: "style.patch",
      });
      if (result.status === "failed") presentation.phase = "failed";
      else textColorPresentationRef.current = null;
      return true;
    },
    [previewTextColorPresentation],
  );

  const cancelTextColorPresentation = useCallback(
    (reason: EditorPresentationCancelReason): boolean => {
      const presentation = textColorPresentationRef.current;
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
    commitBoxShadowModelPresentation,
    isBoxShadowPresentationOwned,
    previewBoxShadowPresentation,
    previewBoxShadowModelPresentation,
    cancelTextColorPresentation,
    commitTextColorPresentation,
    isTextColorPresentationOwned,
    previewTextColorPresentation,
  };
}
