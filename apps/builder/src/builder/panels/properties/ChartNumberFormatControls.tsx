import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { memo } from "react";
import { useOwnedState } from "./useOwnedState";
import {
  CHART_CURRENCY_CANDIDATES,
  type ChartPercentUnit,
  type ChartValueFormat,
  type ChartValueLocale,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertyNumberInput, PropertySelect } from "../../components";
import { useI18n } from "@/i18n";

const LOCALES: readonly ChartValueLocale[] = ["en-US", "ko-KR"];

/**
 * ADR-210 P2 — 숫자 형식 (Auto / Decimal / Currency / Percent · locale · 소수 자릿수).
 *
 * breakdown §4.1: currency 는 통화 코드, percent 는 입력 단위를 **같이 골라야** 저장된다
 * — 형식만 먼저 쓰면 specs validator 가 `valueCurrency.missing` 설정 오류를 낸다. 그래서
 * 두 형식은 필요한 값까지 묶어 한 patch 로 Apply 하고, 취소는 write 0 이다. Auto 는 나머지
 * 옵션을 숨기되 저장된 휴면 설정 (통화·단위·자릿수) 은 지우지 않는다.
 *
 * 자리는 Appearance 섹션 말미 — 레퍼런스 (Recharts `tickFormatter`/`Tooltip.formatter`/
 * `Bar.unit`, shadcn `formatter`) 에서 값 형식은 축·툴팁·시리즈에 붙는 표시 속성이지
 * 데이터가 아니다. 문단 안내 없이 자리 자체가 "문자열만 바꾼다" 를 말한다.
 */
export const ChartNumberFormatControls = memo(
  function ChartNumberFormatControls({
    elementId = "",
    fields,
    onPatch,
  }: {
    /** 로컬 상태 (pending 통화/단위) 의 소유 요소 — 요소가 바뀌면 초기화 */
    elementId?: string;
    fields: ResolvedField[];
    onPatch: (patch: Record<string, unknown>) => void;
  }) {
    const { t } = useI18n();
    const props = Object.fromEntries(
      fields.map((field) => [field.key, field.currentValue]),
    ) as Record<string, unknown>;
    const format: ChartValueFormat =
      props.valueFormat === "decimal" ||
      props.valueFormat === "currency" ||
      props.valueFormat === "percent"
        ? props.valueFormat
        : "auto";
    const [pending, setPending] = useOwnedState<"currency" | "percent" | null>(
      elementId,
      null,
    );
    // 사용자가 고르기 전에는 요소의 저장값 (휴면 포함) 을 보여 준다 — 아래 `||` 폴백.
    const [pendingCurrencyState, setPendingCurrency] = useOwnedState<string>(
      elementId,
      "",
    );
    const [pendingUnitState, setPendingUnit] = useOwnedState<
      ChartPercentUnit | ""
    >(elementId, "");
    const savedCurrency =
      typeof props.valueCurrency === "string" ? props.valueCurrency : "";
    const savedUnit: ChartPercentUnit | "" =
      props.valuePercentUnit === "ratio" ||
      props.valuePercentUnit === "percentagePoints"
        ? props.valuePercentUnit
        : "";
    const pendingCurrency = pendingCurrencyState || savedCurrency;
    const pendingUnit = pendingUnitState || savedUnit;

    const formatOptions = [
      { value: "auto", label: t("chart.formatAuto") },
      { value: "decimal", label: t("chart.formatDecimal") },
      { value: "currency", label: t("chart.formatCurrency") },
      { value: "percent", label: t("chart.formatPercent") },
    ];
    const unitOptions = [
      { value: "ratio", label: t("chart.unitRatio") },
      { value: "percentagePoints", label: t("chart.unitPoints") },
    ];
    const currencyOptions = Array.from(
      new Set([
        ...CHART_CURRENCY_CANDIDATES,
        ...(typeof props.valueCurrency === "string"
          ? [props.valueCurrency]
          : []),
      ]),
    ).map((code) => ({ value: code, label: code }));

    const locale =
      typeof props.valueLocale === "string" &&
      (LOCALES as readonly string[]).includes(props.valueLocale)
        ? props.valueLocale
        : "en-US";

    return (
      <>
        <PropertySelect
          label={t("chart.numberFormat")}
          value={pending ?? format}
          options={formatOptions}
          translateOptions={false}
          onChange={(value) => {
            if (value === "currency" || value === "percent") {
              // 이미 필요한 값이 저장돼 있으면 묶음 없이 형식만 바꾼다 (휴면 값 재사용).
              const ready =
                value === "currency"
                  ? typeof props.valueCurrency === "string"
                  : props.valuePercentUnit === "ratio" ||
                    props.valuePercentUnit === "percentagePoints";
              if (ready) {
                if (value !== format) onPatch({ valueFormat: value });
                setPending(null);
                return;
              }
              setPending(value);
              return;
            }
            setPending(null);
            if (value !== format) onPatch({ valueFormat: value });
          }}
        />
        {pending === "currency" && (
          <>
            <PropertySelect
              label={t("chart.currencyCode")}
              value={pendingCurrency}
              options={currencyOptions}
              translateOptions={false}
              optionValueMode="literal"
              onChange={setPendingCurrency}
            />
            <div className="chart-actions">
              <Button
                type="button"
                className="control-button"
                data-variant="primary"
                isDisabled={pendingCurrency === ""}
                onPress={() => {
                  onPatch({
                    valueFormat: "currency",
                    valueCurrency: pendingCurrency,
                  });
                  setPending(null);
                }}
              >
                {t("common.apply")}
              </Button>
              <Button
                type="button"
                className="control-button"
                onPress={() => setPending(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </>
        )}
        {pending === "percent" && (
          <>
            <PropertySelect
              label={t("chart.percentUnit")}
              value={pendingUnit}
              options={unitOptions}
              translateOptions={false}
              onChange={(value) => setPendingUnit(value as ChartPercentUnit)}
            />
            <div className="chart-actions">
              <Button
                type="button"
                className="control-button"
                data-variant="primary"
                isDisabled={pendingUnit === ""}
                onPress={() => {
                  onPatch({
                    valueFormat: "percent",
                    valuePercentUnit: pendingUnit,
                  });
                  setPending(null);
                }}
              >
                {t("common.apply")}
              </Button>
              <Button
                type="button"
                className="control-button"
                onPress={() => setPending(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </>
        )}
        {format !== "auto" && pending === null && (
          <>
            {format === "currency" && (
              <PropertySelect
                label={t("chart.currencyCode")}
                value={
                  typeof props.valueCurrency === "string"
                    ? props.valueCurrency
                    : ""
                }
                options={currencyOptions}
                translateOptions={false}
                optionValueMode="literal"
                onChange={(code) => onPatch({ valueCurrency: code })}
              />
            )}
            {format === "percent" && (
              <PropertySelect
                label={t("chart.percentUnit")}
                value={
                  props.valuePercentUnit === "ratio" ||
                  props.valuePercentUnit === "percentagePoints"
                    ? props.valuePercentUnit
                    : ""
                }
                options={unitOptions}
                translateOptions={false}
                onChange={(unit) => onPatch({ valuePercentUnit: unit })}
              />
            )}
            <PropertySelect
              label={t("chart.numberLocale")}
              value={locale}
              options={LOCALES.map((code) => ({ value: code, label: code }))}
              translateOptions={false}
              onChange={(code) => onPatch({ valueLocale: code })}
            />
            <PropertyNumberInput
              label={t("chart.fractionDigits")}
              value={
                typeof props.valueFractionDigits === "number"
                  ? props.valueFractionDigits
                  : undefined
              }
              min={0}
              max={6}
              step={1}
              onChange={(digits) =>
                onPatch({
                  valueFractionDigits:
                    digits === undefined ? undefined : Math.round(digits),
                })
              }
            />
          </>
        )}
      </>
    );
  },
);
