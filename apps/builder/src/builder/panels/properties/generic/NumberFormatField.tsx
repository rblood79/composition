import { memo } from "react";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyNumberInput } from "../../../components/property/PropertyNumberInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { semanticLabelKeys, translateKey, useI18n } from "@/i18n";
import type { ResolvedField } from "@composition/shared";
import {
  CATALOG_CURRENCY_DISPLAYS,
  CATALOG_CURRENCY_SIGNS,
  CATALOG_ROUNDING_INCREMENTS,
  CATALOG_ROUNDING_MODES,
  CATALOG_ROUNDING_PRIORITIES,
  CATALOG_SIGN_DISPLAYS,
  CATALOG_TRAILING_ZERO_DISPLAYS,
  CATALOG_UNIT_DISPLAYS,
  catalogNumberFormatFits,
  type CatalogNumberFormat,
} from "../../../../../../../packages/shared/src/catalog/document/numberFormatValue";
import { useSelectionState } from "../../../components/property/propertySelection";

type Format = Record<string, string | number | boolean>;

/** A style switch starts with a value that formats (Intl needs a currency code · a unit). */
const STYLE_SEED: Readonly<Record<string, Format>> = {
  decimal: { style: "decimal" },
  percent: { style: "percent" },
  currency: { style: "currency", currency: "USD" },
  unit: { style: "unit", unit: "kilometer" },
};
const STYLE_KEYS: Readonly<Record<string, readonly string[]>> = {
  currency: ["currency", "currencyDisplay", "currencySign"],
  unit: ["unit", "unitDisplay"],
};

const LABELS: Readonly<Record<string, string>> = {
  symbol: "Symbol",
  narrowSymbol: "Narrow Symbol",
  code: "Code",
  name: "Name",
  standard: "Standard",
  accounting: "Accounting",
  short: "Short",
  long: "Long",
  narrow: "Narrow",
  auto: "Auto",
  never: "Never",
  always: "Always",
  exceptZero: "Except Zero",
  negative: "Negative",
  min2: "Min 2",
  ceil: "Ceil",
  floor: "Floor",
  expand: "Away From Zero",
  trunc: "Toward Zero",
  halfCeil: "Half Ceil",
  halfFloor: "Half Floor",
  halfExpand: "Half Expand",
  halfTrunc: "Half Trunc",
  halfEven: "Half Even",
  morePrecision: "More Precision",
  lessPrecision: "Less Precision",
  stripIfInteger: "Strip If Integer",
};
const optionsOf = (values: readonly string[]) =>
  values.map((value) => ({ value, label: LABELS[value] ?? value }));

/**
 * S2 · RAC `formatOptions` (NumberField · Meter · ProgressBar · Slider — 사용자 결정 2026-10-12):
 * one editor for the document's `numberFormat` object. Every change writes the whole object once
 * (a style change drops the other style's keys and seeds what Intl needs), only when it fits
 * (`catalogNumberFormatFits`); Default clears it (RAC's own default). A currency code · unit that
 * does not fit is shown as invalid and not written.
 */
export const NumberFormatField = memo(function NumberFormatField({
  field,
  value,
  onChange,
}: {
  field: ResolvedField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const label = (text: string) =>
    translateKey(t, semanticLabelKeys[text] ?? text, text);
  const format: CatalogNumberFormat = catalogNumberFormatFits(value)
    ? value
    : {};
  const style = format.style ?? "";
  // The refusal belongs to the element it was typed on (the field stays mounted across a selection
  // of the same type).
  const [invalid, setInvalid] = useSelectionState<string | null>(null);
  const write = (next: Format) => {
    if (Object.keys(next).length === 0) return onChange(undefined);
    // (A digit · rounding · sign · grouping key written at Default names the style it formats in —
    //  decimal — so the Format field shows it: Default is not decimal everywhere (a Meter ·
    //  ProgressBar's is percent).)
    const named = next.style === undefined ? { style: "decimal", ...next } : next;
    if (catalogNumberFormatFits(named)) onChange(named);
  };
  const withKey = (key: string, next: unknown) => {
    const out: Format = { ...(format as Format) };
    if (next === undefined || next === "") delete out[key];
    else out[key] = next as string | number | boolean;
    return out;
  };
  const textKey = (key: "currency" | "unit", text: string) => {
    const next = withKey(
      key,
      key === "currency" ? text.trim().toUpperCase() : text.trim(),
    );
    if (!catalogNumberFormatFits(next)) return setInvalid(key);
    setInvalid(null);
    onChange(next);
  };
  const invalidNote = (key: string) =>
    invalid === key ? (
      <span slot="description" role="alert" data-number-format-invalid="">
        {t("propertiesPanel.numberFormatInvalid")}
      </span>
    ) : undefined;

  return (
    <div className="number-format-field" data-number-format="">
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label={field.label}
          value={style}
          options={[
            { value: "", label: "Default" },
            { value: "decimal", label: "Decimal" },
            { value: "percent", label: "Percent" },
            { value: "currency", label: "Currency" },
            { value: "unit", label: "Unit" },
          ]}
          optionValueMode="literal"
          onChange={(next) => {
            setInvalid(null);
            if (next === style) return;
            if (!next) return onChange(undefined);
            const kept: Format = {};
            for (const [key, item] of Object.entries(format as Format))
              if (
                key !== "style" &&
                !Object.values(STYLE_KEYS).flat().includes(key)
              )
                kept[key] = item;
            write({ ...kept, ...STYLE_SEED[next] });
          }}
        />
      </div>
      {style === "currency" && (
        <>
          <div className="fieldset-row">
            <PropertyInput
              label={label("Currency")}
              value={format.currency ?? ""}
              onChange={(text) => textKey("currency", text)}
              afterControl={invalidNote("currency")}
            />
            <PropertySelect
              label="Currency Display"
              value={format.currencyDisplay ?? "symbol"}
              options={optionsOf(CATALOG_CURRENCY_DISPLAYS)}
              optionValueMode="literal"
              onChange={(next) =>
                write(
                  withKey(
                    "currencyDisplay",
                    next === "symbol" ? undefined : next,
                  ),
                )
              }
            />
          </div>
          <div className="fieldset-row">
            <PropertySelect
              label="Currency Sign"
              value={format.currencySign ?? "standard"}
              options={optionsOf(CATALOG_CURRENCY_SIGNS)}
              optionValueMode="literal"
              onChange={(next) =>
                write(
                  withKey(
                    "currencySign",
                    next === "standard" ? undefined : next,
                  ),
                )
              }
            />
          </div>
        </>
      )}
      {style === "unit" && (
        <div className="fieldset-row">
          <PropertyInput
            label={label("Unit")}
            value={format.unit ?? ""}
            onChange={(text) => textKey("unit", text)}
            afterControl={invalidNote("unit")}
          />
          <PropertySelect
            label="Unit Display"
            value={format.unitDisplay ?? "short"}
            options={optionsOf(CATALOG_UNIT_DISPLAYS)}
            optionValueMode="literal"
            onChange={(next) =>
              write(withKey("unitDisplay", next === "short" ? undefined : next))
            }
          />
        </div>
      )}
      {/* (Every other `Intl.NumberFormatOptions` key RAC's NumberParser reads back — shown at every
          style, Default too: digits, rounding, sign, grouping. Not `notation`: a compact ·
          scientific text does not parse back.) */}
      <div className="fieldset-row">
        <PropertyNumberInput
          label="Min Fraction Digits"
          value={format.minimumFractionDigits}
          allowEmpty
          min={0}
          max={20}
          step={1}
          onChange={(next) => write(withKey("minimumFractionDigits", next))}
        />
        <PropertyNumberInput
          label="Max Fraction Digits"
          value={format.maximumFractionDigits}
          allowEmpty
          min={0}
          max={20}
          step={1}
          onChange={(next) => write(withKey("maximumFractionDigits", next))}
        />
      </div>
      <div className="fieldset-row">
        <PropertyNumberInput
          label="Min Significant Digits"
          value={format.minimumSignificantDigits}
          allowEmpty
          min={1}
          max={21}
          step={1}
          onChange={(next) =>
            write(withKey("minimumSignificantDigits", next))
          }
        />
        <PropertyNumberInput
          label="Max Significant Digits"
          value={format.maximumSignificantDigits}
          allowEmpty
          min={1}
          max={21}
          step={1}
          onChange={(next) =>
            write(withKey("maximumSignificantDigits", next))
          }
        />
      </div>
      <div className="fieldset-row">
        <PropertyNumberInput
          label="Min Integer Digits"
          value={format.minimumIntegerDigits}
          allowEmpty
          min={1}
          max={21}
          step={1}
          onChange={(next) => write(withKey("minimumIntegerDigits", next))}
        />
        <PropertySelect
          label="Sign Display"
          value={format.signDisplay ?? "auto"}
          options={optionsOf(CATALOG_SIGN_DISPLAYS)}
          optionValueMode="literal"
          onChange={(next) =>
            write(withKey("signDisplay", next === "auto" ? undefined : next))
          }
        />
      </div>
      <div className="fieldset-row">
        <PropertySelect
          label="Rounding Mode"
          value={format.roundingMode ?? "halfExpand"}
          options={optionsOf(CATALOG_ROUNDING_MODES)}
          optionValueMode="literal"
          onChange={(next) =>
            write(
              withKey("roundingMode", next === "halfExpand" ? undefined : next),
            )
          }
        />
        <PropertySelect
          label="Rounding Priority"
          value={format.roundingPriority ?? "auto"}
          options={optionsOf(CATALOG_ROUNDING_PRIORITIES)}
          optionValueMode="literal"
          onChange={(next) =>
            write(
              withKey("roundingPriority", next === "auto" ? undefined : next),
            )
          }
        />
      </div>
      <div className="fieldset-row">
        <PropertySelect
          label="Rounding Increment"
          value={String(format.roundingIncrement ?? 1)}
          options={CATALOG_ROUNDING_INCREMENTS.map((step) => ({
            value: String(step),
            label: String(step),
          }))}
          optionValueMode="literal"
          onChange={(next) => {
            const step = Number(next);
            if (step === 1) return write(withKey("roundingIncrement", undefined));
            // (Intl: an increment rounds whole fraction digits — min = max, no significant digits
            //  and priority `auto` — so the step fixes them, as RAC's NumberParser does.)
            const digits =
              format.maximumFractionDigits ?? format.minimumFractionDigits ?? 0;
            const out: Format = { ...(format as Format), roundingIncrement: step };
            out.minimumFractionDigits = digits;
            out.maximumFractionDigits = digits;
            delete out.minimumSignificantDigits;
            delete out.maximumSignificantDigits;
            delete out.roundingPriority;
            write(out);
          }}
        />
        <PropertySelect
          label="Trailing Zeros"
          value={format.trailingZeroDisplay ?? "auto"}
          options={optionsOf(CATALOG_TRAILING_ZERO_DISPLAYS)}
          optionValueMode="literal"
          onChange={(next) =>
            write(
              withKey("trailingZeroDisplay", next === "auto" ? undefined : next),
            )
          }
        />
      </div>
      <div className="fieldset-row" data-wide="true">
        <PropertySelect
          label="Grouping"
          value={
            format.useGrouping === false
              ? "off"
              : format.useGrouping === true
                ? "always"
                : (format.useGrouping ?? "auto")
          }
          options={[
            { value: "auto", label: "Auto" },
            { value: "always", label: "Always" },
            { value: "min2", label: "Min 2" },
            { value: "off", label: "Off" },
          ]}
          optionValueMode="literal"
          onChange={(next) =>
            write(
              withKey(
                "useGrouping",
                next === "auto" ? undefined : next === "off" ? false : next,
              ),
            )
          }
        />
      </div>
    </div>
  );
});
