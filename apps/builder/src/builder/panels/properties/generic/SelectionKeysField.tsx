import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";
import { PropertyInput } from "../../../components/property/PropertyInput";

export function SelectionKeysField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
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
