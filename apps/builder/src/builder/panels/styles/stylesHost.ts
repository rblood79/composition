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
export function useStylesSelectedId(): string | null {
  return useStylesHost().useSelectedId();
}
export function useStylesActiveBreakpoint(): BreakpointName {
  return useStylesHost().useActiveBreakpoint();
}
