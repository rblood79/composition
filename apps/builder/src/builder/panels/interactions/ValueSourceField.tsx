/**
 * ADR-281 Decision 2 — 값 칸의 소스: 「리터럴 / 이벤트 인자」.
 *
 * 이벤트 인자 목록은 When 이 선언한 `args` (등록표 `eventArgs` — RAC d.ts 인자 이름) 이고,
 * 고른 값은 지금처럼 문자열 `"!event.<arg>"` 로 저장한다 (스키마 0). When 에 인자가 없으면
 * 소스 칸 없이 리터럴 칸만 — 기존 `ParamField` 그대로.
 */
import { memo } from "react";
import type { CapabilityParam } from "@composition/shared";

import { PropertySelect } from "../../components/property/PropertySelect";
import { ParamField } from "./ParamField";
import { useI18n } from "@/i18n";

const EVENT_PREFIX = "!event.";

interface ValueSourceFieldProps {
  param: CapabilityParam;
  value: unknown;
  /** The When's argument names (`eventArgsOf(type, trigger)`). */
  eventArgs: readonly string[];
  onChange: (value: unknown) => void;
}

export const ValueSourceField = memo(function ValueSourceField({
  param,
  value,
  eventArgs,
  onChange,
}: ValueSourceFieldProps) {
  const { t } = useI18n();
  const eventArg =
    typeof value === "string" && value.startsWith(EVENT_PREFIX)
      ? value.slice(EVENT_PREFIX.length)
      : undefined;
  if (!eventArgs.length && eventArg === undefined)
    return <ParamField param={param} value={value} onChange={onChange} />;
  const names =
    eventArg !== undefined && !eventArgs.includes(eventArg)
      ? [eventArg, ...eventArgs]
      : eventArgs;
  return (
    <>
      <PropertySelect
        label={t("interactions.valueSource")}
        value={eventArg === undefined ? "literal" : "event"}
        onChange={(source) => {
          if (source === "event" && eventArg === undefined)
            onChange(`${EVENT_PREFIX}${names[0]}`);
          else if (source === "literal" && eventArg !== undefined)
            onChange(param.kind === "number" ? 0 : "");
        }}
        options={[
          { value: "literal", label: t("interactions.valueSourceLiteral") },
          { value: "event", label: t("interactions.valueSourceEvent") },
        ]}
        translateOptions={false}
      />
      {eventArg === undefined ? (
        <ParamField param={param} value={value} onChange={onChange} />
      ) : (
        <PropertySelect
          label={t("interactions.eventArgument")}
          value={eventArg}
          onChange={(name) => onChange(`${EVENT_PREFIX}${name}`)}
          options={names.map((name) => ({ value: name, label: name }))}
          translateOptions={false}
        />
      )}
    </>
  );
});
