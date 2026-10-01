/**
 * ADR-248 Phase 4e-7: the old store's Slots section (the catalog layout body uses `LayoutSlotsList`) — goes with the old Builder.
 *
 * LayoutSlotsSection — Layout 편집 (layout 모드) Properties 의 "Slots" 절.
 *
 * preset 을 적용한 결과가 보이는 자리다: 슬롯 행 28 (이름 · 놓인 요소 수 mono 10). 행을 누르면
 * 그 Slot 요소를 캔버스에서 선택한다. `element.slot: string[]` 에는 이름만 있고 크기 데이터가
 * 없으므로 (preset areas 는 정의 파일에만) 여기서도 이름 · 수만 보여준다 (panel-ui 18, 2026-09-14).
 */

import { memo, useCallback } from "react";
import { useStore } from "../../../../stores";
import { useExistingFrameSlots } from "./usePresetApply";
import { LayoutSlotsList } from "./LayoutSlotsSection";

/**
 * ADR-248 4e-7: the old element store's part of `LayoutSlotsSection.tsx` (moved out so the catalog Builder's
 * import graph does not reach the old store). Goes with the old store.
 */
interface LayoutSlotsSectionProps {
  readonly layoutId: string;
}

export const LayoutSlotsSection = memo(function LayoutSlotsSection({
  layoutId,
}: LayoutSlotsSectionProps) {
  const slots = useExistingFrameSlots(layoutId);

  const handleSelect = useCallback((elementId: string) => {
    const state = useStore.getState();
    const element = state.elementsMap.get(elementId);
    state.setSelectedElement(elementId, element?.props);
  }, []);

  return <LayoutSlotsList slots={slots} onSelect={handleSelect} />;
});
