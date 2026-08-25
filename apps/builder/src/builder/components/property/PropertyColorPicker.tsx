/**
 * PropertyColorPicker Component
 * TailSwatch 기반 색상 선택 Property Component
 */

import { useState } from "react";
import { parseColor, type Color } from "react-aria-components";
import { MyColorSwatches } from "@composition/shared/components/TailSwatch";
import { Paintbrush } from "lucide-react";
import { iconEditProps } from "../../../utils/ui/uiConstants";
import { translateDisplayLabel, useOptionalI18n } from "../../../i18n";

export interface PropertyColorPickerProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

/**
 * Color Property Picker using TailSwatch
 *
 * @example
 * <PropertyColorPicker
 *   label="Background Color"
 *   value="#3b82f6"
 *   onChange={(color) => updateProp('backgroundColor', color)}
 *   icon={Paintbrush}
 * />
 */
export function PropertyColorPicker({
  label,
  value = "#3b82f6",
  onChange,
  icon: Icon = Paintbrush,
}: PropertyColorPickerProps) {
  const i18n = useOptionalI18n();
  const [color, setColor] = useState<Color>(() => {
    try {
      return parseColor(value);
    } catch {
      return parseColor("#3b82f6"); // Default blue
    }
  });

  const handleColorChange = (newColor: Color) => {
    setColor(newColor);
    // Convert color to hex string
    const hexColor = newColor.toString("hex");
    onChange(hexColor);
  };

  return (
    <div className="property-field">
      <label className="property-label">
        <Icon size={iconEditProps.size} className="property-icon" />
        <span>{i18n ? translateDisplayLabel(i18n.t, label) : label}</span>
      </label>

      <div className="property-color-picker">
        <MyColorSwatches
          areaProps={{
            value: color,
            onChange: handleColorChange,
          }}
          sliderProps={{
            value: color,
            onChange: handleColorChange,
            channel: "hue" as const,
          }}
          swatchPickerProps={{
            value: color,
            onChange: handleColorChange,
          }}
        />
      </div>
    </div>
  );
}
