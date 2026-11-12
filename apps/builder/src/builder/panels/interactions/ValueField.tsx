/**
 * A rule's Value field — a literal, or a source picked from 「값 고르기」 (Figma · Framer bind a
 * property to a source; nobody types a path). The list is the rule's own: its When's arguments, the
 * selected item's fields (a bound owner's `keys`), the variables in reach (`valueOptions.ts`).
 * A picked source shows as a chip; the stored value is a whole-value reference (`valueRef.ts`),
 * so a row stays an object. A source whose shape does not fit the slot's type says so.
 */
import { lazy, memo, Suspense, useMemo, useState } from "react";
import { Button as RACButton } from "react-aria-components/Button";
import { ListBoxItem } from "react-aria-components/ListBox";
import { Braces, X } from "lucide-react";
import { parseRuleValueRef } from "@composition/shared";

import { PropertyFieldset } from "../../components/property/PropertyFieldset";
import { PropertyIconPicker } from "../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../components/property/PropertyInput";
import { NumberRangeField } from "../properties/generic/NumberRangeField";
// (ADR-309 — the date inputs load with their first use: not on a first screen, G3 c.)
const DateValueField = lazy(() =>
  import("../properties/generic/DateValueFields").then((module) => ({
    default: module.DateValueField,
  })),
);
const DateRangeField = lazy(() =>
  import("../properties/generic/DateValueFields").then((module) => ({
    default: module.DateRangeField,
  })),
);
import { PropertySelect } from "../../components/property/PropertySelect";
import {
  SearchablePicker,
  SearchablePickerSection,
} from "../../components/property/SearchablePicker";
import { useI18n } from "@/i18n";
import {
  catalogValueFits,
  catalogValueOptionOf,
  catalogValueOptions,
  type CatalogValueGroup,
  type CatalogValueOption,
  type CatalogValueSources,
  type CatalogValueType,
} from "./valueOptions";
import "./ValueField.css";

const GROUPS: readonly CatalogValueGroup[] = ["event", "item", "variable"];
const GROUP_LABEL = {
  event: "interactions.valueGroupEvent",
  item: "interactions.valueGroupItem",
  variable: "interactions.valueGroupVariable",
} as const;

interface ValueFieldProps {
  label: string;
  /** The literal's input kind (ADR-287 — `icon`: an icon name from the icon picker). */
  kind:
    | "text"
    | "number"
    | "number-range"
    | "boolean"
    | "icon"
    // ADR-309 Decision 7 — a date · time (`emptyType` — the picker an empty value opens) · a range.
    | "date"
    | "date-range";
  emptyType?: "date" | "datetime-local" | "time";
  /** ADR-287 — a `choice` slot's values (the catalog's): the literal is one of them. */
  choices?: readonly { value: string; label: string }[];
  value: unknown;
  onChange: (value: unknown) => void;
  sources: CatalogValueSources;
  /** The slot's type (a variable's): a source of another shape is flagged. */
  expectedType?: CatalogValueType;
}

/** A source's text: its group, then its name (`이번 이벤트 › keys` · `선택한 항목 › name`). */
function useOptionText() {
  const { t } = useI18n();
  return (option: CatalogValueOption) =>
    [
      t(GROUP_LABEL[option.group]),
      option.name ||
        (option.group === "item" ? t("interactions.valueItemWhole") : ""),
    ]
      .filter(Boolean)
      .join(" › ");
}

/** The 「값 고르기」 button and its searchable list of the rule's sources. */
function ValuePicker({
  label,
  sources,
  onPick,
}: {
  label: string;
  sources: CatalogValueSources;
  onPick: (value: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => catalogValueOptions(sources), [sources]);
  return (
    <SearchablePicker
      label={t("interactions.valuePick")}
      searchLabel={t("interactions.valueSearch")}
      open={open}
      onOpenChange={setOpen}
      placement="bottom end"
      popoverClassName="interactions-target-popover"
      listClassName="interactions-target-list"
      onAction={(key) => {
        onPick(String(key));
        setOpen(false);
      }}
      trigger={
        <RACButton
          className="react-aria-Button interactions-value-pick"
          aria-label={`${label}: ${t("interactions.valuePick")}`}
          isDisabled={!options.length}
        >
          <Braces aria-hidden="true" size={14} />
        </RACButton>
      }
    >
      {GROUPS.map((group) => (
        <SearchablePickerSection
          key={group}
          id={group}
          title={t(GROUP_LABEL[group])}
        >
          {options
            .filter((option) => option.group === group)
            .map((option) => {
              const name =
                option.name ||
                (option.group === "item"
                  ? t("interactions.valueItemWhole")
                  : "");
              return (
                <ListBoxItem
                  key={option.value}
                  id={option.value}
                  textValue={`${t(GROUP_LABEL[group])} ${name}`}
                  className="react-aria-ListBoxItem interactions-value-option"
                  data-nested={option.nested || undefined}
                >
                  <span className="interactions-value-option-name">{name}</span>
                  {option.type && (
                    <span className="interactions-value-option-type">
                      {option.type}
                    </span>
                  )}
                </ListBoxItem>
              );
            })}
        </SearchablePickerSection>
      ))}
    </SearchablePicker>
  );
}

export const ValueField = memo(function ValueField({
  label,
  kind,
  choices,
  value,
  onChange,
  sources,
  expectedType,
  emptyType = "date",
}: ValueFieldProps) {
  const { t } = useI18n();
  const text = useOptionText();
  const picked = parseRuleValueRef(value)
    ? catalogValueOptionOf(value, sources)
    : undefined;
  const picker = (
    <ValuePicker label={label} sources={sources} onPick={onChange} />
  );
  if (picked) {
    const fits = catalogValueFits(picked, expectedType);
    return (
      <PropertyFieldset
        legend={label}
        className="interactions-value-field"
        afterControl={
          fits ? undefined : (
            <div
              className="interactions-target-notice"
              role="status"
              data-tone="warning"
            >
              {t("interactions.valueTypeMismatch", {
                actual: picked.type ?? "",
                expected: expectedType ?? "",
              })}
            </div>
          )
        }
      >
        <span className="interactions-value-chip" data-group={picked.group}>
          {text(picked)}
        </span>
        <RACButton
          className="react-aria-Button interactions-value-pick"
          aria-label={`${label}: ${t("interactions.valueClear")}`}
          onPress={() =>
            onChange(
              kind === "number-range"
                ? { start: 0, end: 100 }
                : kind === "date-range"
                  ? undefined
                  : kind === "number"
                    ? 0
                    : kind === "boolean"
                      ? false
                      : "",
            )
          }
        >
          <X aria-hidden="true" size={14} />
        </RACButton>
        {picker}
      </PropertyFieldset>
    );
  }
  if (choices)
    return (
      <PropertySelect
        label={label}
        value={typeof value === "string" ? value : ""}
        onChange={(next) => onChange(next)}
        options={[...choices]}
        translateOptions={false}
        afterControl={<div className="interactions-value-after">{picker}</div>}
      />
    );
  if (kind === "number-range")
    return (
      <div>
        <NumberRangeField label={label} value={value} onChange={onChange} />
        {picker}
      </div>
    );
  // ADR-309 Decision 7 (사용자 결정 4) — the Design panel's date input (`DateValueFields`).
  if (kind === "date")
    return (
      <div className="interactions-value-date">
        <Suspense fallback={null}>
          <DateValueField
            label={label}
            value={value}
            emptyType={emptyType}
            onChange={(next) => onChange(next ?? "")}
          />
        </Suspense>
        {picker}
      </div>
    );
  if (kind === "date-range")
    return (
      <div className="interactions-value-date">
        <Suspense fallback={null}>
          <DateRangeField
            label={label}
            value={value}
            emptyType={emptyType}
            onChange={onChange}
          />
        </Suspense>
        {picker}
      </div>
    );
  if (kind === "icon")
    return (
      <PropertyIconPicker
        label={label}
        value={typeof value === "string" ? value : undefined}
        onChange={(name) => onChange(name)}
        onClear={() => onChange("")}
      />
    );
  if (kind === "boolean")
    return (
      <PropertySelect
        label={label}
        value={value === true ? "true" : "false"}
        onChange={(next) => onChange(next === "true")}
        options={[
          { value: "true", label: "true" },
          { value: "false", label: "false" },
        ]}
        translateOptions={false}
        afterControl={<div className="interactions-value-after">{picker}</div>}
      />
    );
  return (
    <PropertyInput
      label={label}
      type={kind === "number" ? "number" : "text"}
      value={
        value === undefined || value === null ? "" : (value as string | number)
      }
      onChange={(next) => onChange(kind === "number" ? Number(next) : next)}
      endControl={picker}
    />
  );
});
