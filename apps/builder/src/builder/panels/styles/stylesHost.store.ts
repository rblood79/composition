import { resolveContainerStylesFallback } from "../../workspace/canvas/layout/engines/implicitStyles";
import { useCanonicalPropertyElement } from "../properties/hooks/useCanonicalPropertyRead";
import {
  readImmediateSelectionSnapshot,
  useDebouncedSelectedElementData,
  useStore,
} from "../../stores";
import { useLayoutValue } from "./hooks/useLayoutValue";
import { storeAbsoluteActivationStyles } from "./sections/absoluteActivation";
import { useStoreResponsiveOverrides } from "./hooks/useResponsiveOverrides";
import {
  resetStoreStyles,
  useStoreDirtyStyleProps,
} from "./hooks/useResetStyles";
import {
  readStoreSelectedFills,
  resetStoreSelectedFills,
} from "./hooks/storeFills";
import {
  readResolvedStyleTarget,
  useCanonicalElementStyleContext,
} from "./hooks/useElementStyleContext";
import type { StylesHost } from "./stylesHostContext";
import { setStylesHostTestFallback } from "./stylesHost";

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

/**
 * ADR-248 4e-7: the old element store's StylesHost — no longer in the app (the catalog workspace
 * provides the host). Old-store tests import this module to run against it; it goes with the
 * old store.
 */
export const STORE_STYLES_HOST: StylesHost = {
  useSelectedId: () => useStore((state) => state.selectedElementId),
  readSelectedId: () => useStore.getState().selectedElementId ?? null,
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
      display: resolveParentContainerStyle(
        parentId,
        "display",
        "block",
        parent,
      ),
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
  // Late-bound: `useResetStyles` imports this module (its hooks dispatch through the host).
  useDirtyStyleProps: (properties) => useStoreDirtyStyleProps(properties),
  resetStyles: (properties) => resetStoreStyles(properties),
  useResponsiveOverrides: () => useStoreResponsiveOverrides(),
  setResponsiveOverride: (property, enabled, seedDefaults) =>
    useStore
      .getState()
      .setResponsiveStyleOverrideEnabled(property, enabled, seedDefaults),
  setResponsiveVisibility: (breakpoint, visible) =>
    useStore.getState().updateSelectedResponsiveVisibility(breakpoint, visible),
  useSelectedElement: () => useDebouncedSelectedElementData(),
  presentation: true,
};

setStylesHostTestFallback(STORE_STYLES_HOST);
