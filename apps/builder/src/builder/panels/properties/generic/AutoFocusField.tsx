import { PropertyChipGroup } from "../../../components/property/PropertyChipGroup";

const choices = [
  { key: "off", label: "Off", value: false },
  { key: "on", label: "On", value: true },
  { key: "first", label: "First", value: "first" },
  { key: "last", label: "Last", value: "last" },
] as const;
export function AutoFocusField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <PropertyChipGroup
      label={label}
      chips={choices.map((choice) => ({
        key: choice.key,
        label: choice.label,
        selected: (value ?? false) === choice.value,
      }))}
      onToggle={(key) => {
        const choice = choices.find((choice) => choice.key === key);
        if (choice) onChange(choice.value);
      }}
    />
  );
}
