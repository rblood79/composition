/**
 * 썸네일 breakpoint 전환 세그먼트 (ADR-168 P-7).
 *
 * 적용 **전에** 세 breakpoint 결과를 볼 수 있게 한다 — 프리셋을 고를 때 정작 궁금한 건
 * "이게 모바일에서 어떻게 되나" 인데, 그걸 보려고 캔버스 breakpoint 를 왕복하면 흐름이 끊긴다.
 *
 * 초기값은 캔버스의 활성 breakpoint 다. 이 컨트롤은 **미리보기 전용**이라 store 에 아무것도
 * 쓰지 않는다 — 캔버스를 바꾸지 않고 비교만 한다.
 *
 * 클래스는 `preset-breakpoint-*` 고유 이름을 쓴다. `tab-*` 예약 prefix 는 금지 —
 * 탭 UI 가 아니라 미리보기 전환 세그먼트다 (panel-structure.md §2).
 */

import { memo, useCallback } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { BREAKPOINT_ORDER, BREAKPOINTS } from "@composition/shared";
import type { BreakpointName } from "@composition/shared";
import { iconEditProps } from "../../../../../utils/ui/uiConstants";

const BP_ICON: Record<BreakpointName, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

interface BreakpointPreviewTabsProps {
  /** 현재 미리보기 breakpoint */
  value: BreakpointName;
  /** 전환 콜백 */
  onChange: (breakpoint: BreakpointName) => void;
}

export const BreakpointPreviewTabs = memo(function BreakpointPreviewTabs({
  value,
  onChange,
}: BreakpointPreviewTabsProps) {
  const handleSelectionChange = useCallback(
    (keys: Set<React.Key>) => {
      const next = Array.from(keys)[0];
      // 같은 항목 재클릭으로 빈 선택이 되면 무시한다 — 미리보기는 항상 하나여야 한다
      if (typeof next === "string" && next in BREAKPOINTS) {
        onChange(next as BreakpointName);
      }
    },
    [onChange],
  );

  return (
    <div className="preset-breakpoint-bar">
      <span className="preset-breakpoint-label">미리보기</span>
      <ToggleButtonGroup
        aria-label="썸네일 breakpoint"
        indicator
        className="preset-breakpoint-tabs"
        selectedKeys={new Set([value])}
        onSelectionChange={handleSelectionChange}
      >
        {BREAKPOINT_ORDER.map((name) => {
          const Icon = BP_ICON[name];
          return (
            <ToggleButton
              key={name}
              id={name}
              aria-label={BREAKPOINTS[name].label}
            >
              <Icon size={iconEditProps.size} />
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </div>
  );
});

export default BreakpointPreviewTabs;
