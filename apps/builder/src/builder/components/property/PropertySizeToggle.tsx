import { memo, useCallback } from "react";
import type { Key } from "react-aria-components";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertySizeToggleProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Size options: "3" = S/M/L, "5" = XS/S/M/L/XL */
  scale?: "3" | "5";
  /** Custom options override (scale 무시) */
  options?: { id: string; label: string }[];
}

const SIZE_3 = [
  { id: "sm", label: "S" },
  { id: "md", label: "M" },
  { id: "lg", label: "L" },
];

const SIZE_5 = [
  { id: "xs", label: "XS" },
  { id: "sm", label: "S" },
  { id: "md", label: "M" },
  { id: "lg", label: "L" },
  { id: "xl", label: "XL" },
];

export const PropertySizeToggle = memo(function PropertySizeToggle({
  label,
  value,
  onChange,
  scale = "3",
  options,
}: PropertySizeToggleProps) {
  const i18n = useOptionalI18n();
  const displayLabel = i18n
    ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
    : label;
  const items = options ?? (scale === "5" ? SIZE_5 : SIZE_3);

  const handleChange = useCallback(
    (keys: Set<Key>) => {
      const selected = Array.from(keys)[0] as string;
      if (selected) onChange(selected);
    },
    [onChange],
  );

  return (
    <fieldset className="properties-aria">
      <legend className="fieldset-legend">{displayLabel}</legend>
      <ToggleButtonGroup
        aria-label={displayLabel}
        selectionMode="single"
        selectedKeys={[value]}
        onSelectionChange={handleChange}
        indicator
      >
        {items.map((item) => (
          <ToggleButton key={item.id} id={item.id}>
            {i18n
              ? translateKey(
                  i18n.t,
                  semanticLabelKeys[item.label] ?? item.label,
                  item.label,
                )
              : item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </fieldset>
  );
});
