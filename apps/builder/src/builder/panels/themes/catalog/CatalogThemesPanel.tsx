import { useMemo } from "react";
import {
  CatalogWorkspaceGate,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { ThemesPanel } from "../ThemesPanel";
import { ThemesHostContext } from "../themesHostContext";
import { createCatalogThemesHost } from "./catalogThemesHost";

/**
 * ADR-248 Phase 4e-4d-4: the Themes panel over the catalog workspace — the shared panel and
 * sections, with the catalog Themes host (project themes · one command per edit).
 */
export function CatalogThemesPanel() {
  return (
    <CatalogWorkspaceGate>
      <CatalogThemesContent />
    </CatalogWorkspaceGate>
  );
}

function CatalogThemesContent() {
  const workspace = useCatalogWorkspace();
  const host = useMemo(() => createCatalogThemesHost(workspace), [workspace]);
  return (
    <ThemesHostContext.Provider value={host}>
      <ThemesPanel />
    </ThemesHostContext.Provider>
  );
}
