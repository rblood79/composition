import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { PropertyNumberInput } from "../../../components/property/PropertyNumberInput";
import {
  catalogLabeledValueFits,
  catalogLabeledFormatFits,
  type LabeledValue,
} from "../../../../../../../packages/shared/src/catalog/document/labeledValue";

type Props = {
  label: string;
  value: unknown;
  format?: boolean;
  onChange: (value: unknown) => void;
};
const date = (kind: "date" | "datetime" | "time", value: string) => ({
  kind,
  value,
});
const seeds: Record<string, LabeledValue> = {
  text: "Value",
  number: 0,
  list: ["First", "Second"],
  range: { start: 0, end: 100 },
  date: date("date", "2026-01-01"),
  datetime: date("datetime", "2026-01-01T12:00:00Z"),
  time: date("time", "12:00"),
  dateRange: {
    start: date("date", "2026-01-01"),
    end: date("date", "2026-01-07"),
  },
};
const valueOptions = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "list", label: "List" },
  { value: "range", label: "Number range" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date and time" },
  { value: "time", label: "Time" },
  { value: "dateRange", label: "Date range" },
];
const formatOptions = [
  { value: "default", label: "Default" },
  { value: "decimal", label: "Number" },
  { value: "percent", label: "Percent" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "list", label: "List" },
];
function kindOf(value: unknown): string {
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "list";
  if (value && typeof value === "object") {
    if ("kind" in value) return String(value.kind);
    if ("start" in value)
      return typeof value.start === "number" ? "range" : "dateRange";
  }
  return "text";
}
function LabeledFormatField({ value, onChange }: Props) {
  const opts = catalogLabeledFormatFits(value) ? { ...value } : {};
  const text = (key: string) => {
    const entry = Object.entries(opts).find(([name]) => name === key)?.[1];
    return typeof entry === "string" ? entry : undefined;
  };
  const change = (key: string, next: string) => {
    const result: Record<string, unknown> = { ...opts };
    if (next) result[key] = next;
    else delete result[key];
    if (catalogLabeledFormatFits(result)) onChange(result);
  };
  return (
    <>
      <PropertySelect
        label="Format"
        value={
          text("dateStyle")
            ? "date"
            : text("timeStyle")
              ? "time"
              : text("type")
                ? "list"
                : (text("style") ?? "default")
        }
        options={formatOptions}
        onChange={(key) =>
          onChange(
            key === "default"
              ? undefined
              : key === "date"
                ? { dateStyle: "long" }
                : key === "time"
                  ? { timeStyle: "short" }
                  : key === "list"
                    ? { type: "conjunction", style: "long" }
                    : key === "currency"
                      ? { style: "currency", currency: "USD" }
                      : { style: key },
          )
        }
      />
      {text("style") === "currency" && (
        <PropertyInput
          label="Currency"
          value={text("currency") ?? "USD"}
          onChange={(v) => change("currency", v.toUpperCase())}
        />
      )}
      {(text("dateStyle") || text("timeStyle")) && (
        <PropertySelect
          label="Detail"
          value={text("dateStyle") ?? text("timeStyle") ?? ""}
          options={["short", "medium", "long", "full"].map((value) => ({
            value,
            label: value,
          }))}
          onChange={(v) =>
            change(text("dateStyle") ? "dateStyle" : "timeStyle", String(v))
          }
        />
      )}
      {text("type") && (
        <PropertySelect
          label="List type"
          value={text("type") ?? "conjunction"}
          options={["conjunction", "disjunction", "unit"].map((value) => ({
            value,
            label: value,
          }))}
          onChange={(v) => change("type", String(v))}
        />
      )}
    </>
  );
}
/** Value editors use semantic choices; dates use explicit serializable records. */
export function LabeledValueField(props: Props) {
  const { label, value, format, onChange } = props;
  const write = (next: unknown) => {
    if (catalogLabeledValueFits(next)) onChange(next);
  };
  if (format) return <LabeledFormatField {...props} />;
  const kind = kindOf(value);
  const range =
    value && typeof value === "object" && "start" in value && "end" in value
      ? value
      : undefined;
  const display =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "value" in value
        ? String(value.value)
        : "";
  return (
    <>
      <PropertySelect
        label="Value type"
        value={kind}
        options={valueOptions}
        onChange={(key) => write(seeds[String(key)])}
      />
      {kind === "number" ? (
        <PropertyNumberInput
          label={label}
          value={Number(value)}
          onChange={write}
        />
      ) : kind === "range" && range ? (
        <>
          <PropertyNumberInput
            label="Start"
            value={Number(range.start)}
            onChange={(v) => write({ ...range, start: v })}
          />
          <PropertyNumberInput
            label="End"
            value={Number(range.end)}
            onChange={(v) => write({ ...range, end: v })}
          />
        </>
      ) : kind === "list" ? (
        <PropertyInput
          label={label}
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(v) => write(v.split(",").map((s) => s.trim()))}
        />
      ) : kind === "dateRange" && range ? (
        <>
          <PropertyInput
            label="Start"
            value={(range.start as { value: string }).value}
            onChange={(v) => write({ ...range, start: date("date", v) })}
          />
          <PropertyInput
            label="End"
            value={(range.end as { value: string }).value}
            onChange={(v) => write({ ...range, end: date("date", v) })}
          />
        </>
      ) : (
        <PropertyInput
          label={label}
          value={display}
          onChange={(v) =>
            write(
              kind === "text"
                ? v
                : date(kind as "date" | "datetime" | "time", v),
            )
          }
        />
      )}
    </>
  );
}
