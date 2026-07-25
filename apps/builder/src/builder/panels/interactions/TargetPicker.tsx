/**
 * ADR-158 Phase 2 — capability 구동 대상 요소 선택.
 *
 * 현재 페이지 요소 중 **capability 를 가진 것만** 노출한다. 공통 3종
 * (show/hide/toggle) 은 모든 시각 요소가 가지므로 사실상 전 요소가 후보지만,
 * G1 보류(deferred)로 고유 capability 가 없는 컴포넌트도 공통 3종은 구동 가능하다.
 */
import { memo, useMemo } from "react";
import { isCapabilityTarget } from "@composition/shared";

import { PropertySelect } from "../../components/property/PropertySelect";
import { useStore } from "../../stores";

interface TargetPickerProps {
  value: string;
  onChange: (targetId: string) => void;
  /** 자기 자신을 대상에서 제외 (자기 구동은 혼란 — 필요 시 해제) */
  excludeId?: string;
}

export const TargetPicker = memo(function TargetPicker({
  value,
  onChange,
  excludeId,
}: TargetPickerProps) {
  const currentPageId = useStore((state) => state.currentPageId);
  const getPageElements = useStore((state) => state.getPageElements);

  const options = useMemo(() => {
    if (!currentPageId) return [];
    return getPageElements(currentPageId)
      .filter((el) => el.id !== excludeId && isCapabilityTarget(el.type))
      .map((el) => ({
        value: el.id,
        label: el.customId
          ? `${el.type} #${el.customId}`
          : `${el.type} (${el.id.slice(0, 8)})`,
      }));
  }, [currentPageId, getPageElements, excludeId]);

  return (
    <PropertySelect
      label="대상"
      value={value}
      onChange={onChange}
      options={options}
    />
  );
});
