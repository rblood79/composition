/**
 * ADR-210 — 시리즈 표시·숫자 형식 설정의 **검증·정규화·표시 문자열** (순수 모듈).
 *
 * 저장 props 의 새 선택 필드 (`dataMode`·`valueFields`·`seriesConfig`·`value*`) 는
 * 노코드 사용자와 import/외부 patch 가 쓰는 임의 값이다. 여기서 한 번 읽어
 * `{ normalized, diagnostics }` 로 접고, 집계 (`series.ts`)·기하 (`computeChartScene`)·
 * runtime 모델 (`runtimeData.ts`) 이 **같은 정규화 결과**를 소비한다 — 각자 읽으면
 * Canvas 와 DOM 이 다른 설정을 본다.
 *
 * 규칙 (breakdown §2·§3):
 * - 원본 node 를 고치지 않는다. 중복은 first-wins + 진단, 잘못된 타입/형식은 **설정
 *   오류** (error) 이고 조용히 다른 뜻으로 렌더하지 않는다.
 * - `auto`/미설정 형식은 기존 `formatTick` 문자열 그대로다. 새 형식은 raw 값에만
 *   적용하고 expand 축의 정규화 값 (`normalizedPercent`) 은 항상 퍼센트다.
 * - Recharts 를 import 하지 않는다 (Builder initial 번들에 실리면 안 된다).
 */
import { formatTick } from "./scales";
import type {
  ChartDataMode,
  ChartDiagnostic,
  ChartDiagnosticCode,
  ChartPercentUnit,
  ChartProps,
  ChartValueFormat,
  ChartValueLocale,
} from "./types";

// ── identity ────────────────────────────────────────────────────────────────

export type ChartSeriesSource = "group" | "field";

/**
 * 시리즈 identity 문자열 — `seriesConfig.key` 의 형식. 원본 그룹 값 `"reset"`·
 * `"series0"`·쉼표·따옴표와 충돌하지 않도록 JSON 배열로 감싼다. 단일 그룹 (color
 * 없음) 은 `["group",""]` 이다.
 */
export function seriesIdentity(source: ChartSeriesSource, key: string): string {
  return JSON.stringify([source, key]);
}

/** `seriesIdentity` 의 역. 형식이 아니면 null (임의 문자열을 그룹 키로 추정하지 않는다). */
export function parseSeriesIdentity(
  id: string,
): { source: ChartSeriesSource; key: string } | null {
  if (typeof id !== "string" || !id.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(id);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      (parsed[0] === "group" || parsed[0] === "field") &&
      typeof parsed[1] === "string"
    ) {
      return { source: parsed[0], key: parsed[1] };
    }
  } catch {
    // 형식 아님
  }
  return null;
}

// ── 팔레트 토큰 ─────────────────────────────────────────────────────────────

/**
 * 팔레트 토큰 이름 접두 — CSS `--chart-series-N` (`CSSGenerator.ts` chart 채널) 과
 * Skia `channel.series[N-1]` 이 같은 배열을 본다. 토큰 N ⇔ 팔레트 인덱스 N-1 은
 * 전단사라 scene 은 인덱스만 싣고 두 consumer 가 각자 해소한다 (P0 inventory).
 */
export const CHART_SERIES_TOKEN_PREFIX = "--chart-series-";

export function seriesTokenName(paletteIndex: number): string {
  return `${CHART_SERIES_TOKEN_PREFIX}${paletteIndex + 1}`;
}

/** 토큰 이름 → 팔레트 인덱스. 형식이 아니거나 팔레트 밖이면 null. */
export function seriesTokenIndex(
  token: unknown,
  paletteLength: number,
): number | null {
  if (
    typeof token !== "string" ||
    !token.startsWith(CHART_SERIES_TOKEN_PREFIX)
  ) {
    return null;
  }
  const digits = token.slice(CHART_SERIES_TOKEN_PREFIX.length);
  if (!/^[1-9]\d*$/.test(digits)) return null;
  const index = Number(digits) - 1;
  return index < Math.max(1, paletteLength) ? index : null;
}

/** UI 후보 — Intl 이 지원하는 코드 중 첫 화면에 보일 것. 검증은 `isSupportedCurrency`. */
export const CHART_CURRENCY_CANDIDATES: readonly string[] = [
  "USD",
  "KRW",
  "EUR",
  "JPY",
  "GBP",
  "CNY",
];

const CHART_VALUE_FORMATS: readonly ChartValueFormat[] = [
  "auto",
  "decimal",
  "currency",
  "percent",
];
const CHART_VALUE_LOCALES: readonly ChartValueLocale[] = ["en-US", "ko-KR"];
const CHART_PERCENT_UNITS: readonly ChartPercentUnit[] = [
  "ratio",
  "percentagePoints",
];
const CHART_DATA_MODES: readonly ChartDataMode[] = ["group", "columns"];

/** ISO 4217 형식 + 런타임 Intl 지원 여부 (지원 목록 API 가 없으면 형식만). */
export function isSupportedCurrency(code: unknown): code is string {
  if (typeof code !== "string" || !/^[A-Za-z]{3}$/.test(code)) return false;
  const intl = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof intl.supportedValuesOf !== "function") return true;
  try {
    return intl.supportedValuesOf("currency").includes(code.toUpperCase());
  } catch {
    return true;
  }
}

// ── 정규화 결과 ─────────────────────────────────────────────────────────────

export interface ResolvedNumberFormat {
  format: ChartValueFormat;
  locale: ChartValueLocale;
  /** 명시 자릿수 (min = max). undefined 면 형식별 기본 (decimal/percent 0–2, currency Intl 기본). */
  fractionDigits?: number;
  currency?: string;
  percentUnit?: ChartPercentUnit;
}

export interface ResolvedSeriesConfig {
  key: string;
  /** 속성 부재 = 기본 이름. 빈 문자열은 명시적 빈 이름. */
  label?: string;
  /** 검증된 팔레트 인덱스 (토큰 N → N-1). 잘못된 토큰은 진단 후 제거. */
  paletteIndex?: number;
}

export interface ResolvedChartPresentation {
  dataMode: ChartDataMode;
  /** 중복 제거 (first-wins) 뒤의 필드 순서. group 모드에서도 휴면 값을 그대로 든다. */
  valueFields: readonly string[];
  /** key 중복 제거 (first-wins) 뒤의 설정. 배열 순서 = 표시 순서. */
  seriesConfig: readonly ResolvedSeriesConfig[];
  numberFormat: ResolvedNumberFormat;
  diagnostics: readonly ChartDiagnostic[];
  /** error 진단이 없는가 — false 면 소비자는 설정 오류 상태를 보여 준다. */
  ok: boolean;
}

const DEFAULT_LOCALE: ChartValueLocale = "en-US";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 저장 props → 정규화된 표시 설정. 원본 `props` 는 읽기만 한다.
 *
 * `paletteLength` 는 rule chart 채널의 `series.length` — colorToken 검증 기준이다.
 * `chartType`/`colorBy` 는 columns 조합 검증 (Pie/Radial·범주색 미지원) 에 쓴다.
 */
export function resolveChartPresentation(
  props: Pick<
    ChartProps,
    | "dataMode"
    | "valueFields"
    | "seriesConfig"
    | "valueFormat"
    | "valueLocale"
    | "valueFractionDigits"
    | "valueCurrency"
    | "valuePercentUnit"
  > &
    Partial<Pick<ChartProps, "chartType" | "colorBy">>,
  paletteLength: number,
): ResolvedChartPresentation {
  const diagnostics: ChartDiagnostic[] = [];
  const error = (
    code: ChartDiagnosticCode,
    message: string,
    value?: string,
  ): void => {
    diagnostics.push({ code, severity: "error", message, value });
  };
  const warning = (
    code: ChartDiagnosticCode,
    message: string,
    value?: string,
  ): void => {
    diagnostics.push({ code, severity: "warning", message, value });
  };

  // ── dataMode ──
  let dataMode: ChartDataMode = "group";
  const rawMode = props.dataMode as unknown;
  if (rawMode !== undefined) {
    if (
      typeof rawMode === "string" &&
      (CHART_DATA_MODES as readonly string[]).includes(rawMode)
    ) {
      dataMode = rawMode as ChartDataMode;
    } else {
      error(
        "dataMode.invalid",
        `dataMode must be group or columns`,
        String(rawMode),
      );
    }
  }

  // ── valueFields ── (형식은 모드와 무관하게 검사, 비어 있음은 columns 에서만 오류)
  const valueFields: string[] = [];
  const rawFields = props.valueFields as unknown;
  if (rawFields !== undefined) {
    if (
      !Array.isArray(rawFields) ||
      rawFields.some((f) => typeof f !== "string")
    ) {
      error(
        "valueFields.invalid",
        "valueFields must be an array of field keys",
      );
    } else {
      for (const field of rawFields as string[]) {
        if (valueFields.includes(field)) {
          warning(
            "valueFields.duplicate",
            `duplicate value field "${field}" — first one is used`,
            field,
          );
          continue;
        }
        valueFields.push(field);
      }
    }
  }
  if (dataMode === "columns") {
    if (
      valueFields.length === 0 &&
      !diagnostics.some((d) => d.code === "valueFields.invalid")
    ) {
      error("valueFields.empty", "columns mode needs at least one value field");
    }
    if (props.chartType === "pie" || props.chartType === "radial") {
      error(
        "columns.unsupportedChartType",
        `columns mode is not supported for ${props.chartType} charts`,
        props.chartType,
      );
    }
    if (props.chartType === "bar" && props.colorBy === "category") {
      error(
        "columns.colorByCategory",
        'columns mode colors by series — colorBy "category" is not supported',
        "category",
      );
    }
  }

  // ── seriesConfig ──
  const seriesConfig: ResolvedSeriesConfig[] = [];
  const rawConfig = props.seriesConfig as unknown;
  if (rawConfig !== undefined) {
    if (!Array.isArray(rawConfig)) {
      error("seriesConfig.invalid", "seriesConfig must be an array");
    } else {
      const seen = new Set<string>();
      for (const entry of rawConfig as unknown[]) {
        if (
          !isRecord(entry) ||
          typeof entry.key !== "string" ||
          parseSeriesIdentity(entry.key) === null ||
          (Object.hasOwn(entry, "label") && typeof entry.label !== "string") ||
          (Object.hasOwn(entry, "colorToken") &&
            typeof entry.colorToken !== "string")
        ) {
          error(
            "seriesConfig.invalid",
            "seriesConfig entry needs a series identity key and string label/colorToken",
          );
          continue;
        }
        if (seen.has(entry.key)) {
          warning(
            "seriesConfig.duplicateKey",
            `duplicate series config "${entry.key}" — first one is used`,
            entry.key,
          );
          continue;
        }
        seen.add(entry.key);
        const resolved: ResolvedSeriesConfig = { key: entry.key };
        if (Object.hasOwn(entry, "label"))
          resolved.label = entry.label as string;
        if (Object.hasOwn(entry, "colorToken")) {
          const index = seriesTokenIndex(entry.colorToken, paletteLength);
          if (index === null) {
            warning(
              "seriesConfig.colorToken.invalid",
              `unknown palette token "${String(entry.colorToken)}" — default color is used`,
              String(entry.colorToken),
            );
          } else {
            resolved.paletteIndex = index;
          }
        }
        seriesConfig.push(resolved);
      }
    }
  }

  // ── number format ──
  let format: ChartValueFormat = "auto";
  const rawFormat = props.valueFormat as unknown;
  if (rawFormat !== undefined) {
    if (
      typeof rawFormat === "string" &&
      (CHART_VALUE_FORMATS as readonly string[]).includes(rawFormat)
    ) {
      format = rawFormat as ChartValueFormat;
    } else {
      error(
        "valueFormat.invalid",
        "valueFormat must be auto, decimal, currency or percent",
        String(rawFormat),
      );
    }
  }
  let locale: ChartValueLocale = DEFAULT_LOCALE;
  const rawLocale = props.valueLocale as unknown;
  if (rawLocale !== undefined) {
    if (
      typeof rawLocale === "string" &&
      (CHART_VALUE_LOCALES as readonly string[]).includes(rawLocale)
    ) {
      locale = rawLocale as ChartValueLocale;
    } else {
      error(
        "valueLocale.invalid",
        "valueLocale must be en-US or ko-KR",
        String(rawLocale),
      );
    }
  }
  let fractionDigits: number | undefined;
  const rawDigits = props.valueFractionDigits as unknown;
  if (rawDigits !== undefined) {
    if (
      typeof rawDigits === "number" &&
      Number.isInteger(rawDigits) &&
      rawDigits >= 0 &&
      rawDigits <= 6
    ) {
      fractionDigits = rawDigits;
    } else {
      error(
        "valueFractionDigits.invalid",
        "valueFractionDigits must be an integer 0–6",
        String(rawDigits),
      );
    }
  }
  let currency: string | undefined;
  const rawCurrency = props.valueCurrency as unknown;
  if (rawCurrency !== undefined) {
    if (isSupportedCurrency(rawCurrency)) {
      currency = rawCurrency.toUpperCase();
    } else {
      // 활성 (format=currency) 이면 설정 오류, 휴면이면 알리기만 한다 — 휴면 값의
      //   형식 오류로 decimal/auto 차트를 막지 않는다 (colorToken.invalid 와 같은 급).
      (format === "currency" ? error : warning)(
        "valueCurrency.unsupported",
        `currency "${String(rawCurrency)}" is not an Intl-supported ISO 4217 code`,
        String(rawCurrency),
      );
    }
  }
  if (format === "currency" && currency === undefined && rawCurrency === undefined) {
    error("valueCurrency.missing", "currency format needs a currency code");
  }
  let percentUnit: ChartPercentUnit | undefined;
  const rawUnit = props.valuePercentUnit as unknown;
  if (rawUnit !== undefined) {
    if (
      typeof rawUnit === "string" &&
      (CHART_PERCENT_UNITS as readonly string[]).includes(rawUnit)
    ) {
      percentUnit = rawUnit as ChartPercentUnit;
    } else {
      (format === "percent" ? error : warning)(
        "valuePercentUnit.invalid",
        "valuePercentUnit must be ratio or percentagePoints",
        String(rawUnit),
      );
    }
  }
  if (format === "percent" && percentUnit === undefined && rawUnit === undefined) {
    error(
      "valuePercentUnit.missing",
      "percent format needs the input unit (ratio or percentagePoints)",
    );
  }

  const numberFormat: ResolvedNumberFormat = { format, locale };
  if (fractionDigits !== undefined)
    numberFormat.fractionDigits = fractionDigits;
  if (currency !== undefined) numberFormat.currency = currency;
  if (percentUnit !== undefined) numberFormat.percentUnit = percentUnit;

  return {
    dataMode,
    valueFields,
    seriesConfig,
    numberFormat,
    diagnostics,
    ok: !diagnostics.some((d) => d.severity === "error"),
  };
}

// ── 표시 문자열 ─────────────────────────────────────────────────────────────

/**
 * 값이 어느 단위인가. `raw` 는 집계값 (축 눈금·값 라벨·tooltip 전부), `normalizedPercent`
 * 는 expand 의 0–100 정규화 축 눈금뿐이다 — 값 라벨·tooltip 은 expand 에서도 raw 다
 * (`marks/bar.ts` 값 라벨, `tooltip.ts`; review round 1 h1).
 */
export type ChartNumberContext = "raw" | "normalizedPercent";

const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const cacheKey = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

function digitsOptions(
  config: ResolvedNumberFormat,
  fallback: {
    minimumFractionDigits: number;
    maximumFractionDigits: number;
  } | null,
): Intl.NumberFormatOptions {
  if (config.fractionDigits !== undefined) {
    return {
      minimumFractionDigits: config.fractionDigits,
      maximumFractionDigits: config.fractionDigits,
    };
  }
  return fallback ?? {};
}

const DEFAULT_DIGITS = { minimumFractionDigits: 0, maximumFractionDigits: 2 };

/**
 * 숫자 → 표시 문자열. 기하·집계를 바꾸지 않는다 (display 만).
 *
 * - `auto`: 두 context 모두 기존 `formatTick` (expand 축에 % 를 소급하지 않는다).
 * - opt-in 형식 + `normalizedPercent`: 항상 퍼센트 (통화·raw percent 단위 무관).
 * - `percent` raw: `ratio` 0.25 → 25%, `percentagePoints` 25 → 25%. 단위가 없으면
 *   추정하지 않고 `formatTick` — 하지만 그 설정은 `resolveChartPresentation` 이
 *   error 로 막으므로 렌더에 도달하지 않는다.
 */
export function formatChartNumber(
  value: number,
  config: ResolvedNumberFormat,
  context: ChartNumberContext,
): string {
  if (!Number.isFinite(value)) return "";
  if (config.format === "auto") return formatTick(value);

  if (context === "normalizedPercent") {
    return numberFormatter(config.locale, {
      style: "percent",
      ...digitsOptions(config, DEFAULT_DIGITS),
    }).format(value / 100);
  }

  switch (config.format) {
    case "decimal":
      return numberFormatter(
        config.locale,
        digitsOptions(config, DEFAULT_DIGITS),
      ).format(value);
    case "currency":
      if (!config.currency) return formatTick(value);
      return numberFormatter(config.locale, {
        style: "currency",
        currency: config.currency,
        ...digitsOptions(config, null),
      }).format(value);
    case "percent": {
      if (!config.percentUnit) return formatTick(value);
      const ratio = config.percentUnit === "ratio" ? value : value / 100;
      return numberFormatter(config.locale, {
        style: "percent",
        ...digitsOptions(config, DEFAULT_DIGITS),
      }).format(ratio);
    }
    default:
      return formatTick(value);
  }
}

/** `auto` — 기존 문자열 경로. 새 설정이 전혀 없을 때 `resolveChartPresentation` 과 같은 결과다. */
export const CHART_AUTO_NUMBER_FORMAT: ResolvedNumberFormat = {
  format: "auto",
  locale: DEFAULT_LOCALE,
};
