/**
 * ADR-158 Phase 2 — When 축 선택.
 *
 * 선택 요소 type 의 `CAPABILITY_REGISTRY[type].events` 만 노출한다. 구 EventsPanel
 * 이 섞어 쓰던 DOM 별칭(onClick/onMouseEnter/onKeyDown …)은 어휘에서 은퇴했다.
 */
import { memo } from "react";
import { resolveTriggers } from "@composition/shared";

import { PropertySelect } from "../../components/property/PropertySelect";
import { triggerLabel } from "./labels";
import { useI18n } from "@/i18n";

interface TriggerPickerProps {
  componentType: string;
  value: string;
  onChange: (trigger: string) => void;
}

export const TriggerPicker = memo(function TriggerPicker({
  componentType,
  value,
  onChange,
}: TriggerPickerProps) {
  const triggers = resolveTriggers(componentType);

  const { t } = useI18n();
  const options = triggers.map((trigger) => ({
    value: trigger,
    label: triggerLabel(trigger, t),
  }));

  return (
    <PropertySelect
      label="When"
      value={value}
      onChange={onChange}
      options={options}
    />
  );
});
