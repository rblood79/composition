import { useState } from "react";
import { Button } from "react-aria-components/Button";
import {
  PanelDatePicker,
  PanelDateRangePicker,
  type PanelDateEmptyType,
  type PanelDateFormat,
} from "../../../components/property/PanelDatePicker";
import { PropertyFieldset } from "../../../components/property/PropertyFieldset";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { useI18n } from "../../../../i18n";
import { isDateValueText } from "../../../../../../../packages/shared/src/state/dateValue";
import { catalogDateRangeFits } from "../../../../../../../packages/shared/src/catalog/document/dateRangeValue";
import "./DateValueFields.css";

/**
 * ADR-309 Decision 5 — the date family's fields (Value · Min · Max · Placeholder), all one input:
 * the panel's RAC date picker (`PanelDatePicker` — segment field + calendar popover, 사용자 결정
 * 2026-11-12 「select · combobox 처럼 패널용 RAC DatePicker」). A stored zone · seconds survive an
 * edit (사용자 결정 2). A text that reads as no date is shown as written and marked — never cleared
 * until a new value is picked (R5).
 */

/** The edited component's props as stored — `hourCycle` · `shouldForceLeadingZeros` are read. */
export type StoredDateFormat = Readonly<Record<string, unknown>>;
const TIME_GRANULARITIES = new Set(["hour", "minute", "second"]);
const DeleteIcon = ACTION_ICONS.delete;
const AddIcon = ACTION_ICONS.add;

/**
 * The hour cycle the edited component shows (사용자 2026-11-12 「Hour cycle 설정을 따라」): its
 * `hourCycle` (12 · 24), else a TimeField's 24, else the locale's. The same rule as the Canvas ·
 * DOM's `racFieldHourCycle` (shared `dateSegments.ts`, `adr309DateValueFields` pins the two) —
 * kept here so the lazy date chunk does not split that module out of the initial bundle.
 */
export function fieldHourCycle(
  ownerType: string | undefined,
  value: unknown,
): 12 | 24 | undefined {
  const cycle = value === undefined || value === "" ? NaN : Number(value);
  if (cycle === 12 || cycle === 24) return cycle;
  return ownerType === "TimeField" ? 24 : undefined;
}

/**
 * The time segments' format from the edited component's stored props: its Hour cycle
 * (`fieldHourCycle` — a time field is a TimeField's, the only kind-`time` owner) and Force leading
 * zeros (unset = on, as the Canvas · DOM read it).
 */
function pickerFormat(
  emptyType: PanelDateEmptyType,
  format: StoredDateFormat | undefined,
): PanelDateFormat {
  return {
    hourCycle: fieldHourCycle(
      emptyType === "time" ? "TimeField" : undefined,
      format?.hourCycle,
    ),
    shouldForceLeadingZeros: format?.shouldForceLeadingZeros !== false,
  };
}

/** The picker an empty field opens: a time, a date and time at a time granularity, else a date. */
export function dateFieldEmptyType(
  kind: string,
  granularity: unknown,
): PanelDateEmptyType {
  if (kind === "time") return "time";
  return TIME_GRANULARITIES.has(String(granularity))
    ? "datetime-local"
    : "date";
}

/**
 * One date · time input with its draft: RAC reports only whole dates (or a cleared field), and the
 * draft keeps a cleared · unreadable text on screen until a whole date is written.
 */
function DateDraftInput({
  value,
  emptyType,
  format,
  label,
  onCommit,
}: {
  value: string;
  emptyType: PanelDateEmptyType;
  format?: PanelDateFormat;
  label: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return (
    <PanelDatePicker
      value={draft}
      emptyType={emptyType}
      {...format}
      aria-label={label}
      onValueChange={(next) => {
        setDraft(next);
        if (isDateValueText(next)) onCommit(next);
      }}
    />
  );
}

function Unreadable({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <span slot="description" role="status" data-date-unreadable="" title={text}>
      {t("propertiesPanel.dateUnreadable")}
    </span>
  );
}

const unreadable = (text: string) => !isDateValueText(text);

/** A date · date and time · time (`date` · `time` kinds — Value, Min, Max, Placeholder). */
export function DateValueField({
  label,
  value,
  emptyType,
  format,
  onChange,
}: {
  label: string;
  value: unknown;
  emptyType: PanelDateEmptyType;
  /** The edited component's props as stored (`pickerFormat`). */
  format?: StoredDateFormat;
  onChange: (value: unknown) => void;
}) {
  const text = typeof value === "string" ? value : "";
  return (
    <PropertyFieldset
      legend={label}
      afterControl={unreadable(text) ? <Unreadable text={text} /> : undefined}
    >
      <DateDraftInput
        value={text}
        emptyType={emptyType}
        format={pickerFormat(emptyType, format)}
        label={label}
        onCommit={(next) => onChange(next === "" ? undefined : next)}
      />
    </PropertyFieldset>
  );
}

/** A range's start and end (`date-range` — DateRangePicker · RangeCalendar), one object write. */
export function DateRangeField({
  label,
  value,
  emptyType,
  format,
  onChange,
}: {
  label: string;
  value: unknown;
  emptyType: PanelDateEmptyType;
  /** The edited component's props as stored (`pickerFormat`). */
  format?: StoredDateFormat;
  onChange: (value: unknown) => void;
}) {
  const range = catalogDateRangeFits(value) ? value : { start: "", end: "" };
  return (
    <PropertyFieldset
      legend={label}
      afterControl={
        unreadable(range.start) || unreadable(range.end) ? (
          <Unreadable text={`${range.start} – ${range.end}`} />
        ) : undefined
      }
    >
      <PanelDateRangePicker
        aria-label={label}
        value={range}
        emptyType={emptyType}
        {...pickerFormat(emptyType, format)}
        onValueChange={(next) => {
          if (!next) return onChange(undefined);
          if (next.start === "" && next.end === "") return onChange(undefined);
          if (isDateValueText(next.start) && isDateValueText(next.end))
            onChange(next);
        }}
      />
    </PropertyFieldset>
  );
}

/**
 * A Calendar's dates (`date-list` with `selectionMode: multiple` — 사용자 결정 5): a row per date,
 * a new row written once it holds a date. Single selection: one date (the list's first — the
 * stored value is not rewritten when the mode changes, Decision 1).
 */
export function DateListField({
  label,
  value,
  multiple,
  onChange,
}: {
  label: string;
  value: unknown;
  multiple: boolean;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const dates = (
    Array.isArray(value) ? value : typeof value === "string" ? [value] : []
  ).filter((date): date is string => typeof date === "string");
  const [adding, setAdding] = useState(false);
  if (!multiple)
    return (
      <DateValueField
        label={label}
        value={dates[0] ?? ""}
        emptyType="date"
        onChange={onChange}
      />
    );
  const write = (next: string[]) => onChange(next.length ? next : undefined);
  return (
    <PropertyFieldset legend={label} className="date-list-field">
      {dates.map((date, index) => (
        <div className="date-list-field__row" key={`${index}:${date}`}>
          <DateDraftInput
            value={date}
            emptyType="date"
            label={`${label} ${index + 1}`}
            onCommit={(next) =>
              write(
                next === ""
                  ? dates.filter((_, at) => at !== index)
                  : dates.map((old, at) => (at === index ? next : old)),
              )
            }
          />
          <Button
            className="iconButton"
            aria-label={t("propertiesPanel.dateRemove")}
            onPress={() => write(dates.filter((_, at) => at !== index))}
          >
            <DeleteIcon size={14} aria-hidden="true" />
          </Button>
        </div>
      ))}
      {adding ? (
        <div className="date-list-field__row">
          <DateDraftInput
            value=""
            emptyType="date"
            label={t("propertiesPanel.dateAdd")}
            onCommit={(next) => {
              if (next === "") return;
              setAdding(false);
              write([...dates, next]);
            }}
          />
        </div>
      ) : (
        <Button
          className="control-button"
          data-variant="add"
          onPress={() => setAdding(true)}
        >
          <AddIcon size={14} aria-hidden="true" />
          {t("propertiesPanel.dateAdd")}
        </Button>
      )}
    </PropertyFieldset>
  );
}
