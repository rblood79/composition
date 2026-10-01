import { useContext } from "react";
import type { BreakpointName } from "@composition/shared";
import { StylesHostContext, type StylesHost } from "./stylesHostContext";

export {
  StylesHostContext,
  type StylesHost,
  type StylesTargetSnapshot,
} from "./stylesHostContext";

/** Old-store tests only (`stylesHost.store.ts`, removed with the old store): the host without a provider. */
let testFallback: StylesHost | null = null;
export function setStylesHostTestFallback(host: StylesHost | null): void {
  testFallback = host;
}

export function useStylesHost(): StylesHost {
  const host = useContext(StylesHostContext) ?? testFallback;
  if (!host) throw new Error("Styles host is not provided");
  return host;
}
export function useStylesSelectedId(): string | null {
  return useStylesHost().useSelectedId();
}
export function useStylesActiveBreakpoint(): BreakpointName {
  return useStylesHost().useActiveBreakpoint();
}
