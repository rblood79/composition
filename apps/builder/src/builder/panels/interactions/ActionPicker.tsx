/**
 * ADR-158 Phase 2 — Do 축 최상위 선택.
 *
 * 앱 액션 2종(navigate / toast) + "컴포넌트 기능…" 진입 3개뿐이다. 구
 * `IMPLEMENTED_ACTION_TYPES` 47종은 은퇴했다.
 */
import { memo } from "react";

import { PropertySelect } from "../../components/property/PropertySelect";
import { ACTION_CHOICE_LABEL_KEYS } from "./labels";
import type { ActionChoice } from "./types";
import { useI18n } from "@/i18n";

const CHOICES = Object.keys(ACTION_CHOICE_LABEL_KEYS) as ActionChoice[];

interface ActionPickerProps {
  value: ActionChoice;
  onChange: (choice: ActionChoice) => void;
  /** 고를 수 있는 갈래 (기본 전부) — 가리킬 대상이 없는 갈래를 뺄 때 */
  choices?: readonly ActionChoice[];
}

export const ActionPicker = memo(function ActionPicker({
  value,
  onChange,
  choices = CHOICES,
}: ActionPickerProps) {
  const { t } = useI18n();
  const options = choices.map((choice) => ({
    value: choice,
    label: t(ACTION_CHOICE_LABEL_KEYS[choice]),
  }));
  return (
    <PropertySelect
      label="Do"
      value={value}
      onChange={(v) => onChange(v as ActionChoice)}
      options={options}
    />
  );
});
