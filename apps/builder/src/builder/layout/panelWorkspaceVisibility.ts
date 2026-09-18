/**
 * workspace 패널 표시 보장 — ADR-212 UI-8 (편집 패널 생명주기 일반화).
 *
 * `datatableEditor` · `datatableField` 처럼 **다른 패널이 여는** 패널의 유일한 진입점.
 * 마운트된 PanelWorkspace 가 있으면 그 dispatcher (runtime → `activatePanelWorkspacePanelV4`)
 * 를 지나고, 없으면 (테스트 · 아직 마운트 전) 같은 정책 함수를 store layout 에 직접 적용한다.
 * 어느 쪽이든 visibility 를 손으로 뒤집지 않는다 — 스냅 (`snapTo`) · overflow 정책은 정책
 * 함수 하나가 가진다.
 */
import type { PanelId } from "../panels/core/types";
import { useStore } from "../stores";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import { dispatchPanelWorkspaceActivation } from "./panelWorkspaceActivationDispatcher";
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceRect,
} from "./panelWorkspaceLayoutV2";
import { activatePanelWorkspacePanelV4 } from "./panelWorkspacePolicyV4";

/**
 * Canvas 선택과 무관한 project/app 문맥 패널은 빈 공간 클릭에도 유지한다.
 * Workflow/Shortcut은 PanelId가 아닌 overlay이므로 이 경로의 대상이 아니다.
 */
const CANVAS_BACKGROUND_PERSISTENT_PANEL_IDS = new Set<PanelId>([
  "library",
  "datatable",
  "datatableEditor",
  "datatableField",
  "theme",
  "user",
  "settings",
]);

function currentPanelStageRect(): PanelWorkspaceRect | null {
  const stage = document.querySelector<HTMLElement>(".panel-dock-stage");
  if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) {
    return null;
  }
  return { width: stage.clientWidth, height: stage.clientHeight };
}

export function setPanelWorkspacePanelVisibility(
  panelId: PanelId,
  visible: boolean,
): void {
  const stageRect = currentPanelStageRect();
  const surfaceRect = stageRect ?? {
    width: window.innerWidth,
    height: Math.max(1, window.innerHeight - 48),
  };
  const registry = PanelRegistry.getAllPanels().map((config) =>
    createPanelWorkspaceRegistryEntry(config, surfaceRect),
  );
  if (registry.length === 0) return;
  let state = useStore.getState();
  if (!state.panelWorkspaceLayout) {
    if (!stageRect) return;
    state.initializePanelWorkspaceLayout(registry, stageRect);
    state = useStore.getState();
  }
  const { panelWorkspaceLayout, setPanelWorkspaceLayout } = state;
  if (
    !panelWorkspaceLayout ||
    (panelWorkspaceLayout.visibility[panelId] === true) === visible
  ) {
    return;
  }
  if (dispatchPanelWorkspaceActivation(panelId, visible)) return;
  // 폴백 — 정책 함수는 토글이라 위에서 상태가 다른 것을 확인한 뒤에만 부른다.
  const result = activatePanelWorkspacePanelV4(
    panelWorkspaceLayout,
    registry,
    panelId,
    surfaceRect,
  );
  if (result.ok) setPanelWorkspaceLayout(result.value.layout);
}

/**
 * Canvas page 밖 빈 공간은 element/page 선택 문맥을 끝낸다. 현재 보이는
 * 선택 문맥 패널만 기존 activation dispatcher로 닫아 rail toggle과 workspace를
 * 한 상태로 유지한다.
 */
export function dismissCanvasSelectionPanels(): void {
  const layout = useStore.getState().panelWorkspaceLayout;
  if (!layout) return;

  for (const [panelId, visible] of Object.entries(layout.visibility) as Array<
    [PanelId, boolean]
  >) {
    if (!visible || CANVAS_BACKGROUND_PERSISTENT_PANEL_IDS.has(panelId)) {
      continue;
    }
    setPanelWorkspacePanelVisibility(panelId, false);
  }
}
