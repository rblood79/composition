import { memo } from "react";
import type { InspectorFieldModel } from "@composition/shared";
import {
  PropertyInput,
  PropertyNumberInput,
  PropertySelect,
  PropertySizeToggle,
  PropertySwitch,
} from "../../../components";

interface CatalogFieldProps {
  field: InspectorFieldModel;
  currentProps: Record<string, unknown>;
  onUpdate: (updatedProps: Record<string, unknown>) => void;
}

export const CatalogField = memo(function CatalogField({
  field,
  currentProps,
  onUpdate,
}: CatalogFieldProps) {
  const currentValue = currentProps[field.key] ?? field.defaultValue;
  const update = (value: unknown) => onUpdate({ [field.key]: value });

  switch (field.kind) {
    case "variant":
    case "enum":
      return (
        <PropertySelect
          label={field.label}
          value={String(currentValue ?? "")}
          onChange={(value) => {
            const normalizedValue =
              field.emptyToUndefined && value === "" ? undefined : value;
            update(normalizedValue);
          }}
          options={field.options ?? []}
        />
      );

    case "size":
      return (
        <PropertySizeToggle
          label={field.label}
          value={String(currentValue ?? "")}
          onChange={update}
          options={(field.options ?? []).map((option) => ({
            id: option.value,
            label: option.label,
          }))}
        />
      );

    case "boolean":
      return (
        <PropertySwitch
          label={field.label}
          isSelected={Boolean(currentValue)}
          onChange={update}
        />
      );

    case "number":
      return (
        <PropertyNumberInput
          label={field.label}
          value={currentValue != null ? Number(currentValue) : undefined}
          onChange={update}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );

    case "string-array": {
      const value = Array.isArray(currentValue) ? currentValue.join(", ") : "";
      return (
        <PropertyInput
          label={field.label}
          value={value}
          onChange={(nextValue) => {
            const fields = nextValue
              .split(",")
              .map((part) => part.trim())
              .filter((part) => part.length > 0);
            update(fields.length > 0 ? fields : undefined);
          }}
          placeholder={field.placeholder}
        />
      );
    }

    case "string":
      return (
        <PropertyInput
          label={field.label}
          value={String(currentValue ?? "")}
          onChange={(value) => {
            const normalizedValue =
              field.emptyToUndefined && value === "" ? undefined : value;
            update(normalizedValue);
          }}
          placeholder={field.placeholder}
          multiline={field.multiline}
        />
      );

    case "icon":
    case "binding":
      return null;

    default:
      return null;
  }
});
