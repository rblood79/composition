import {
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type Ref,
} from "react";
import { Calendar } from "lucide-react";
import { useOptionalI18n } from "@/i18n";
import {
  dateValueFromNativeInput,
  nativeDateInputOf,
} from "../../../../../../packages/shared/src/state/dateValueEditing";
import { isDateValueText } from "../../../../../../packages/shared/src/state/dateValue";
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
}

/** One date editor for variables, the data grid and row/default forms. Only full ISO drafts leave it. */
export function DateValueInput({
  value,
  onValueChange,
  onBlur,
  inputRef,
  autoOpen,
  ...props
}: DateValueInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const [iso, setIso] = useState(false);
  // Native segment editing can temporarily produce an empty value. Keep the edit envelope
  // through that draft so the input does not turn into a date-only field or lose its zone.
  const [context, setContext] = useState(value);
  if (value !== "" && value !== context) setContext(value);
  const source = value || context;
  const native = nativeDateInputOf(source);
  const i18n = useOptionalI18n();
  const label = iso
    ? (i18n?.t("datatable.dateEditPicker") ?? "Use date picker")
    : (i18n?.t("datatable.dateEditIso") ?? "Edit ISO date and time");
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
      <input
        {...props}
        ref={(element) => {
          input.current = element;
          if (typeof inputRef === "function") inputRef(element);
          else if (inputRef) inputRef.current = element;
        }}
        type={iso ? "text" : native.type}
        step={iso ? undefined : native.step}
        value={iso || value === "" ? value : native.value}
        aria-invalid={
          props["aria-invalid"] ||
          (value !== "" && !isDateValueText(value)) ||
          undefined
        }
        title={native.zone ?? props.title}
        onChange={(event) =>
          onValueChange(
            iso
              ? event.target.value
              : dateValueFromNativeInput(source, event.target.value),
          )
        }
      />
      {!iso && native.zone && (
        <span className="date-value-input__zone" title={native.zone}>
          {native.zone}
        </span>
      )}
      <button
        type="button"
        className="date-value-input__mode"
        aria-label={label}
        title={label}
        aria-pressed={iso}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setIso(!iso);
          input.current?.focus();
        }}
      >
        {iso ? <Calendar size={12} aria-hidden="true" /> : "ISO"}
      </button>
    </span>
  );
}
