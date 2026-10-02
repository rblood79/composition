import { useSyncExternalStore } from "react";
import {
  getPagePositionPresentationSnapshot,
  subscribePagePositionPresentation,
} from "../../workspace/canvas/interaction/pagePositionPresentation";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { getNodeMap } from "../../stores/canonical/canonicalTraversalHelpers";
import { readCanonicalNodeFillPayload } from "../../../adapters/canonical/canonicalFillPayload";
import { resolveSubpartStyleOwnerTypeById } from "../../stores/canonical/subpartOwnerLookup";
import type { FillItem } from "../../../types/builder/fill.types";
import {
  commitPagePlacementFromPoint,
  isPagePlacementEditable,
} from "../../stores/utils/pagePlacementCommit";
import {
  editorPresentationFillPilotRuntime,
  resolveFillPresentationPilotTarget,
} from "../../presentation/editorPresentationFillPilot";
import {
  resolveBorderColorPresentationPilotTarget,
  resolveBoxShadowPresentationPilotTarget,
  resolveOpacityPresentationPilotTarget,
  resolveTextColorPresentationPilotTarget,
} from "../../presentation/editorPresentationStylePilot";
import { resolveLayoutPresentationPilotTarget } from "../../presentation/editorPresentationLayoutPilot";
import { resolveTextMetricPresentationPilotTarget } from "../../presentation/editorPresentationTextMetrics";
import { resolveContainerStylesFallback } from "../../workspace/canvas/layout/engines/implicitStyles";
import { useCanonicalPropertyElement } from "../properties/hooks/useCanonicalPropertyRead";
import {
  readImmediateSelectionSnapshot,
  useDebouncedSelectedElementData,
  useStore,
} from "../../stores";
import { useLayoutValue } from "./hooks/useLayoutValue";
import { storeAbsoluteActivationStyles } from "./sections/absoluteActivation";
import { useStoreResponsiveOverrides } from "./hooks/useResponsiveOverrides.legacy";
import {
  resetStoreStyles,
  useStoreDirtyStyleProps,
} from "./hooks/useResetStyles.legacy";
import {
  readStoreSelectedFills,
  resetStoreSelectedFills,
} from "./hooks/storeFills";
import {
  readResolvedStyleTarget,
  useCanonicalElementStyleContext,
} from "./hooks/useElementStyleContext.legacy";
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
let documentColorsRevision = 0;

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
  // Old store (goes with it in ADR-248 4e-9): two writes.
  updatePropertiesWithStyles: (props, styles) => {
    useStore.getState().updateSelectedProperties(props);
    useStore.getState().updateSelectedStyles(styles);
  },
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
  // The Document palette over the old store's elements (canonical nodes when a document is open).
  documentColors: {
    subscribe(listener) {
      let last = useStore.getState().elements;
      return useStore.subscribe((state) => {
        if (state.elements === last) return;
        last = state.elements;
        documentColorsRevision += 1;
        listener();
      });
    },
    revision: () => documentColorsRevision,
    read() {
      if (getActiveCanonicalDocument())
        return Array.from(getNodeMap().values()).map((node) => ({
          style: (node.props as { style?: Record<string, unknown> } | undefined)
            ?.style,
          fills: readCanonicalNodeFillPayload(node) as FillItem[] | undefined,
        }));
      return useStore.getState().elements.map((element) => ({
        style: element.props?.style as Record<string, unknown> | undefined,
        fills: element.fills,
      }));
    },
  },
  subpartStyleOwnerOf: (id) =>
    resolveSubpartStyleOwnerTypeById(id, useStore.getState().elementsMap),
  pagePosition: {
    // ADR-177/232: the page body's canvas position (its page, not a stale one); Home stays put.
    usePosition(selectedId) {
      const element = useCanonicalPropertyElement(selectedId ?? "");
      const currentPageId = useStore((state) => state.currentPageId);
      const pageId = element?.page_id ?? null;
      const position = useStore((state) =>
        pageId ? state.derivedPagePositions[pageId] : undefined,
      );
      // A page drag's transient position (ADR-176/178), rounded so only shown changes render.
      const liveKey = useSyncExternalStore(
        subscribePagePositionPresentation,
        () => {
          const snap = getPagePositionPresentationSnapshot();
          const override =
            pageId && snap.isActive
              ? snap.activeOverrides?.get(pageId)
              : undefined;
          return override
            ? `${Math.round(override.x)}:${Math.round(override.y)}`
            : null;
        },
      );
      if (!pageId || !position) return null;
      if (currentPageId != null && pageId !== currentPageId) return null;
      const live = liveKey?.split(":").map(Number);
      return {
        pageId,
        x: live ? live[0] : position.x,
        y: live ? live[1] : position.y,
        editable: isPagePlacementEditable(pageId),
      };
    },
    commit: (pageId, point) => commitPagePlacementFromPoint(pageId, point),
  },
  presentation: {
    readSelectedElementId: () =>
      readImmediateSelectionSnapshot().selectedElementId,
    subscribeSelection: (listener) => useStore.subscribe(listener),
    runtime: editorPresentationFillPilotRuntime,
    resolveFillTarget: resolveFillPresentationPilotTarget,
    resolveBorderColorTarget: resolveBorderColorPresentationPilotTarget,
    resolveBoxShadowTarget: resolveBoxShadowPresentationPilotTarget,
    resolveOpacityTarget: resolveOpacityPresentationPilotTarget,
    resolveTextColorTarget: resolveTextColorPresentationPilotTarget,
    resolveLayoutTarget: resolveLayoutPresentationPilotTarget,
    resolveTextMetricTarget: resolveTextMetricPresentationPilotTarget,
  },
};

setStylesHostTestFallback(STORE_STYLES_HOST);
