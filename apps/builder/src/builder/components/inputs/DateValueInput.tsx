import {
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type Ref,
} from "react";
import {
  dateValueFromNativeInput,
  nativeDateInputOf,
} from "../../../../../../packages/shared/src/state/dateValueEditing";
import { isDateValueText } from "../../../../../../packages/shared/src/state/dateValue";
import { Input } from "react-aria-components/Input";
import "./DateValueInput.css";

interface DateValueInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "step" | "value" | "onChange" | "onBlur"
> {
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  /** A grid edit opens the picker under the activation that started the edit. */
  autoOpen?: boolean;
  /**
   * ADR-309 — the picker an empty value opens (a date field at a time granularity · a TimeField):
   * an empty text has no shape of its own (default `date`).
   */
  emptyType?: "date" | "datetime-local" | "time";
}

/**
 * One date editor for variables, the data grid, row/default forms and the Design panel: the browser's
 * date picker. A native edit keeps the value's zone and precision (`dateValueFromNativeInput`); the
 * ISO text mode was removed (사용자 2026-11-12 — 「불필요한 기능」).
 */
export function DateValueInput({
  value,
  onValueChange,
  onBlur,
  inputRef,
  autoOpen,
  emptyType,
  ...props
}: DateValueInputProps) {
  const input = useRef<HTMLInputElement>(null);
  // Native segment editing can temporarily produce an empty value. Keep the edit envelope
  // through that draft so the input does not turn into a date-only field or lose its zone.
  const [context, setContext] = useState(value);
  if (value !== "" && value !== context) setContext(value);
  const source = value || context;
  const native =
    source === "" && emptyType
      ? { type: emptyType, value: "", step: undefined, zone: undefined }
      : nativeDateInputOf(source);
  useLayoutEffect(() => {
    if (!autoOpen) return;
    input.current?.focus();
    if (native.type !== "text") {
      try {
        input.current?.showPicker?.();
      } catch {
        /* no activation / unsupported */
      }
    } else input.current?.select();
    // The input's kind follows its draft; focus/picker activation belongs to edit start only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span
      className="date-value-input"
      data-date-value-editor
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur?.();
      }}
    >
      <Input
        {...props}
        // 클래스가 없으면 RAC 기본 class (react-aria-Input) 가 붙어 빌더 위젯 Input 모양이 걸린다
        className={props.className ?? "date-value-input__field"}
        ref={(element) => {
          input.current = element;
          if (typeof inputRef === "function") inputRef(element);
          else if (inputRef) inputRef.current = element;
        }}
        type={native.type}
        step={native.step}
        value={value === "" ? value : native.value}
        aria-invalid={
          props["aria-invalid"] ||
          (value !== "" && !isDateValueText(value)) ||
          undefined
        }
        title={native.zone ?? props.title}
        onChange={(event) =>
          onValueChange(dateValueFromNativeInput(source, event.target.value))
        }
      />
      {native.zone && (
        <span className="date-value-input__zone" title={native.zone}>
          {native.zone}
        </span>
      )}
    </span>
  );
}
