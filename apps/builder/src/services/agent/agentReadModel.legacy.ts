/**
 * ADR-248 4e-7: the old element store's precondition model (moved from `agentReadModel.ts`; goes with
 * the old store). precondition 읽기 모델 조립 — agent executor (ADR-196) 와 전체 메뉴 (ADR-249) 가
 * 같이 부른다. 메뉴가 agent 명령 표면 (`AGENT_COMMANDS` · executor) 을 끌어오지
 * 않게 조립만 따로 둔다.
 */
import { useStore } from "../../builder/stores";
import { historyManager } from "../../builder/stores/history";
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import { getSelectedGuide } from "../../builder/workspace/canvas/interaction/guideEmphasis";
import type { LegacyAgentReadModel } from "../../builder/config/commandMeta.legacy";

/** precondition 이 읽는 모델 — handler 가 읽는 것과 같은 store 들에서 조립. */
export function buildLegacyAgentReadModel(): LegacyAgentReadModel {
  const s = useStore.getState();
  const history = historyManager.getCurrentPageHistory();
  return {
    currentPageId: s.currentPageId,
    selectedElementId: s.selectedElementId,
    selectedElementIds: s.selectedElementIds,
    multiSelectMode: s.multiSelectMode,
    elementsMap: s.elementsMap,
    guideSelected: getSelectedGuide() !== null,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    viewport: { containerSize: useViewportSyncStore.getState().containerSize },
  };
}
