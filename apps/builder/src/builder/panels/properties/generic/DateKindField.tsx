import { memo } from "react";
import type { ResolvedField } from "@composition/shared";
import { useSiblingValue } from "./fieldValueSource";
import {
  DateListField,
  DateRangeField,
  DateValueField,
  dateFieldEmptyType,
} from "./DateValueFields";

/**
 * ADR-309 — a date field reads its owner's granularity (a time granularity opens a date-and-time
 * picker), a Calendar's selection mode (`multiple` — a list of dates) and the owner's Hour cycle ·
 * Force leading zeros (사용자 2026-11-12 「Hour cycle 설정을 따라」 — the time segments show as the Canvas does; a
 * TimeField's default is 24, the date fields' the locale's — `fieldHourCycle`).
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
  const granularity = useSiblingValue(elementId, field, "granularity");
  const selectionMode = useSiblingValue(elementId, field, "selectionMode");
  const hourCycleValue = useSiblingValue(elementId, field, "hourCycle");
  const forceLeadingZeros = useSiblingValue(
    elementId,
    field,
    "shouldForceLeadingZeros",
  );
  const emptyType = dateFieldEmptyType(field.kind, granularity);
  const format = {
    hourCycle: hourCycleValue,
    shouldForceLeadingZeros: forceLeadingZeros,
  };
  if (field.kind === "date-range")
    return (
      <DateRangeField
        label={field.label}
        value={value}
        emptyType={emptyType}
        format={format}
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
      format={format}
      onChange={onChange}
    />
  );
});

export default DateKindField;
