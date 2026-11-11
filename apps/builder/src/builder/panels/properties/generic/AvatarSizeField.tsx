import { useEffect } from "react";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useSelectionState } from "../../../components/property/propertySelection";
import { catalogAvatarSizeFits } from "../../../../../../../packages/shared/src/catalog/document/avatarSizeValue";

export function AvatarSizeField({
  label,
  value,
  options,
  isGroup,
  onChange,
}: {
  label: string;
  value: unknown;
  options: readonly { value: string; label: string }[];
  isGroup: boolean;
  onChange: (value: unknown) => void;
}) {
  // The refusal belongs to the value and element it was typed on (the field stays mounted across a
  // selection of the same type).
  const [invalid, setInvalid] = useSelectionState(false);
  useEffect(() => setInvalid(false), [value, setInvalid]);
  const current = String(value ?? 24);
  const choices = options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }];
  return (
    <>
      <PropertySelect
        label={label}
        value={current}
        options={[...choices]}
        translateOptions={false}
        onChange={(next) => {
          setInvalid(false);
          onChange(/^\d+$/.test(next) ? Number(next) : next);
        }}
      />
      {!isGroup && (
        <PropertyInput
          label={`Custom ${label}`}
          value={current}
          onChange={(text) => {
            const trimmed = text.trim();
            const next =
              trimmed === ""
                ? undefined
                : Number.isFinite(Number(trimmed))
                  ? Number(trimmed)
                  : trimmed;
            const fits = next === undefined || catalogAvatarSizeFits(next);
            setInvalid(!fits);
            if (fits) onChange(next);
          }}
          afterControl={
            invalid ? (
              <span role="alert">
                Use a non-negative number or an lh value.
              </span>
            ) : undefined
          }
        />
      )}
    </>
  );
}
