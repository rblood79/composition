/**
 * ADR-248 Phase 4e-7: the old store's preset selector (the catalog layout body uses `LayoutPresetGrid`) — goes with the old Builder.
 *
 * LayoutPresetSelector - 레이아웃 프리셋 선택 컴포넌트
 *
 * Phase 6: Layout 프리셋 시스템 메인 컴포넌트
 *
 * 기능:
 * 1. 카테고리별 프리셋 그리드 표시
 * 2. SVG 미리보기 썸네일
 * 3. 기존 Slot 감지 시 확인 다이얼로그
 * 4. 프리셋 적용 (History 단일 엔트리)
 */

import { memo } from "react";
import { usePresetApply } from "./usePresetApply";
import { useStore } from "../../../../stores";
import { LayoutPresetGrid } from "./index";

/**
 * ADR-248 4e-7: the old element store's part of `index.tsx` (moved out so the catalog Builder's
 * import graph does not reach the old store). Goes with the old store.
 */
interface LayoutPresetSelectorProps {
  /** Layout ID */
  layoutId: string;
  /** Body Element ID */
  bodyElementId: string;
}

export const LayoutPresetSelector = memo(function LayoutPresetSelector({
  layoutId,
  bodyElementId,
}: LayoutPresetSelectorProps) {
  // 썸네일 기준 breakpoint — 헤더의 캔버스 breakpoint 토글을 그대로 따른다 (ADR-168 P-7 정정).
  //
  // 패널 안에 별도 세그먼트를 뒀다가 제거했다: 헤더에 이미 같은 개념의 컨트롤이 있어 중복이고,
  // 두 컨트롤이 어긋나면 "썸네일은 mobile, 캔버스는 desktop" 같은 상태가 만들어진다.
  // 컨트롤은 하나, 의미도 하나다.
  const activeBreakpoint = useStore((s) => s.activeBreakpoint);
  const { existingSlots, currentPresetKey, applyPreset, isApplying } =
    usePresetApply({
      layoutId,
      bodyElementId,
    });
  return (
    <LayoutPresetGrid
      breakpoint={activeBreakpoint}
      existingSlots={existingSlots}
      currentPresetKey={currentPresetKey}
      applyPreset={applyPreset}
      isApplying={isApplying}
    />
  );
});
