import { useContext } from "react";
import { ThemesHostContext, type ThemesHost } from "./themesHostContext";

/** Old-store tests only (`themesHost.store.ts`, removed with the old store): the host without a provider. */
let testFallback: ThemesHost | null = null;
export function setThemesHostTestFallback(host: ThemesHost | null): void {
  testFallback = host;
}

export function useThemesHost(): ThemesHost {
  const host = useContext(ThemesHostContext) ?? testFallback;
  if (!host) throw new Error("Themes host is not provided");
  return host;
}
