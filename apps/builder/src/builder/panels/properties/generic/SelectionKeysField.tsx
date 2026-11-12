import { Checkbox } from "@composition/shared/components/list";
import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { PropertyInput } from "../../../components/property/PropertyInput";
import "./SelectionKeysField.css";

/**
 * A key list field. With `options` (ADR-308 — a group's items, key · text) it is a check list, one
 * row per item (사용자 결정 3 — several keys); without, the keys typed as text.
 */
export function SelectionKeysField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: unknown;
  options?: readonly { value: string; label: string }[];
  onChange: (value: unknown) => void;
}) {
  if (options) {
    const keys =
      value === "all"
        ? options.map((option) => option.value)
        : Array.isArray(value)
          ? value.map(String)
          : [];
    return (
      <PropertyFieldset legend={label}>
        {/* (The legend names the list — each Checkbox is its own control, as the chart field picker.) */}
        <div
          className="react-aria-control react-aria-Group selection-keys-list"
          data-selection-keys=""
        >
          {options.map((option) => (
            <Checkbox
              key={option.value}
              className="react-aria-Checkbox"
              isSelected={keys.includes(option.value)}
              onChange={(selected) =>
                onChange(
                  selected
                    ? [
                        ...keys.filter((key) => key !== option.value),
                        option.value,
                      ]
                    : keys.filter((key) => key !== option.value),
                )
              }
            >
              {option.label}
            </Checkbox>
          ))}
        </div>
      </PropertyFieldset>
    );
  }
  return (
    <div data-selection-keys="">
      <PropertyChipGroup
        label={label}
        chips={[{ key: "all", label: "All", selected: value === "all" }]}
        onToggle={(_key, selected) => onChange(selected ? "all" : [])}
      />
      {value !== "all" && (
        <PropertyInput
          label={`${label} IDs`}
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(text) =>
            onChange(
              text
                .split(",")
                .map((key) => key.trim())
                .filter(Boolean),
            )
          }
        />
      )}
    </div>
  );
}
