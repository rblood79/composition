import {
  useCallback,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type Ref,
} from "react";
import {
  PanelDatePicker,
  type PanelDateEmptyType,
} from "../property/PanelDatePicker";
import "./DateValueInput.css";

interface DateValueInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  /** The cell editor's focus target — the field's first segment. */
  inputRef?: Ref<HTMLInputElement>;
  /** A grid edit focuses the field's first segment as the edit starts. */
  autoOpen?: boolean;
  /**
   * ADR-309 — the shape an empty value edits as (a date field at a time granularity · a
   * TimeField): an empty text has no shape of its own (default `date`).
   */
  emptyType?: PanelDateEmptyType;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  /** (Kept for callers — the segments show their own placeholders.) */
  placeholder?: string;
  /** Enter · Tab · Escape · ⌘/Ctrl keys — the editor's commit · cancel · revert contract. */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  [data: `data-${string}`]: string | boolean | undefined;
}

/** Inside the field's calendar popover (portalled — still the editor's own focus). */
const inPopover = (node: EventTarget | null) =>
  node instanceof Element && !!node.closest(".property-date-picker__popover");

/**
 * One date editor for variables, the data grid and row/default forms: the panel's RAC date picker
 * (`PanelDatePicker` — segment field + calendar popover, 사용자 2026-11-12 「같은 달력으로」). Its
 * edits keep the value's zone and precision (`dateValueFromNativeInput`); every change is reported
 * (the caller's draft — it writes on blur · Enter). The editor contract is the wrapper's: a blur
 * that leaves the field and its popover is `onBlur`; Enter · Tab · Escape · ⌘/Ctrl keys reach
 * `onKeyDown` before RAC's segment handler (which stops their propagation).
 */
export function DateValueInput({
  value,
  onValueChange,
  onBlur,
  inputRef,
  autoOpen,
  emptyType,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  placeholder: _placeholder,
  onKeyDown,
  ...data
}: DateValueInputProps) {
  const root = useRef<HTMLSpanElement | null>(null);
  const setRef = useCallback(
    (element: HTMLSpanElement | null) => {
      root.current = element;
      const target = (element?.querySelector<HTMLElement>(
        "[role=spinbutton], input",
      ) ?? null) as HTMLInputElement | null;
      if (typeof inputRef === "function") inputRef(target);
      else if (inputRef) inputRef.current = target;
    },
    [inputRef],
  );
  useLayoutEffect(() => {
    if (!autoOpen) return;
    root.current
      ?.querySelector<HTMLElement>("[role=spinbutton], input")
      ?.focus();
    // Focus belongs to edit start only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const forwardKey = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!onKeyDown || inPopover(event.target)) return;
    const command = event.metaKey || event.ctrlKey;
    if (
      command ||
      event.key === "Enter" ||
      event.key === "Tab" ||
      event.key === "Escape"
    )
      onKeyDown(event as unknown as KeyboardEvent<HTMLInputElement>);
  };
  return (
    <span
      {...data}
      ref={setRef}
      className={
        className ? `date-value-input ${className}` : "date-value-input"
      }
      data-date-value-editor
      onKeyDownCapture={forwardKey}
      onBlur={(event: FocusEvent<HTMLSpanElement>) => {
        const next = event.relatedTarget;
        if (
          event.currentTarget.contains(next as Node | null) ||
          inPopover(next)
        )
          return;
        onBlur?.();
      }}
    >
      <PanelDatePicker
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        isInvalid={ariaInvalid === true || ariaInvalid === "true"}
        deferTyping={false}
        // A closed calendar hands focus back to the editor — RAC's restore landed on the table
        // cell around it (variable table · data grid), leaving the edit open but keyless.
        onOpenChange={(open) => {
          if (open) return;
          requestAnimationFrame(() => {
            const field = root.current;
            if (!field || field.contains(document.activeElement)) return;
            field
              .querySelector<HTMLElement>(".property-date-picker__button")
              ?.focus();
          });
        }}
        value={value}
        emptyType={emptyType}
        onValueChange={onValueChange}
      />
    </span>
  );
}
