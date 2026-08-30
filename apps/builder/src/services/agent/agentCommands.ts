/**
 * AGENT_COMMANDS — allowlist 명령의 store-level adapter (ADR-196 Phase 1).
 *
 * registry 의 handler (등록 hook 의 effect 클로저 — 마운트 상태·DOM 포커스·패널 로컬
 * state 에 결합) 를 부르지 않는다. 대신 **handler 가 부르는 바로 그 심볼** 을 같은
 * 인자로 부른다 — Phase 0 표 "handler → 호출 심볼 + 부가 동작" (breakdown §2) 이
 * 정본이고 `agentCommands.test.ts` 가 import 심볼과 호출 인자를 대조한다.
 *
 * - 키보드·팔레트 경로는 한 줄도 바뀌지 않는다 (195 HC1 승계).
 * - 다른 store 의 같은 이름 함수 금지 — 줌은 `zoomViewportAtContainerCenter`
 *   (viewportSync), `canvasStore.setZoom` 은 별도 store (split-brain).
 * - 값 export 는 `AGENT_COMMANDS` 하나 — 개별 adapter 는 executor (Phase 2) 의
 *   allowlist → precondition → confirm 게이트 밖에서 부를 수 없다 (정적 게이트 조항 5).
 * - `paste` 는 `pasteHistory: "batch"` — 캔버스 ⌘V 경로는 요소마다 entry 를 남기지만
 *   (Phase 0 실측 N entry) agent 호출 1건은 history 1 entry 여야 한다 (HC5).
 */
import { useStore } from "../../builder/stores";
import { runComponentSemanticsAction } from "../../builder/utils/componentSemanticsRunner";
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import {
  applyViewportState,
  computeFitViewport,
  zoomViewportAtContainerCenter,
} from "../../builder/workspace/canvas/viewport/viewportActions";
import {
  alignSelection,
  copySelection,
  cutSelection,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  paste,
  ungroupSelection,
  type CanvasActionElement,
} from "../../builder/workspace/canvas/actions/canvasActions";
import {
  clearGuideSelection,
  getSelectedGuide,
} from "../../builder/workspace/canvas/interaction/guideEmphasis";
import { deletePageGuide } from "../../builder/workspace/canvas/viewport/pageGuideActions";
import { togglePanelWorkspace } from "../../builder/hooks/usePanelLayout";
import { useSectionCollapse } from "../../builder/panels/styles/hooks/useSectionCollapse";
import { canDetachInstance } from "../../builder/utils/editingSemantics";
import type { ShortcutId } from "../../builder/config/keyboardShortcuts";
import type { PanelId } from "../../builder/panels/core/types";
import type { SiblingEdge } from "../../builder/stores/utils/siblingReorder";

/** `useGlobalKeyboardShortcuts.ts` 의 `ZOOM_STEP` 과 같아야 한다 (정적 대조). */
const AGENT_ZOOM_STEP = 0.1;

export interface AgentCommandInput {
  /** handler 의 `useStore.getState().elementsMap` — executor 가 조립 */
  elementsMap: ReadonlyMap<string, CanvasActionElement>;
  /** 클립보드 — 미지정 시 `canvasActions` 기본 (navigator.clipboard) */
  clipboard?: {
    read: () => Promise<string | null>;
    write: (text: string) => Promise<boolean>;
  };
}

export type AgentCommandAdapter = (
  input: AgentCommandInput,
) => Promise<void> | void;

// ---------- 조각 ----------

const zoomBy = (delta: number) => () => {
  const { zoom } = useViewportSyncStore.getState();
  zoomViewportAtContainerCenter(zoom + delta);
};
const zoomTo = (target: number) => () => zoomViewportAtContainerCenter(target);
const panel = (panelId: PanelId) => () => togglePanelWorkspace(panelId);
const ctx = (input: AgentCommandInput) => ({ elementsMap: input.elementsMap });

/** 등록 hook 의 단일 선택 판정 (`handleReorderSibling` / `handleMoveToSiblingEdge`) */
function singleSelectionTarget(): string | null {
  const { selectedElementIds, selectedElementId } = useStore.getState();
  if (selectedElementIds.length > 1) return null;
  return selectedElementId ?? selectedElementIds[0] ?? null;
}
const siblingEdge = (edge: SiblingEdge) => () => {
  const targetId = singleSelectionTarget();
  if (!targetId) return;
  useStore.getState().moveElementToSiblingEdge(targetId, edge);
};
const siblingStep = (direction: -1 | 1) => () => {
  const targetId = singleSelectionTarget();
  if (!targetId) return;
  useStore.getState().reorderElementWithinParent(targetId, direction);
};

// ---------- allowlist 40 ----------

export const AGENT_COMMANDS: Readonly<
  Partial<Record<ShortcutId, AgentCommandAdapter>>
> = {
  // system
  undo: async () => {
    await useStore.getState().undo();
  },
  redo: async () => {
    await useStore.getState().redo();
  },

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
  toggleStyles: panel("styles"),
  toggleEvents: panel("events"),
  toggleHistory: panel("history"),
  openSettings: panel("settings"),
  toggleRulers: () => {
    const { showRulers, setShowRulers } = useStore.getState();
    setShowRulers(!showRulers);
  },
  toggleFocusMode: () => {
    useSectionCollapse.getState().toggleFocusMode();
  },

  // clipboard — `handleCanvasCopy/Cut/Paste` 와 같은 컨텍스트
  copy: async (input) => {
    await copySelection({
      elementsMap: input.elementsMap,
      writeClipboardText: input.clipboard?.write,
      requireCurrentPageForCopy: true,
    });
  },
  paste: async (input) => {
    await paste({
      elementsMap: input.elementsMap,
      readClipboardText: input.clipboard?.read,
      pasteHistory: "batch",
    });
  },
  cut: async (input) => {
    await cutSelection({
      elementsMap: input.elementsMap,
      writeClipboardText: input.clipboard?.write,
      requireCurrentPageForCopy: true,
    });
  },

  // delete — `handleCanvasDelete`: 가이드 선택 (ADR-181) 이 요소 선택보다 앞선다
  delete: async (input) => {
    const selectedGuide = getSelectedGuide();
    if (selectedGuide !== null) {
      clearGuideSelection();
      deletePageGuide(
        selectedGuide.pageId,
        selectedGuide.guideId,
        useStore.getState().activeBreakpoint,
      );
      return;
    }
    await deleteSelection(ctx(input));
  },

  // instance
  toggleComponentOrigin: async () => {
    const { selectedElementId } = useStore.getState();
    if (!selectedElementId) return;
    await runComponentSemanticsAction("toggle-component-origin", {
      targetId: selectedElementId,
    });
  },
  detachInstance: async () => {
    const { elementsMap } = useStore.getState();
    const targetId = singleSelectionTarget();
    if (!targetId) return;
    const element = elementsMap.get(targetId);
    if (!canDetachInstance(element)) return;
    // 승인은 executor 의 confirm 게이트가 이미 물었다 (ADR-196) — 여기서 또
    // 물으면 같은 명령에 다이얼로그가 두 번 뜬다.
    await runComponentSemanticsAction("detach-instance", {
      targetId,
      element,
      confirm: "skip",
    });
  },

  // z-order — `[` `]` ⌘[ ⌘] (ADR-182)
  bringToFront: siblingEdge("front"),
  sendToBack: siblingEdge("back"),
  bringForward: siblingStep(1),
  sendBackward: siblingStep(-1),

  // selection
  selectAll: () => {
    const { currentPageId, getPageElements, setSelectedElements } =
      useStore.getState();
    if (!currentPageId) return;
    const pageElements = getPageElements(currentPageId);
    if (pageElements.length === 0) return;
    setSelectedElements(pageElements.map((el) => el.id));
  },

  // structure — `canvasActions` (컨텍스트 메뉴·단축키·액션 바와 같은 함수)
  duplicate: (input) => duplicateSelection(ctx(input)),
  group: (input) => groupSelection(ctx(input)),
  ungroup: (input) => ungroupSelection(ctx(input)),
  alignLeft: (input) => alignSelection(ctx(input), "left"),
  alignHCenter: (input) => alignSelection(ctx(input), "center"),
  alignRight: (input) => alignSelection(ctx(input), "right"),
  alignTop: (input) => alignSelection(ctx(input), "top"),
  alignVCenter: (input) => alignSelection(ctx(input), "middle"),
  alignBottom: (input) => alignSelection(ctx(input), "bottom"),
  distributeH: (input) => distributeSelection(ctx(input), "horizontal"),
  distributeV: (input) => distributeSelection(ctx(input), "vertical"),
};
