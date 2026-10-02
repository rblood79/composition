import { useMemo } from "react";
import type { ShortcutId } from "../config/keyboardShortcuts";
import { useActiveScope } from "../hooks/useActiveScope";
import { togglePanelWorkspace } from "../hooks/usePanelLayout";
import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
  type ShortcutHandlers,
} from "../hooks/useKeyboardShortcutsRegistry";
import type { PanelId } from "../panels/core/types";
import {
  CATALOG_ARRANGE_SHORTCUTS,
  runCatalogShortcut,
  type CatalogShortcutId,
} from "../catalogRuntime/shortcuts";
import type { CatalogWorkspace } from "../catalogRuntime/workspace";
import { useViewportSyncStore } from "../workspace/canvas/stores";
import { zoomViewportAtContainerCenter } from "../workspace/canvas/viewport/viewportActions";
import {
  fillCatalogPageFrame,
  fitCatalogPageFrame,
} from "../workspace/canvas/catalog/catalogViewport";
import { catalogPageAlignCommand } from "../catalogRuntime/canvasPage";
import type { ZoomControlsViewportActions } from "../workspace/ZoomControls";

/** The open page's frame (the first page when none is open). */
function openPageFrame(workspace: CatalogWorkspace) {
  const frames = workspace.root.pageFrameRects();
  const { pageId } = workspace.session.getSnapshot();
  return (pageId && frames.get(pageId)) || frames.values().next().value;
}

/**
 * The zoom menu's Fit / Fill (the open page's frame, like ⌘0) and Align pages (one step) over the
 * catalog workspace — the old menu fitted the old store's canvas size (1920×1080 at the origin here).
 */
export function catalogViewportActions(
  workspace: CatalogWorkspace,
  onError: (error: unknown) => void,
): ZoomControlsViewportActions {
  const containerSize = () => useViewportSyncStore.getState().containerSize;
  return {
    fit: () => {
      const frame = openPageFrame(workspace);
      if (frame) fitCatalogPageFrame(frame, containerSize());
    },
    fill: () => {
      const frame = openPageFrame(workspace);
      if (frame) fillCatalogPageFrame(frame, containerSize());
    },
    alignPages: () => {
      try {
        const command = catalogPageAlignCommand(workspace.root);
        if (command) workspace.execute(command);
      } catch (error) {
        onError(error);
      }
    },
  };
}

const ZOOM_STEP = 0.1;

const DOCUMENT_SHORTCUTS: readonly CatalogShortcutId[] = [
  "undo",
  "redo",
  "copy",
  "cut",
  "paste",
  "duplicate",
  "delete",
  "deleteAlt",
  "group",
  "ungroup",
  "bringToFront",
  "bringForward",
  "sendBackward",
  "sendToBack",
  "arrowUp",
  "arrowDown",
  "arrowLeft",
  "arrowRight",
  "arrowUpShift",
  "arrowDownShift",
  "arrowLeftShift",
  "arrowRightShift",
  "nextElement",
  "prevElement",
  "selectAll",
  "detachInstance",
  "toggleComponentOrigin",
  ...CATALOG_ARRANGE_SHORTCUTS,
];

/** The rail order ⌥1–⌥8 (+ ⌥9 AI, settings) — the old global shortcuts' panel ids. */
const PANEL_SHORTCUTS: Partial<Record<ShortcutId, PanelId>> = {
  toggleNavigator: "navigator",
  toggleComponents: "components",
  toggleDatatable: "datatable",
  toggleTheme: "theme",
  toggleProperties: "properties",
  toggleStyles: "styles",
  toggleEvents: "events",
  toggleHistory: "history",
  toggleAI: "ai",
  openSettings: "settings",
};

const zoomBy = (delta: number) =>
  zoomViewportAtContainerCenter(useViewportSyncStore.getState().zoom + delta);

/**
 * ADR-248 Phase 4e-5: the catalog Builder's global shortcuts (the old `useGlobalKeyboardShortcuts`
 * over the open workspace) — document shortcuts run the workspace's commands
 * (`runCatalogShortcut`), panel toggles and zoom are the existing workspace-layout / viewport
 * actions. Registered once with the definitions' keys and scopes (capture, document), so the
 * header menu runs the same handlers.
 */
export function useCatalogGlobalShortcuts(
  workspace: CatalogWorkspace | undefined,
  onError: (error: unknown) => void,
): void {
  const activeScope = useActiveScope();
  const shortcuts = useMemo(() => {
    const handlers: ShortcutHandlers = {
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomInNumpad: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(-ZOOM_STEP),
      zoom100: () => zoomViewportAtContainerCenter(1),
      zoom200: () => zoomViewportAtContainerCenter(2),
      zoomToFit: () => {
        if (workspace) catalogViewportActions(workspace, onError).fit();
      },
    };
    for (const [id, panelId] of Object.entries(PANEL_SHORTCUTS))
      handlers[id as ShortcutId] = () => togglePanelWorkspace(panelId!);
    if (workspace)
      for (const id of DOCUMENT_SHORTCUTS)
        handlers[id] = () => {
          runCatalogShortcut(workspace, id, onError);
        };
    const bound = bindHandlersToDefinitions(
      Object.keys(handlers) as ShortcutId[],
      handlers,
    );
    if (!workspace) return bound;
    // ⌘C / ⌘V with focus in the Properties panel copy and paste the selected elements (the old
    // panel's own registration — no definition: the canvas `copy` / `paste` keep their scope;
    // inside a text input the browser copies text, as the registry skips inputs).
    return [
      ...bound,
      ...(["copy", "paste"] as const).map((id) => ({
        key: id === "copy" ? "c" : "v",
        modifier: "cmd" as const,
        handler: () => {
          runCatalogShortcut(workspace, id, onError);
        },
        description: id === "copy" ? "Copy All Elements" : "Paste Elements",
        scope: "panel:properties" as const,
      })),
    ];
  }, [workspace, onError]);
  useKeyboardShortcutsRegistry(shortcuts, [shortcuts, activeScope], {
    capture: true,
    target: "document",
    activeScope,
  });
}
