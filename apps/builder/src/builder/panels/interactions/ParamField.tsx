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
import { memo } from "react";
import type { CapabilityParam } from "@composition/shared";

import { PropertyInput } from "../../components/property/PropertyInput";

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
  const isNumber = param.kind === "number";

  return (
    <PropertyInput
      label={param.label}
      type={isNumber ? "number" : "text"}
      value={
        value === undefined || value === null ? "" : (value as string | number)
      }
      onChange={(next) => onChange(isNumber ? Number(next) : next)}
    />
  );
});
