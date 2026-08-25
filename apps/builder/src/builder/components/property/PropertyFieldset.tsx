import React from "react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { translateDisplayLabel, useOptionalI18n } from "../../../i18n";

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
}

export function PropertyFieldset({
  legend,
  icon: Icon,
  children,
  afterControl,
  className = "",
}: PropertyFieldsetProps) {
  const i18n = useOptionalI18n();
  const displayLegend =
    legend && i18n ? translateDisplayLabel(i18n.t, legend) : legend;
  return (
    <fieldset className={`properties-aria ${className}`}>
      {displayLegend && (
        <legend className="fieldset-legend">{displayLegend}</legend>
      )}
      <div className="react-aria-control react-aria-Group">
        {Icon && (
          <label className="control-label">
            <Icon
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </label>
        )}
        {children}
      </div>
      {afterControl}
    </fieldset>
  );
}
