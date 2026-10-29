/**
 * FieldValueInput — ADR-289 Decision 1 · 2: one labelled input per field type, shared by the row
 * form (every column) and the column editor (the default value). The value it edits is **text**
 * (`FieldDraft.text` — structure values as JSON, booleans as "true" / "false"); the caller coerces
 * it with `coerceCellValue` on save, so the form and the grid's cell editors follow one rule.
 *
 * - `string` · `email` · `url` — a growing textarea (one line to start, ⌘Enter submits)
 * - `number` — `inputMode="decimal"` · `boolean` — a three-way Select (empty · on · off)
 * - `date` · `datetime` — native pickers (`datetime` shows the ISO text as local time)
 * - `image` — a URL input with a preview · `array` · `object` — a JSON textarea
 * - `reference` — a ComboBox over the target table's rows (key field value · the first text column,
 *   50 matches, `useDeferredValue`) · `id` — read-only (`readonlyText`)
 *
 * Markup is the panel field (`fieldset.properties-aria` + `legend.fieldset-legend` + the control
 * box) — the error goes under the box as `role="alert"` (ADR-163 · web-interface-guidelines).
 */
import { resolveField } from "@composition/shared";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "react-aria-components/Button";
import { ComboBox as AriaComboBox } from "react-aria-components/ComboBox";
import { Input } from "react-aria-components/Input";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { useOptionalI18n } from "../../../../i18n";
import type { DataField } from "../../../../types/builder/data.types";
import { iconProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { useDataStore } from "../../../stores/data";
import { resolveFieldType } from "../utils/fieldTypes";

export interface FieldValueInputProps {
  field: DataField;
  /** The legend — the column key in the row form, "Default value" in the column editor. */
  label: string;
  /** Show the type icon before the label (the row form). */
  showTypeIcon?: boolean;
  text: string;
  onChange: (text: string) => void;
  placeholder?: string;
  /** The text under the box (`role="alert"`) — required · not a value of the type · bad JSON. */
  error?: string | null;
  /** Enter in a single-line input · ⌘Enter in a textarea. */
  onSubmit?: () => void;
  /** Focus left the control (the column editor commits the default on blur). */
  onBlur?: () => void;
  /** `id` columns: the text shown instead of an input. */
  readonlyText?: string;
  /** The focusable element — the form focuses the first error. */
  controlRef?: (el: HTMLElement | null) => void;
  autoFocus?: boolean;
  className?: string;
}

const REFERENCE_MATCH_MAX = 50;

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO text → the `datetime-local` value (local time); anything unparsable → "". */
export function toLocalDatetimeInput(text: string): string {
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function growTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function FieldValueInput({
  field,
  label,
  showTypeIcon,
  text,
  onChange,
  placeholder,
  error,
  onSubmit,
  onBlur,
  readonlyText,
  controlRef,
  autoFocus,
  className,
}: FieldValueInputProps) {
  const i18n = useOptionalI18n();
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18n ? i18n.t(`datatable.${key}`, params) : key,
    [i18n],
  );
  const errorId = `${field.id ?? field.key}-error`;
  const TypeGlyph = resolveFieldType(field.type).icon;

  const submitOnEnter = (e: ReactKeyboardEvent<HTMLElement>) => {
    // ⌘Z inside the input is the input's own undo — not the History stack (data-shortcut-local).
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit?.();
    }
  };
  const submitOnCommandEnter = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit?.();
    }
  };

  const common = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "data-shortcut-local": "undo redo",
    autoFocus,
    onBlur,
  } as const;

  let control: ReactNode;
  if (readonlyText !== undefined) {
    control = (
      <span
        className="react-aria-Input datatable-value-readonly"
        aria-readonly="true"
        ref={controlRef as (el: HTMLSpanElement | null) => void}
      >
        {readonlyText}
      </span>
    );
  } else if (field.type === "boolean") {
    return (
      <PropertySelect
        className={`datatable-value-field ${className ?? ""}`}
        label={label}
        icon={showTypeIcon ? TypeGlyph : undefined}
        value={text === "true" || text === "false" ? text : ""}
        optionValueMode="literal"
        translateOptions={false}
        options={[
          { value: "", label: placeholder ?? t("rowFormEmpty") },
          { value: "true", label: t("rowFormBooleanOn") },
          { value: "false", label: t("rowFormBooleanOff") },
        ]}
        onChange={onChange}
        afterControl={
          error ? (
            <span
              id={errorId}
              role="alert"
              className="datatable-value-error"
              slot="description"
            >
              {error}
            </span>
          ) : undefined
        }
      />
    );
  } else if (field.type === "number") {
    control = (
      <input
        {...common}
        ref={controlRef}
        className="react-aria-Input"
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={submitOnEnter}
      />
    );
  } else if (field.type === "date") {
    control = (
      <input
        {...common}
        ref={controlRef}
        className="react-aria-Input"
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={submitOnEnter}
      />
    );
  } else if (field.type === "datetime") {
    control = (
      <input
        {...common}
        ref={controlRef}
        className="react-aria-Input"
        type="datetime-local"
        value={toLocalDatetimeInput(text)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={submitOnEnter}
      />
    );
  } else if (field.type === "image") {
    control = (
      <>
        <input
          {...common}
          ref={controlRef}
          className="react-aria-Input"
          type="url"
          value={text}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={submitOnEnter}
        />
        {text.trim() !== "" && (
          <img
            className="datatable-value-image"
            src={text.trim()}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).hidden = true;
            }}
          />
        )}
      </>
    );
  } else if (field.type === "array" || field.type === "object") {
    control = (
      <textarea
        {...common}
        ref={(el) => {
          growTextarea(el);
          controlRef?.(el);
        }}
        className="react-aria-TextArea datatable-value-json"
        rows={3}
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          growTextarea(e.currentTarget);
          onChange(e.target.value);
        }}
        onKeyDown={submitOnCommandEnter}
      />
    );
  } else if (field.type === "reference") {
    control = (
      <ReferenceComboBox
        field={field}
        label={label}
        text={text}
        placeholder={placeholder}
        onChange={onChange}
        onSubmit={onSubmit}
        onBlur={onBlur}
        controlRef={controlRef}
        autoFocus={autoFocus}
        invalid={Boolean(error)}
        errorId={error ? errorId : undefined}
      />
    );
  } else {
    // string · email · url — a textarea that grows with the text (one line to start)
    control = (
      <textarea
        {...common}
        ref={(el) => {
          growTextarea(el);
          controlRef?.(el);
        }}
        className="react-aria-TextArea datatable-value-text"
        rows={1}
        spellCheck={field.type === "string"}
        inputMode={
          field.type === "email"
            ? "email"
            : field.type === "url"
              ? "url"
              : undefined
        }
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          growTextarea(e.currentTarget);
          onChange(e.target.value);
        }}
        onKeyDown={submitOnCommandEnter}
      />
    );
  }

  return (
    <fieldset
      className={`properties-aria datatable-value-field ${className ?? ""}`}
      data-field-type={field.type}
    >
      <legend className="fieldset-legend">
        {showTypeIcon && (
          <TypeGlyph
            size={iconSmall.size}
            strokeWidth={iconSmall.strokeWidth}
            aria-hidden="true"
          />
        )}
        {label}
      </legend>
      <div className="react-aria-control react-aria-Group">{control}</div>
      {error && (
        <span id={errorId} role="alert" className="datatable-value-error">
          {error}
        </span>
      )}
    </fieldset>
  );
}

interface ReferenceItem {
  id: string;
  hint: string;
}

/** The target table's rows as options — key field value · the first text column beside it. */
function ReferenceComboBox({
  field,
  label,
  text,
  placeholder,
  onChange,
  onSubmit,
  onBlur,
  controlRef,
  autoFocus,
  invalid,
  errorId,
}: {
  field: DataField;
  label: string;
  text: string;
  placeholder?: string;
  onChange: (text: string) => void;
  onSubmit?: () => void;
  onBlur?: () => void;
  controlRef?: (el: HTMLElement | null) => void;
  autoFocus?: boolean;
  invalid: boolean;
  errorId?: string;
}) {
  const collections = useDataStore((state) => state.collections);
  const reference = field.reference;
  const target = reference
    ? collections.get(reference.collectionId)
    : undefined;
  const items = useMemo<ReferenceItem[]>(() => {
    if (!target || !field.reference) return [];
    const keyField = resolveField(target.schema, field.reference.keyField);
    if (!keyField) return [];
    const hintField = target.schema.find(
      (f) => f.key !== keyField.key && f.type === "string",
    );
    const out: ReferenceItem[] = [];
    const seen = new Set<string>();
    for (const row of target.mockData) {
      const key = row[keyField.key];
      if (key === null || key === undefined) continue;
      const id = String(key);
      if (seen.has(id)) continue;
      seen.add(id);
      const hint = hintField ? row[hintField.key] : undefined;
      out.push({
        id,
        hint: hint === null || hint === undefined ? "" : String(hint),
      });
    }
    return out;
  }, [target, field.reference]);
  const deferred = useDeferredValue(text);
  const matches = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    const out: ReferenceItem[] = [];
    for (const item of items) {
      if (
        q === "" ||
        item.id.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q)
      ) {
        out.push(item);
        if (out.length >= REFERENCE_MATCH_MAX) break;
      }
    }
    return out;
  }, [items, deferred]);
  const openRef = useRef(false);
  const [, setOpen] = useState(false);
  return (
    <AriaComboBox
      className="react-aria-ComboBox datatable-reference-combobox"
      aria-label={label}
      items={matches}
      inputValue={text}
      onInputChange={onChange}
      allowsCustomValue
      allowsEmptyCollection
      onOpenChange={(open) => {
        openRef.current = open;
        setOpen(open);
      }}
      onSelectionChange={(key) => {
        if (key !== null && key !== undefined) onChange(String(key));
      }}
      isInvalid={invalid}
    >
      <div className="combobox-container">
        <Input
          ref={controlRef as (el: HTMLInputElement | null) => void}
          className="react-aria-Input"
          placeholder={placeholder}
          spellCheck={false}
          autoFocus={autoFocus}
          data-shortcut-local="undo redo"
          aria-describedby={errorId}
          onBlur={onBlur}
          onKeyDown={(e) => {
            // Enter with the list closed saves the form; with it open RAC picks the option.
            if (e.key === "Enter" && !openRef.current) {
              e.preventDefault();
              e.stopPropagation();
              onSubmit?.();
            }
          }}
        />
        <Button className="react-aria-Button" aria-label={label}>
          <ChevronDown size={iconProps.size} aria-hidden="true" />
        </Button>
      </div>
      <Popover className="react-aria-Popover property-select-popover datatable-reference-popover">
        <ListBox className="react-aria-ListBox">
          {(item: ReferenceItem) => (
            <ListBoxItem
              id={item.id}
              className="react-aria-ListBoxItem"
              textValue={item.id}
            >
              <span className="datatable-reference-key">{item.id}</span>
              {item.hint && (
                <span className="datatable-reference-hint">{item.hint}</span>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaComboBox>
  );
}
