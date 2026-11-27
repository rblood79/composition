/**
 * ADR-320 Phase 5 (§5.9) — a filter bar Do's argument: 「조건 넣기」's condition (a field the bar
 * offers · a comparison of that field's kind · its value — a literal or a value reference such as
 * `!event.value`) and 「조건 지우기」's field. The fields are the target bar's (`catalogFilterBarFields`
 * — what its chips offer).
 */
import { memo } from "react";
import { useI18n } from "@/i18n";
import type { ViewComparison } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  VIEW_COMPARISONS_BY_KIND,
  viewFieldKind,
} from "../../../../../../packages/shared/src/collections/view/comparison";
import { PropertyInput } from "../../components/property/PropertyInput";
import { PropertySelect } from "../../components/property/PropertySelect";

export interface FilterDoFieldOption {
  readonly id: string;
  readonly label: string;
  readonly type?: string;
  readonly hidden: boolean;
}

const VALUELESS: readonly ViewComparison[] = ["exists", "notExists"];

export const FilterDoField = memo(function FilterDoField({
  kind,
  fields,
  value,
  onChange,
}: {
  kind: "filter-condition" | "filter-field";
  fields: readonly FilterDoFieldOption[];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const offered = fields.filter((field) => !field.hidden);
  const fieldSelect = (selected: string, pick: (id: string) => void) => (
    <PropertySelect
      label={t("filterBar.field")}
      value={selected}
      options={offered.map((field) => ({
        value: field.id,
        label: field.label,
      }))}
      translateOptions={false}
      onChange={pick}
    />
  );
  if (kind === "filter-field")
    return fieldSelect(typeof value === "string" ? value : "", onChange);
  const condition =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { field?: string; op?: ViewComparison; value?: unknown })
      : {};
  const field = offered.find((item) => item.id === condition.field);
  const ops = VIEW_COMPARISONS_BY_KIND[viewFieldKind(field?.type)];
  const write = (patch: typeof condition) => {
    const next = { ...condition, ...patch };
    onChange(
      Object.fromEntries(
        Object.entries(next).filter(([, cell]) => cell !== undefined),
      ),
    );
  };
  return (
    <>
      {fieldSelect(condition.field ?? "", (id) => {
        const kindOf = viewFieldKind(
          offered.find((item) => item.id === id)?.type,
        );
        const op =
          condition.op &&
          VIEW_COMPARISONS_BY_KIND[kindOf].includes(condition.op)
            ? condition.op
            : VIEW_COMPARISONS_BY_KIND[kindOf][0];
        write({ field: id, op });
      })}
      {field ? (
        <PropertySelect
          label={t("filterBar.comparison")}
          value={condition.op ?? ops[0]!}
          options={ops.map((op) => ({
            value: op,
            label: t(`dataView.op_${op}`),
          }))}
          translateOptions={false}
          onChange={(op) =>
            write({
              op: op as ViewComparison,
              ...(VALUELESS.includes(op as ViewComparison)
                ? { value: undefined }
                : {}),
            })
          }
        />
      ) : null}
      {field && !VALUELESS.includes(condition.op ?? ops[0]!) ? (
        <PropertyInput
          label={t("filterBar.value")}
          value={condition.value === undefined ? "" : String(condition.value)}
          onChange={(text) => {
            const number =
              viewFieldKind(field.type) === "number" &&
              text.trim() !== "" &&
              Number.isFinite(Number(text));
            write({
              value:
                text === ""
                  ? undefined
                  : number
                    ? Number(text)
                    : viewFieldKind(field.type) === "boolean" &&
                        (text === "true" || text === "false")
                      ? text === "true"
                      : text,
            });
          }}
        />
      ) : null}
    </>
  );
});
