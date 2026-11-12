import { memo } from "react";
import type { ResolvedField } from "@composition/shared";
import { useFieldValue } from "./fieldValueSource";
import {
  DateListField,
  DateRangeField,
  DateValueField,
  dateFieldEmptyType,
} from "./DateValueFields";

/**
 * ADR-309 — a date field reads its owner's granularity (a time granularity opens a date-and-time
 * picker) and a Calendar's selection mode (`multiple` — a list of dates).
 */
const DateKindField = memo(function DateKindField({
  field,
  value,
  elementId,
  onChange,
}: {
  field: ResolvedField;
  value: unknown;
  elementId: string | undefined;
  onChange: (value: unknown) => void;
}) {
  const granularity = useFieldValue(
    elementId,
    field.origin,
    "granularity",
    undefined,
  );
  const selectionMode = useFieldValue(
    elementId,
    field.origin,
    "selectionMode",
    undefined,
  );
  const emptyType = dateFieldEmptyType(field.kind, granularity);
  if (field.kind === "date-range")
    return (
      <DateRangeField
        label={field.label}
        value={value}
        emptyType={emptyType}
        onChange={onChange}
      />
    );
  if (field.kind === "date-list")
    return (
      <DateListField
        label={field.label}
        value={value}
        multiple={selectionMode === "multiple"}
        onChange={onChange}
      />
    );
  return (
    <DateValueField
      label={field.label}
      value={value}
      emptyType={emptyType}
      onChange={onChange}
    />
  );
});

export default DateKindField;
