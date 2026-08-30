/**
 * ADR-158 Phase 2 — 대상 요소가 "당할 수 있는" 기능 선택.
 *
 * `resolveCapabilities(targetType)` = 공통 3종 + 그 컴포넌트 고유. G1 보류
 * (`deferred`) capability 는 registry 가 애초에 내주지 않으므로 여기 나타나지 않는다
 * — 미배선 기능이 사용자에게 노출될 경로가 원천 차단된다.
 */
import { memo, useMemo } from "react";
import { resolveCapabilities } from "@composition/shared";

import { PropertySelect } from "../../components/property/PropertySelect";
import { useI18n } from "@/i18n";

interface CapabilityPickerProps {
  targetType: string;
  value: string;
  onChange: (capability: string) => void;
}

export const CapabilityPicker = memo(function CapabilityPicker({
  targetType,
  value,
  onChange,
}: CapabilityPickerProps) {
  const { t } = useI18n();
  const options = useMemo(() => {
    const caps = resolveCapabilities(targetType);
    return Object.entries(caps).map(([key, def]) => ({
      value: key,
      // remount 기능은 내부 상태(포커스/스크롤)가 초기화된다 — 선택 전에 알린다
      label: def.remount
        ? t("interactions.capabilityRemount", { label: t(def.labelKey) })
        : t(def.labelKey),
    }));
  }, [targetType, t]);

  return (
    <PropertySelect
      label={t("interactions.capability")}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
});
