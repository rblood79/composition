import { memo } from "react";

import { useLatestCallbacks } from "./latestCallbacks";

import { Switch as AriaSwitch } from "react-aria-components/Switch";

import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

import { PropertyFieldset } from "./PropertyFieldset";
import { PropertySwitchProps } from "./PropertySwitch.runtime";

export const PropertySwitchControl = memo(
  function PropertySwitch({
    label,
    isSelected,
    onChange,
    icon,
    className,
    labelMode = "legend",
  }: PropertySwitchProps) {
    const i18n = useOptionalI18n();
    const displayLabel = i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
    // 라벨은 legend 한 번 — 종전엔 Switch 안에 같은 글자가 한 번 더 있었다 (panel-ui 20,
    //   2026-09-14). 접근 이름은 aria-label 로 유지한다 (getByLabelText 그대로).
    if (labelMode === "inline") {
      return (
        <fieldset
          className={`properties-aria property-switch-row ${className ?? ""}`}
          data-label-mode="inline"
          aria-label={displayLabel}
        >
          <span className="property-switch-row__label">{displayLabel}</span>
          <AriaSwitch
            className="react-aria-Switch"
            isSelected={isSelected}
            onChange={(val) => onChange(val)}
            aria-label={displayLabel}
          >
            <div className="indicator" />
          </AriaSwitch>
        </fieldset>
      );
    }
    return (
      <PropertyFieldset legend={label} icon={icon} className={className}>
        <AriaSwitch
          className={"react-aria-Switch"}
          isSelected={isSelected}
          onChange={(val) => onChange(val)}
          aria-label={displayLabel}
        >
          <div className="indicator" />
        </AriaSwitch>
      </PropertyFieldset>
    );
  },
  (prevProps, nextProps) => {
    // ⭐ 커스텀 비교: onChange 함수 참조는 무시하고 실제 값만 비교
    // onChange는 매번 새로 생성될 수 있지만, isSelected가 같으면 리렌더링 스킵
    return (
      prevProps.label === nextProps.label &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.icon === nextProps.icon &&
      prevProps.className === nextProps.className &&
      prevProps.labelMode === nextProps.labelMode
    );
  },
);
const CALLBACK_KEYS: readonly (keyof PropertySwitchProps)[] = ["onChange"];
export function PropertySwitch(props: PropertySwitchProps) {
  const current = useLatestCallbacks(props, CALLBACK_KEYS);
  return <PropertySwitchControl {...current} />;
}
