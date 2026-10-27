import { useContext } from "react";
import { ThemesHostContext, type ThemesHost } from "./themesHostContext";

export function useThemesHost(): ThemesHost {
  const host = useContext(ThemesHostContext);
  if (!host) throw new Error("Themes host is not provided");
  return host;
}
