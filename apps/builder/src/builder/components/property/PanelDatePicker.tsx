/**
 * PanelDatePicker · PanelDateRangePicker · PanelTimeField — 빌더 패널의 날짜 칸 (2026-11-12 사용자 결정
 * 「RAC DatePicker (달력 팝업이 있는 날짜 칸) 를 따로 만들어 쓴다 — select · combobox 처럼 패널용으로」).
 *
 * RAC `DatePicker` (segment 칸 + 달력 버튼 + `Popover` 안 `Calendar`) · `DateRangePicker` (+ `RangeCalendar`)
 * · `TimeField`. 값은 문서가 저장한 ISO 글자 그대로 주고받는다 — RAC 는 벽시계 (날짜 · 시각) 만 고치고,
 * 저장 글자의 시간대 · offset · 소수 초는 `dateValueFromNativeInput` 이 그대로 둔다 (변수 표 · 데이터
 * 격자의 `DateValueInput` 과 같은 무손실 규칙). 날짜로 읽을 수 없는 글자는 글자 칸으로 둔다 (지우기만).
 *
 * Why: 브라우저 `<input type="date">` 은 빌더 패널의 다른 칸 (PanelSelect · 단위 ComboBox) 과 모양 ·
 * 달력 팝업이 달랐고, ISO 글자 전환은 비개발자에게 뜻이 없었다 (사용자 2026-11-12).
 */
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "react-aria-components/Button";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
} from "react-aria-components/Calendar";
import { RangeCalendar } from "react-aria-components/RangeCalendar";
import { DateInput, DateSegment } from "react-aria-components/DateField";
import { TimeField, type TimeValue } from "react-aria-components/TimeField";
import { DatePicker, type DateValue } from "react-aria-components/DatePicker";
import { DateRangePicker } from "react-aria-components/DateRangePicker";
import { Dialog } from "react-aria-components/Dialog";
import { Group } from "react-aria-components/Group";
import { Heading } from "react-aria-components/Heading";
import { Input } from "react-aria-components/Input";
import { Popover } from "react-aria-components/Popover";

import {
  dateValueFromNativeInput,
  nativeDateInputOf,
  pickerValueOf,
  type NativeDateInput,
} from "../../../../../../packages/shared/src/state/dateValueEditing";
import { isDateValueText } from "../../../../../../packages/shared/src/state/dateValue";
import { iconProps } from "../../../utils/ui/uiConstants";

import "./PanelDatePicker.css";

export type PanelDateEmptyType = "date" | "datetime-local" | "time";

interface Projection extends NativeDateInput {
  /** RAC 값 (벽시계) — 비었거나 읽을 수 없으면 null */
  rac: DateValue | TimeValue | null;
  granularity: "day" | "minute" | "second";
}

/** The stored text as the picker shows it (its kind, wall clock and precision). */
function project(text: string, emptyType: PanelDateEmptyType): Projection {
  const native: NativeDateInput =
    text === "" ? { type: emptyType, value: "" } : nativeDateInputOf(text);
  const granularity =
    native.type === "date"
      ? "day"
      : native.step !== undefined && native.step <= 1
        ? "second"
        : "minute";
  const rac = pickerValueOf(native) as DateValue | TimeValue | null;
  return { ...native, rac, granularity };
}

/**
 * RAC's edited wall clock back into the stored text's envelope (zone · offset · precision). At a
 * minute granularity RAC's text carries `:00` seconds — the stored text keeps its own precision.
 */
function commitText(
  previous: string,
  next: DateValue | TimeValue | null,
  granularity: Projection["granularity"],
) {
  if (!next) return "";
  const text =
    granularity === "second"
      ? next.toString()
      : next.toString().replace(/:00(?:\.0+)?$/, "");
  return dateValueFromNativeInput(previous, text);
}

/** A stored text kept for its envelope while a segment is briefly cleared. */
function useEnvelope(value: string) {
  const [context, setContext] = useState(value);
  if (value !== "" && value !== context) setContext(value);
  return value || context;
}

/**
 * Typed segments are a draft until the field is left (or Enter): RAC reports every whole date while
 * a year is typed digit by digit (`2` → year 0002), which must not reach the document. A date picked
 * in the calendar (or a segment-less edit) is written at once.
 */
function useTypingDraft<T>(
  value: T,
  key: string,
  commit: (next: T) => void,
  defer = true,
) {
  const [pending, setPending] = useState<{ value: T } | null>(null);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setPending(null);
  }
  const flush = () => {
    if (!pending) return;
    setPending(null);
    commit(pending.value);
  };
  return {
    shown: pending ? pending.value : value,
    change(next: T) {
      if (
        defer &&
        document.activeElement?.getAttribute("role") === "spinbutton"
      )
        setPending({ value: next });
      else {
        setPending(null);
        commit(next);
      }
    },
    groupProps: {
      onBlur(event: FocusEvent<HTMLDivElement>) {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          flush();
      },
      // (Capture — RAC's segment keyboard handler stops the key's propagation.)
      onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Enter") flush();
      },
    },
  };
}

function Segments() {
  return (
    <DateInput className="property-date-picker__input">
      {(segment) => (
        <DateSegment
          segment={segment}
          className="property-date-picker__segment"
        />
      )}
    </DateInput>
  );
}

function Zone({ zone }: { zone?: string }) {
  return zone ? (
    <span className="property-date-picker__zone" title={zone}>
      {zone}
    </span>
  ) : null;
}

function CalendarButton() {
  return (
    <Button className="property-date-picker__button">
      <CalendarIcon size={iconProps.size} aria-hidden="true" />
    </Button>
  );
}

function CalendarHeader() {
  return (
    <header className="property-calendar__header">
      <Button slot="previous" className="property-calendar__nav">
        <ChevronLeft size={iconProps.size} aria-hidden="true" />
      </Button>
      <Heading className="property-calendar__heading" />
      <Button slot="next" className="property-calendar__nav">
        <ChevronRight size={iconProps.size} aria-hidden="true" />
      </Button>
    </header>
  );
}

function CalendarPopover({ children }: { children: ReactNode }) {
  return (
    <Popover
      className="react-aria-Popover property-date-picker__popover"
      placement="bottom end"
    >
      <Dialog className="property-date-picker__dialog">{children}</Dialog>
    </Popover>
  );
}

function Grid() {
  return (
    <CalendarGrid className="property-calendar__grid">
      {(date) => (
        <CalendarCell date={date} className="property-calendar__cell" />
      )}
    </CalendarGrid>
  );
}

/** A text that reads as no date: shown as written, editable only to clear it. */
function UnreadableText({
  value,
  label,
  labelledBy,
  onValueChange,
}: {
  value: string;
  label?: string;
  labelledBy?: string;
  onValueChange: (text: string) => void;
}) {
  return (
    <Input
      className="property-date-picker__text"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-invalid
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}

export interface PanelDatePickerProps {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** 호출부가 정한 오류 표시 (날짜로 읽을 수 없는 글자는 따로 표시된다) */
  isInvalid?: boolean;
  /**
   * 키보드로 친 segment 를 칸을 떠날 때 (또는 Enter) 쓴다 (기본). 호출부가 자기 draft 를 들고
   * blur · Enter 에 저장하는 곳 (변수 표 · 데이터 격자 · 행 폼) 은 false — 바뀔 때마다 알린다.
   */
  deferTyping?: boolean;
  /** 달력 팝오버가 열리고 닫힐 때 */
  onOpenChange?: (open: boolean) => void;
  /** 시각 칸의 12 · 24 시간제 — 고치는 컴포넌트의 Hour cycle (없으면 locale) */
  hourCycle?: 12 | 24;
  /** 한 자리 숫자 앞에 0 (`09`) — 고치는 컴포넌트의 Force leading zeros */
  shouldForceLeadingZeros?: boolean;
  /** 저장된 ISO 글자 (빈 글자 = 값 없음) */
  value: string;
  onValueChange: (text: string) => void;
  /** 빈 칸이 여는 모양 — 시각 단위 필드는 날짜 + 시각, TimeField 는 시각 (기본 날짜) */
  emptyType?: PanelDateEmptyType;
}

/** A date · date and time (with a calendar popover) · time (no calendar) field. */
export function PanelDatePicker({
  "aria-label": label,
  "aria-labelledby": labelledBy,
  isInvalid: callerInvalid,
  deferTyping = true,
  onOpenChange,
  hourCycle,
  shouldForceLeadingZeros,
  value,
  onValueChange,
  emptyType = "date",
}: PanelDatePickerProps) {
  const draft = useTypingDraft(value, value, onValueChange, deferTyping);
  const text = draft.shown;
  const source = useEnvelope(text);
  const shown = project(text, emptyType);
  // (An emptied field keeps the kind of the value it held.)
  const kind =
    text === "" && source !== "" ? project(source, emptyType) : shown;
  if (kind.type === "text")
    return (
      <UnreadableText
        value={value}
        label={label}
        labelledBy={labelledBy}
        onValueChange={onValueChange}
      />
    );
  const invalid = !!callerInvalid || (text !== "" && !isDateValueText(text));
  if (kind.type === "time")
    return (
      <TimeField
        className="property-date-picker"
        aria-label={label}
        aria-labelledby={labelledBy}
        value={shown.rac as TimeValue | null}
        granularity={kind.granularity === "second" ? "second" : "minute"}
        hourCycle={hourCycle}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        isInvalid={invalid}
        onChange={(next) =>
          draft.change(commitText(source, next, kind.granularity))
        }
      >
        <Group className="property-date-picker__group" {...draft.groupProps}>
          <Segments />
          <Zone zone={kind.zone} />
        </Group>
      </TimeField>
    );
  return (
    <DatePicker
      className="property-date-picker"
      aria-label={label}
      aria-labelledby={labelledBy}
      value={shown.rac as DateValue | null}
      granularity={kind.granularity}
      hourCycle={hourCycle}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      isInvalid={invalid}
      onOpenChange={onOpenChange}
      onChange={(next) =>
        draft.change(commitText(source, next, kind.granularity))
      }
    >
      <Group className="property-date-picker__group" {...draft.groupProps}>
        <Segments />
        <Zone zone={kind.zone} />
        <CalendarButton />
      </Group>
      <CalendarPopover>
        <Calendar className="property-calendar">
          <CalendarHeader />
          <Grid />
        </Calendar>
      </CalendarPopover>
    </DatePicker>
  );
}

export interface PanelDateRange {
  start: string;
  end: string;
}

export interface PanelDateRangePickerProps {
  "aria-label": string;
  value: PanelDateRange;
  /** 두 끝 모두 지우면 null */
  onValueChange: (range: PanelDateRange | null) => void;
  emptyType?: PanelDateEmptyType;
  /** 시각 칸의 12 · 24 시간제 — 고치는 컴포넌트의 Hour cycle (없으면 locale) */
  hourCycle?: 12 | 24;
  /** 한 자리 숫자 앞에 0 (`09`) — 고치는 컴포넌트의 Force leading zeros */
  shouldForceLeadingZeros?: boolean;
}

/** A range's start · end in one field, with a range calendar popover (RAC `DateRangePicker`). */
export function PanelDateRangePicker({
  "aria-label": label,
  value,
  onValueChange,
  emptyType = "date",
  hourCycle,
  shouldForceLeadingZeros,
}: PanelDateRangePickerProps) {
  const draft = useTypingDraft<PanelDateRange | null>(
    value,
    `${value.start}|${value.end}`,
    onValueChange,
  );
  const range = draft.shown ?? { start: "", end: "" };
  const start = useEnvelope(range.start);
  const end = useEnvelope(range.end);
  const shownStart = project(range.start, emptyType);
  const shownEnd = project(range.end, emptyType);
  const kind = project(start || end, emptyType);
  const both =
    shownStart.rac && shownEnd.rac && kind.type !== "time"
      ? { start: shownStart.rac as DateValue, end: shownEnd.rac as DateValue }
      : null;
  if (
    kind.type === "text" ||
    kind.type === "time" ||
    shownStart.type === "text" ||
    shownEnd.type === "text"
  )
    return (
      <span className="property-date-picker__range-text">
        <UnreadableText
          value={value.start}
          label={label}
          onValueChange={(text) => onValueChange({ ...value, start: text })}
        />
        <UnreadableText
          value={value.end}
          label={label}
          onValueChange={(text) => onValueChange({ ...value, end: text })}
        />
      </span>
    );
  return (
    <DateRangePicker
      className="property-date-picker"
      aria-label={label}
      value={both}
      granularity={kind.granularity === "day" ? "day" : kind.granularity}
      hourCycle={hourCycle}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      onChange={(next) =>
        draft.change(
          next
            ? {
                start: commitText(start, next.start, kind.granularity),
                end: commitText(end, next.end, kind.granularity),
              }
            : null,
        )
      }
    >
      <Group className="property-date-picker__group" {...draft.groupProps}>
        <DateInput slot="start" className="property-date-picker__input">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="property-date-picker__segment"
            />
          )}
        </DateInput>
        <span aria-hidden="true" className="property-date-picker__dash">
          –
        </span>
        <DateInput slot="end" className="property-date-picker__input">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="property-date-picker__segment"
            />
          )}
        </DateInput>
        <CalendarButton />
      </Group>
      <CalendarPopover>
        <RangeCalendar className="property-calendar property-calendar--range">
          <CalendarHeader />
          <Grid />
        </RangeCalendar>
      </CalendarPopover>
    </DateRangePicker>
  );
}
