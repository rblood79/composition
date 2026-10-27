/**
 * ADR-158 Phase 2 · ADR-281 Decision 1 — 대상 요소가 "당할 수 있는" 기능 선택.
 *
 * `exposedCapabilities(targetType, 대상 선언값)` = 공통 3종 + 그 컴포넌트 고유 중 지금 RAC 가
 * 받는 것 (dispatcher 의 첫 검사 `declaredRefusal` 과 같은 판정). G1 보류 (`deferred`)
 * capability 는 registry 가 애초에 내주지 않는다. 규칙이 쓰는 이름은 늘 남는다.
 * `selectionMode: "none"` 이 선택 Do 를 숨기면 한 줄 안내를 둔다 (ADR-287 사용자 결정 3 — 모양은
 * 같은 행의 대상 안내 `interactions-target-notice`).
 */
import { memo, useMemo } from "react";
import {
  exposedCapabilities,
  selectionDoHidden,
  type ExposureInput,
} from "@composition/shared";

import { PropertySelect } from "../../components/property/PropertySelect";
import { useI18n } from "@/i18n";
import { capabilityLabel } from "./labels";

interface CapabilityPickerProps {
  targetType: string;
  value: string;
  exposure: ExposureInput;
  onChange: (capability: string) => void;
}

export const CapabilityPicker = memo(function CapabilityPicker({
  targetType,
  value,
  exposure,
  onChange,
}: CapabilityPickerProps) {
  const { t } = useI18n();
  const { options, selectionOff } = useMemo(() => {
    const caps = exposedCapabilities(targetType, exposure, value);
    return {
      options: Object.entries(caps).map(([key, def]) => ({
        value: key,
        label: capabilityLabel(def, t),
      })),
      selectionOff: selectionDoHidden(targetType, exposure),
    };
  }, [exposure, targetType, t, value]);

  return (
    <>
      <PropertySelect
        label={t("interactions.capability")}
        value={value}
        onChange={onChange}
        options={options}
      />
      {selectionOff && (
        <div className="interactions-target-notice" role="status">
          {t("interactions.selectionModeOff")}
        </div>
      )}
    </>
  );
});
