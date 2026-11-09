import { useContext } from "react";
import type { BreakpointName } from "@composition/shared";
import { StylesHostContext, type StylesHost } from "./stylesHostContext";

export {
  StylesHostContext,
  type StylesHost,
  type StylesTargetSnapshot,
} from "./stylesHostContext";

export function useStylesHost(): StylesHost {
  const host = useContext(StylesHostContext);
  if (!host) throw new Error("Styles host is not provided");
  return host;
}
const NO_SELECTION: Pick<StylesHost, "readSelectedId" | "useSelectedId"> = {
  readSelectedId: () => null,
  useSelectedId: () => null,
};

/**
 * The element-selection half of the Styles host, or none — a color field shared outside the Design
 * panel (Theme › custom accent, 2026-11-10) has no element to guard its commit against.
 */
export function useStylesSelection(): Pick<
  StylesHost,
  "readSelectedId" | "useSelectedId"
> {
  return useContext(StylesHostContext) ?? NO_SELECTION;
}

export function useStylesSelectedId(): string | null {
  return useStylesHost().useSelectedId();
}
export function useStylesActiveBreakpoint(): BreakpointName {
  return useStylesHost().useActiveBreakpoint();
}
