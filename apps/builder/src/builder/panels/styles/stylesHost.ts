import { useContext } from "react";
import type { BreakpointName } from "@composition/shared";
import { readImmediateSelectionSnapshot, useStore } from "../../stores";
import { resolveContainerStylesFallback } from "../../workspace/canvas/layout/engines/implicitStyles";
import { useCanonicalPropertyElement } from "../properties/hooks/useCanonicalPropertyRead";
import { useLayoutValue } from "./hooks/useLayoutValue";
import { storeAbsoluteActivationStyles } from "./sections/absoluteActivation";
import {
  readStoreSelectedFills,
  resetStoreSelectedFills,
} from "./hooks/storeFills";
import {
  readResolvedStyleTarget,
  useCanonicalElementStyleContext,
} from "./hooks/useElementStyleContext";
import { StylesHostContext, type StylesHost } from "./stylesHostContext";

export {
  StylesHostContext,
  type StylesHost,
  type StylesTargetSnapshot,
} from "./stylesHostContext";

/**
 * ADR-082 A1: a parent's `display` / `flexDirection` — its effective style, else its type's
 * container default (spec or catalog rule `containerStyles`), else the CSS default.
 */
function resolveParentContainerStyle(
  parentId: string | null,
  property: "display" | "flexDirection",
  fallback: string,
  parent: { type?: string; style?: Record<string, unknown> },
): string {
  if (!parentId) return fallback;
  const inline = parent.style?.[property];
  if (typeof inline === "string" && inline) return inline;
  if (parent.type) {
    const value = resolveContainerStylesFallback(parent.type.toLowerCase(), {})[
      property
    ];
    if (typeof value === "string") return value;
  }
  return fallback;
}

function useStoreParentId(id: string | null): string | null {
  return useCanonicalPropertyElement(id ?? "")?.parent_id ?? null;
}

export const STORE_STYLES_HOST: StylesHost = {
  useSelectedId: () => useStore((state) => state.selectedElementId),
  useActiveBreakpoint: () => useStore((state) => state.activeBreakpoint),
  useElementStyleContext: useCanonicalElementStyleContext,
  readSelectedTarget() {
    const { selectedElementId, elementsMap, activeBreakpoint } =
      useStore.getState();
    return {
      id: selectedElementId,
      ...readResolvedStyleTarget(
        selectedElementId,
        elementsMap,
        activeBreakpoint,
      ),
    };
  },
  updateStyle: (property, value) =>
    useStore.getState().updateSelectedStyle(property, value),
  updateStyles: (styles) => useStore.getState().updateSelectedStyles(styles),
  previewStyle: (property, value) =>
    useStore.getState().updateSelectedStylePreview(property, value),
  updateProperty: (key, value) =>
    useStore.getState().updateSelectedProperty(key, value),
  updateProperties: (props) =>
    useStore.getState().updateSelectedProperties(props),
  useParentId: useStoreParentId,
  useParentLayout(id) {
    const parentId = useStoreParentId(id);
    const parent = useCanonicalElementStyleContext(parentId);
    return {
      display: resolveParentContainerStyle(parentId, "display", "block", parent),
      flexDirection: resolveParentContainerStyle(
        parentId,
        "flexDirection",
        "row",
        parent,
      ),
    };
  },
  useLayoutValue,
  applySizing(selectedId, edit) {
    const snapshot = readImmediateSelectionSnapshot();
    if (snapshot.selectedElementId !== selectedId) return;
    useStore.getState().applySizingFromSelection(snapshot, edit);
  },
  applyRatio(selectedId, value) {
    const snapshot = readImmediateSelectionSnapshot();
    if (snapshot.selectedElementId !== selectedId) return null;
    return useStore.getState().applyRatioFromSelection(snapshot, value);
  },
  applyAbsolute(selectedId, on) {
    if (!on) {
      useStore.getState().updateSelectedStyle("position", "");
      return null;
    }
    const snapshot = readImmediateSelectionSnapshot();
    if (snapshot.selectedElementId !== selectedId) return null;
    return useStore
      .getState()
      .applyAbsoluteFromSelection(snapshot, storeAbsoluteActivationStyles);
  },
  readFills: readStoreSelectedFills,
  updateFills: (fills) => useStore.getState().updateSelectedFills(fills),
  resetFills: resetStoreSelectedFills,
  presentation: true,
};

export function useStylesHost(): StylesHost {
  return useContext(StylesHostContext) ?? STORE_STYLES_HOST;
}
export function useStylesSelectedId(): string | null {
  return useStylesHost().useSelectedId();
}
export function useStylesActiveBreakpoint(): BreakpointName {
  return useStylesHost().useActiveBreakpoint();
}
