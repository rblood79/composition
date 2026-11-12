/**
 * ADR-158 Phase 2 — 값이 필요한 동작의 인자 입력.
 *
 * 세 갈래뿐이다:
 * - navigate → 경로
 * - toast → 메시지
 * - capability 중 `param` 이 선언된 것 (selectItem / setValue / selectTab …)
 *
 * `param` 이 없는 capability (clearSelection / hide / open …) 는 아무것도 렌더하지
 * 않는다 — "설정할 게 없다" 가 정상 상태다.
 */
import { lazy, memo, Suspense } from "react";
import type { CapabilityParam } from "@composition/shared";

import { PropertyInput } from "../../components/property/PropertyInput";
import { NumberRangeField } from "../properties/generic/NumberRangeField";
// (ADR-309 — the date inputs load with their first use, G3 c.)
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
import { useI18n } from "@/i18n";

interface ParamFieldProps {
  param: CapabilityParam;
  value: unknown;
  onChange: (value: unknown) => void;
}

export const ParamField = memo(function ParamField({
  param,
  value,
  onChange,
}: ParamFieldProps) {
  const { t } = useI18n();
  const isNumber = param.kind === "number";
  if (param.kind === "number-range")
    return (
      <NumberRangeField
        label={t(param.labelKey)}
        value={value}
        onChange={onChange}
      />
    );
  // (ADR-309 Decision 7 — a date · a range, the Design panel's date input.)
  if (param.kind === "date")
    return (
      <Suspense fallback={null}>
        <DateValueField
          label={t(param.labelKey)}
          value={value}
          emptyType="date"
          onChange={(next) => onChange(next ?? "")}
        />
      </Suspense>
    );
  if (param.kind === "date-range")
    return (
      <Suspense fallback={null}>
        <DateRangeField
          label={t(param.labelKey)}
          value={value}
          emptyType="date"
          onChange={onChange}
        />
      </Suspense>
    );

  return (
    <PropertyInput
      label={t(param.labelKey)}
      type={isNumber ? "number" : "text"}
      value={
        value === undefined || value === null ? "" : (value as string | number)
      }
      onChange={(next) => onChange(isNumber ? Number(next) : next)}
    />
  );
});
