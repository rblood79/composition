import React from "react";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertyFieldsetProps {
  legend?: string;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  children: React.ReactNode;
  afterControl?: React.ReactNode;
  className?: string;
  /**
   * `legend` (기본, 필드 위 18 행 + 아이콘) / `suffix` — legend·아이콘 없이 라벨을 상자 안
   * 우측 suffix (10 mono caps) 로 둔다 (PropertyUnitInput 과 같은 어법, panel-ui 07).
   * 접근 이름은 fieldset `aria-label` 로 유지.
   */
  labelMode?: "legend" | "suffix";
  /** suffix 모드의 표시 글자 (기본 legend). 접근 이름은 언제나 legend. */
  suffixLabel?: string;
}

export function PropertyFieldset({
  legend,
  icon: Icon,
  children,
  afterControl,
  className = "",
  labelMode = "legend",
  suffixLabel,
}: PropertyFieldsetProps) {
  const i18n = useOptionalI18n();
  const displayLegend =
    legend && i18n
      ? translateKey(i18n.t, semanticLabelKeys[legend] ?? legend, legend)
      : legend;
  const suffix = labelMode === "suffix";
  return (
    <fieldset
      className={`properties-aria ${className}`}
      data-label-mode={suffix ? "suffix" : undefined}
      aria-label={suffix ? displayLegend : undefined}
    >
      {displayLegend && !suffix && (
        <legend className="fieldset-legend">{displayLegend}</legend>
      )}
      <div className="react-aria-control react-aria-Group">
        {Icon && !suffix && (
          <label className="control-label">
            <Icon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </label>
        )}
        {children}
        {suffix && displayLegend && (
          <span className="property-field__suffix" aria-hidden="true">
            {suffixLabel ?? displayLegend}
          </span>
        )}
      </div>
      {afterControl}
    </fieldset>
  );
}
