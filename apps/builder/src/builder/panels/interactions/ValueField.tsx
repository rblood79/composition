/**
 * A rule's Value field — a literal, or a source picked from 「값 고르기」 (Figma · Framer bind a
 * property to a source; nobody types a path). The list is the rule's own: its When's arguments, the
 * selected item's fields (a bound owner's `keys`), the variables in reach (`valueOptions.ts`).
 * A picked source shows as a chip; the stored value is a whole-value reference (`valueRef.ts`),
 * so a row stays an object. A source whose shape does not fit the slot's type says so.
 */
import { memo, useMemo, useState } from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Button as RACButton } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Header } from "react-aria-components/Header";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { useFilter } from "react-aria-components";
import { Braces, X } from "lucide-react";
import { parseRuleValueRef } from "@composition/shared";

import { PropertyFieldset } from "../../components/property/PropertyFieldset";
import { PropertyIconPicker } from "../../components/property/PropertyIconPicker";
import { PropertyInput } from "../../components/property/PropertyInput";
import { PropertySelect } from "../../components/property/PropertySelect";
import { SearchField } from "../../components/ui/SearchField";
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
  kind: "text" | "number" | "boolean" | "icon";
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
  const { contains } = useFilter({ sensitivity: "base" });
  const options = useMemo(() => catalogValueOptions(sources), [sources]);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <RACButton
        className="react-aria-Button interactions-value-pick"
        aria-label={`${label}: ${t("interactions.valuePick")}`}
        isDisabled={!options.length}
      >
        <Braces aria-hidden="true" size={14} />
      </RACButton>
      <Popover
        className="react-aria-Popover property-select-popover interactions-target-popover"
        placement="bottom end"
      >
        <Dialog
          className="interactions-target-dialog"
          aria-label={t("interactions.valuePick")}
        >
          <Autocomplete filter={contains}>
            <SearchField
              appearance="control"
              autoFocus
              placeholder={t("interactions.valueSearch")}
              aria-label={t("interactions.valueSearch")}
            />
            <ListBox
              aria-label={t("interactions.valuePick")}
              className="react-aria-ListBox interactions-target-list"
              onAction={(key) => {
                onPick(String(key));
                setOpen(false);
              }}
            >
              {GROUPS.map((group) => {
                const items = options.filter(
                  (option) => option.group === group,
                );
                return items.length ? (
                  <ListBoxSection key={group}>
                    <Header className="interactions-target-header">
                      {t(GROUP_LABEL[group])}
                    </Header>
                    {items.map((option) => {
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
                          <span className="interactions-value-option-name">
                            {name}
                          </span>
                          {option.type && (
                            <span className="interactions-value-option-type">
                              {option.type}
                            </span>
                          )}
                        </ListBoxItem>
                      );
                    })}
                  </ListBoxSection>
                ) : null;
              })}
            </ListBox>
          </Autocomplete>
        </Dialog>
      </Popover>
    </DialogTrigger>
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
            onChange(kind === "number" ? 0 : kind === "boolean" ? false : "")
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
