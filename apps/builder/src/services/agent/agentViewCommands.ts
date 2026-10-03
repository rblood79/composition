import { useBuilderUiStore } from "../../builder/stores/builderUiStore";
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import {
  applyViewportState,
  computeFitViewport,
  zoomViewportAtContainerCenter,
} from "../../builder/workspace/canvas/viewport/viewportActions";
import { togglePanelWorkspace } from "../../builder/hooks/usePanelLayout";
import { useSectionCollapse } from "../../builder/panels/styles/hooks/useSectionCollapse";
import { resolveCommand } from "../../builder/stores/commandRegistry";
import type { ShortcutId } from "../../builder/config/keyboardShortcuts";
import type { PanelId } from "../../builder/panels/core/types";

/**
 * ADR-196 agent view commands — zoom, panels, rulers, focus mode: the chrome, not the document.
 * Document · selection commands are the open Builder's host (`agentCommandHost`, ADR-248 4e-5);
 * the old store's adapters for them are `agentCommands.ts` (goes with the old store).
 */
export type AgentViewCommand = () => Promise<void> | void;

/** `useGlobalKeyboardShortcuts.ts` 의 `ZOOM_STEP` 과 같아야 한다 (정적 대조). */
const AGENT_ZOOM_STEP = 0.1;

const zoomBy = (delta: number) => () => {
  const { zoom } = useViewportSyncStore.getState();
  zoomViewportAtContainerCenter(zoom + delta);
};
const zoomTo = (target: number) => () => zoomViewportAtContainerCenter(target);
const panel = (panelId: PanelId) => () => togglePanelWorkspace(panelId);

export const AGENT_VIEW_COMMANDS: Readonly<
  Partial<Record<ShortcutId, AgentViewCommand>>
> = {
  // navigation — viewportSync 경로
  zoomIn: zoomBy(AGENT_ZOOM_STEP),
  zoomOut: zoomBy(-AGENT_ZOOM_STEP),
  zoomToFit: () => {
    const { containerSize, canvasSize } = useViewportSyncStore.getState();
    if (containerSize.width === 0 || containerSize.height === 0) return;
    applyViewportState(computeFitViewport({ canvasSize, containerSize }));
  },
  zoom100: zoomTo(1),
  zoom200: zoomTo(2),

  // panels
  toggleNavigator: panel("navigator"),
  toggleComponents: panel("components"),
  toggleDatatable: panel("datatable"),
  toggleTheme: panel("theme"),
  toggleProperties: panel("properties"),
  // ADR-252 — Design 을 Layout 탭으로: 열린 Builder 가 등록한 ⌥6 명령을 그대로 부른다
  // (`useCatalogGlobalShortcuts`). 직접 import 하면 lazy agent 와 initial 이 공유 chunk 를
  // 하나 더 만들어 initial 번들이 는다 (G4).
  toggleStyles: () => resolveCommand("toggleStyles")?.handler(),
  toggleEvents: panel("events"),
  toggleHistory: panel("history"),
  openSettings: panel("settings"),
  toggleRulers: () => {
    const { showRulers, setShowRulers } = useBuilderUiStore.getState();
    setShowRulers(!showRulers);
  },
  toggleFocusMode: () => {
    useSectionCollapse.getState().toggleFocusMode();
  },
};
