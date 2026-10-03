import { useMemo, type ReactNode } from "react";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { StylesHostContext } from "../stylesHostContext";
import { createCatalogStylesHost } from "./catalogStylesHost";

/**
 * ADR-248 Phase 4e-4d: the Styles view over the catalog workspace — the shared sections with the
 * catalog Styles host (selection · breakpoint · typed field reads · one `setFields` step per edit).
 * ADR-252: the Design panel supplies it at its top (every tab, the header actions included).
 */
export function CatalogStylesHostProvider({
  children,
}: {
  children: ReactNode;
}) {
  const workspace = useCatalogWorkspace();
  const host = useMemo(() => createCatalogStylesHost(workspace), [workspace]);
  return (
    <StylesHostContext.Provider value={host}>
      {children}
    </StylesHostContext.Provider>
  );
}
