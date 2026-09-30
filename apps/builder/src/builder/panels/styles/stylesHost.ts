import { useContext } from "react";
import type { BreakpointName } from "@composition/shared";
import { useStore } from "../../stores";
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
