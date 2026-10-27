/**
 * ADR-158 Phase 2 · ADR-281 Decision 1 — When 축 선택.
 *
 * 등록표의 그룹 (개념 = RAC 문서 절) 으로 묶어 보이되 지금 RAC 가 받는 것만 —
 * 선언값이 막는 그룹 (`isDisabled` · `isReadOnly` · `selectionMode: "none"` …) 은 빠진다
 * (`exposedTriggerGroups`). 숨은 이벤트 (S2 가 뺀 press 보조 · hover · focus) 는
 * 「이벤트 더 보기」 로 열고, keyboard 는 열지 않는다 (사용자 결정 Q3). 규칙이 쓰는 이름은
 * 늘 남는다 — 숨김이 규칙을 지우지 않는다.
 */
import { memo, useMemo, useState } from "react";
import {
  exposedTriggerGroups,
  isHiddenTrigger,
  type ExposureInput,
} from "@composition/shared";

import { PropertySelect } from "../../components/property/PropertySelect";
import { PropertySwitch } from "../../components/property/PropertySwitch";
import { triggerGroupLabel, triggerLabel } from "./labels";
import { useI18n } from "@/i18n";

interface TriggerPickerProps {
  componentType: string;
  value: string;
  exposure: ExposureInput;
  onChange: (trigger: string) => void;
}

export const TriggerPicker = memo(function TriggerPicker({
  componentType,
  value,
  exposure,
  onChange,
}: TriggerPickerProps) {
  const { t } = useI18n();
  // 토글은 저장하지 않는다 — 규칙이 숨은 이벤트를 쓰면 늘 열림.
  const [showAll, setShowAll] = useState(false);
  const showHidden = showAll || isHiddenTrigger(componentType, value);
  const { options, sections } = useMemo(() => {
    const groups = exposedTriggerGroups(componentType, exposure, {
      showHidden,
      used: value,
    });
    return {
      options: groups.flatMap((group) =>
        group.events.map((trigger) => ({
          value: trigger,
          label: triggerLabel(componentType, trigger, t),
        })),
      ),
      sections: groups.map((group) => ({
        label: triggerGroupLabel(group.id, t),
        values: group.events,
      })),
    };
  }, [componentType, exposure, showHidden, t, value]);

  return (
    <>
      <PropertySelect
        label="When"
        value={value}
        onChange={onChange}
        options={options}
        sections={sections}
        translateOptions={false}
      />
      <PropertySwitch
        label={t("interactions.showMoreEvents")}
        isSelected={showHidden}
        onChange={setShowAll}
      />
    </>
  );
});
