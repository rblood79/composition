import { useMemo } from "react";
import {
  CatalogWorkspaceGate,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { StylesPanel } from "../StylesPanel";
import { StylesHostContext } from "../stylesHostContext";
import { createCatalogStylesHost } from "./catalogStylesHost";
import { CatalogStyleClipboardShortcuts } from "./CatalogStyleClipboardShortcuts";

/**
 * ADR-248 Phase 4e-4d: the Styles panel over the catalog workspace — the shared panel and
 * sections, with the catalog Styles host (selection · breakpoint · typed field reads · one
 * `setFields` step per edit).
 */
export function CatalogStylesPanel() {
  return (
    <CatalogWorkspaceGate>
      <CatalogStylesContent />
    </CatalogWorkspaceGate>
  );
}

function CatalogStylesContent() {
  const workspace = useCatalogWorkspace();
  const host = useMemo(() => createCatalogStylesHost(workspace), [workspace]);
  return (
    <StylesHostContext.Provider value={host}>
      <CatalogStyleClipboardShortcuts />
      <StylesPanel />
    </StylesHostContext.Provider>
  );
}
