import { PropertyNumberInput } from "../../../components/property/PropertyNumberInput";
import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";

export function SelectionCountField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <div data-selection-count="">
      <PropertyChipGroup
        label={label}
        chips={[{ key: "all", label: "All", selected: value === "all" }]}
        onToggle={(_key, selected) => onChange(selected ? "all" : 1)}
      />
      {value !== "all" && (
        <PropertyNumberInput
          label={`${label} Count`}
          value={typeof value === "number" ? value : 0}
          min={0}
          step={1}
          allowEmpty={false}
          onChange={(next) => {
            if (typeof next === "number")
              onChange(Math.max(0, Math.floor(next)));
          }}
        />
      )}
    </div>
  );
}
