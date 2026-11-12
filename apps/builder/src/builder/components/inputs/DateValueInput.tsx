import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type MutableRefObject,
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
  /** Focus the field's first segment as it mounts (a grid edit's start · a form's first field). */
  autoFocus?: boolean;
  /**
   * ADR-309 — the shape an empty value edits as (a date field at a time granularity · a
   * TimeField): an empty text has no shape of its own (default `date`).
   */
  emptyType?: PanelDateEmptyType;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Enter · Tab · Escape · ⌘/Ctrl keys — the editor's commit · cancel · revert contract. */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  [data: `data-${string}`]: string | boolean | undefined;
}

/** The field's first segment (or its unreadable-text input) — the editor's focus target. */
const firstSegment = (root: HTMLElement | null) =>
  root?.querySelector<HTMLElement>("[role=spinbutton], input") ?? null;

/** A caller's ref (callback or object) set to `value`. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as MutableRefObject<T | null>).current = value;
}

/** RAC FocusScope's restore event (`react-aria` `FocusScope` — `RESTORE_FOCUS_EVENT`). */
const FOCUS_RESTORE_EVENT = "react-aria-focus-scope-restore";

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
  autoFocus,
  emptyType,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  onKeyDown,
  ...data
}: DateValueInputProps) {
  const root = useRef<HTMLSpanElement | null>(null);
  const setRef = useCallback(
    (element: HTMLSpanElement | null) => {
      root.current = element;
      assignRef(inputRef, firstSegment(element) as HTMLInputElement | null);
    },
    [inputRef],
  );
  // A closed calendar restores focus to its button by dispatching this event on it; a RAC table
  // around the editor cancels it and focuses its cell instead (`useSelectableCollection` —
  // virtualized rows reuse DOM nodes), leaving the edit open but keyless. The restore is the
  // editor's own: it stops here and RAC focuses the button.
  useEffect(() => {
    const field = root.current;
    if (!field) return;
    const own = (event: Event) => event.stopPropagation();
    field.addEventListener(FOCUS_RESTORE_EVENT, own);
    return () => field.removeEventListener(FOCUS_RESTORE_EVENT, own);
  }, []);
  useLayoutEffect(() => {
    if (!autoFocus) return;
    firstSegment(root.current)?.focus();
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
        aria-describedby={ariaDescribedBy}
        isInvalid={ariaInvalid}
        deferTyping={false}
        value={value}
        emptyType={emptyType}
        onValueChange={onValueChange}
      />
    </span>
  );
}
