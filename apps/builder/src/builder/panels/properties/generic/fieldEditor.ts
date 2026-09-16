/**
 * 필드 → 컨트롤 (에디터) 매핑 — Properties 패널 컨트롤 어법 (2026-09-15 사용자 판정).
 *
 * 기준은 옵션 수·글자 폭 (컴포넌트마다 갈렸다) 도 「전부 셀렉트」 도 아닌 **필드의 의미** 다 —
 * 같은 키는 어느 컴포넌트에서든 같은 컨트롤. 표는 builder 측에 둔다 (catalog `PropContract` 의
 * kind·값은 무변경 — D2 경계). 시안: docs/design/properties-panel-inventory (Proposal 페이지).
 *
 * - boolean 전부 → 칩 그룹 (섹션당 하나 · legend Options / Show / Fill · 부정형은 긍정 반전)
 * - On/Off enum (autoCorrect · spellCheck) → 칩
 * - 방향 · 정렬 · 모양 enum → 아이콘 seg / placement → 9-위치 피커
 * - 배타 2~4 짧은 값 enum · fillStyle · 이진 variant → 텍스트 seg (2~3 반폭 · 4 전폭)
 * - size → seg, 최대 5단 (초과 단계는 Styles 패널 font-size 로) · 2~3 반폭 · 4~5 전폭
 * - 의미색 variant ≤4 → seg + 색 점 · 5+ → 셀렉트 + 색 점 · staticColor → 스와치 seg
 * - 상한 있는 number → 슬라이더 (표의 범위) · 상한 없는 number → 스텝퍼 (NumberField)
 * - 5+ · 긴 라벨 · 도메인 enum → 셀렉트 유지
 */
import type { ResolvedField } from "@composition/shared";
import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChartColumnBig,
  ChartColumnStacked,
  ChartLine,
  ChartSpline,
  Circle,
  LayoutGrid,
  MoveHorizontal,
  MoveVertical,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Pentagon,
  Percent,
  Rows3,
  StepForward,
  LayoutDashboard,
} from "lucide-react";

/** 칩 그룹 이름 — 섹션 안에서 같은 이름끼리 한 ToggleButtonGroup. */
export type ChipGroup = "Options" | "Show" | "Fill";

export type FieldEditor =
  /**
   * `grid` — 팝오버가 목록이 아니라 6열 스와치 격자 (Theme 패널 tint-grid 어법). 옵션의 절반
   * 이상이 Spectrum 색 이름인 variant (Badge 25 · StatusLight 19) — 값이 곧 색이라 이름 목록을
   * 읽는 것보다 색을 보고 고르는 게 빠르다 (2026-09-16 사용자 판정 「A 팝오버 grid」). 트리거는
   * 셀렉트 그대로 (색 점 + 이름). 의미 variant (Button primary/secondary …) 는 이름이 정보라
   * 목록 유지. 격자 안 순서는 의미색 → 색 이름 (`gridSections`).
   */
  | { type: "select"; swatch?: boolean; grid?: boolean }
  | {
      type: "seg";
      span: "half" | "wide";
      icons?: Readonly<Record<string, LucideIcon>>;
      swatch?: boolean;
    }
  | { type: "swatch-seg" }
  | { type: "placement" }
  | { type: "slider"; min: number; max: number; step: number; unit?: string }
  /**
   * 형제 prop 에 묶인 값 — Slider/Meter/ProgressBar 의 `value` 는 minValue~maxValue 안에 있다.
   * 슬라이더 양끝이 곧 min/max (형제가 없으면 0~100), 눈금은 `step` 형제.
   */
  | { type: "slider-bound"; minKey: string; maxKey: string; stepKey: string }
  | { type: "stepper" }
  | {
      type: "chip";
      group: ChipGroup;
      /** 칩 글자 (「Show Axis」 → 「Axis」 · 「Hide Time Zone」 → 「Time Zone」). */
      label: string;
      /** 저장값이 칩 켜짐과 반대 (hideTimeZone: 켜짐 = 보임 = false 저장). */
      negate?: boolean;
      /** enum 을 칩으로 — 켜짐/꺼짐에 쓸 값 (autoCorrect "on"/"off"). 없으면 boolean. */
      onValue?: string;
      offValue?: string;
    }
  | { type: "input" }
  | { type: "icon" }
  | { type: "binding" }
  | { type: "items-manager" };

/** size seg 상한 — 초과 단계 (Text 의 2XL · 3XL) 는 Styles 패널 font-size 로 편집한다. */
export const SIZE_MAX_STEPS = 5;

/** 아이콘 seg — 키별 옵션값 → 글리프. 여기 없는 enum 은 글자 seg 또는 셀렉트. */
const ICON_SEG: Readonly<Record<string, Readonly<Record<string, LucideIcon>>>> =
  {
    orientation: { horizontal: MoveHorizontal, vertical: MoveVertical },
    labelAlign: { start: AlignLeft, center: AlignCenter, end: AlignRight },
    align: { start: AlignLeft, center: AlignCenter, end: AlignRight },
    labelPosition: { top: PanelTop, side: PanelLeft },
    legendPosition: {
      top: PanelTop,
      bottom: PanelBottom,
      left: PanelLeft,
      right: PanelRight,
    },
    stackType: {
      dodged: ChartColumnBig,
      stacked: ChartColumnStacked,
      expand: Percent,
    },
    curve: { linear: ChartLine, monotone: ChartSpline, step: StepForward },
    gridType: { polygon: Pentagon, circle: Circle },
    layout: { grid: LayoutGrid, waterfall: LayoutDashboard, stack: Rows3 },
  };

/**
 * 의미색 variant — 값 → 색 토큰 (패널 점 · 셀렉트 항목 점). 값이 곧 색인 variant 만 (Meter ·
 * InlineAlert · Toast · Tooltip · StatusLight · Badge …). 여기 없는 값은 점 없이 글자만.
 */
export const VARIANT_SWATCH: Readonly<Record<string, string>> = {
  // 상태색 (builder-system.css)
  informative: "var(--informative)",
  info: "var(--informative)",
  positive: "var(--positive)",
  warning: "var(--notice)",
  notice: "var(--notice)",
  critical: "var(--negative)",
  negative: "var(--negative)",
  neutral: "var(--fg-muted)",
  accent: "var(--accent)",
  primary: "var(--fg)",
  secondary: "var(--fg-muted)",
  premium: "var(--hue-purple)",
  genai: "var(--hue-indigo)",
  // Spectrum 색 이름 — Badge · StatusLight 규칙이 쓰는 `--hue-*` (generated/semantic-palette.css)
  gray: "var(--hue-gray)",
  red: "var(--hue-red)",
  orange: "var(--hue-orange)",
  yellow: "var(--hue-yellow)",
  green: "var(--hue-green)",
  blue: "var(--hue-blue)",
  purple: "var(--hue-purple)",
  indigo: "var(--hue-indigo)",
  cyan: "var(--hue-cyan)",
  pink: "var(--hue-pink)",
  turquoise: "var(--hue-turquoise)",
  fuchsia: "var(--hue-fuchsia)",
  magenta: "var(--hue-magenta)",
  chartreuse: "var(--hue-chartreuse)",
  celery: "var(--hue-celery)",
  seafoam: "var(--hue-seafoam)",
  brown: "var(--hue-brown)",
  cinnamon: "var(--hue-cinnamon)",
  silver: "var(--hue-silver)",
};

/** Spectrum 색 이름 — `VARIANT_SWATCH` 의 `--hue-*` 항목 중 의미 별칭 (premium · genai) 을 뺀 것. */
export const HUE_VARIANT_NAMES: ReadonlySet<string> = new Set([
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "indigo",
  "cyan",
  "pink",
  "turquoise",
  "fuchsia",
  "magenta",
  "chartreuse",
  "celery",
  "seafoam",
  "brown",
  "cinnamon",
  "silver",
]);

/**
 * 격자 셀렉트의 구획 — 의미색 (accent · informative …) 먼저, 구분선, 색 이름. 빈 구획은 뺀다.
 * 옵션 순서는 각 구획 안에서 계약 순서 그대로.
 */
export function variantGridSections(
  options: ReadonlyArray<{ value: string }>,
): readonly (readonly string[])[] {
  const semantic = options
    .filter((o) => !HUE_VARIANT_NAMES.has(o.value))
    .map((o) => o.value);
  const hue = options
    .filter((o) => HUE_VARIANT_NAMES.has(o.value))
    .map((o) => o.value);
  return [semantic, hue].filter((group) => group.length > 0);
}

/** 상한 있는 number — 슬라이더 범위. 계약의 min/max 가 있으면 그것이 우선. */
const SLIDER_RANGE: Readonly<
  Record<string, { min: number; max: number; step: number; unit?: string }>
> = {
  strokeWidth: { min: 0.5, max: 4, step: 0.5 },
  columns: { min: 1, max: 12, step: 1 },
  innerRadius: { min: 0, max: 100, step: 1, unit: "%" },
  startAngle: { min: 0, max: 360, step: 1, unit: "°" },
  endAngle: { min: 0, max: 360, step: 1, unit: "°" },
  gridRings: { min: 0, max: 10, step: 1 },
  maxVisibleMonths: { min: 1, max: 3, step: 1 },
  animationBegin: { min: 0, max: 3000, step: 50, unit: "ms" },
  animationDuration: { min: 0, max: 3000, step: 50, unit: "ms" },
  timeout: { min: 0, max: 20000, step: 500, unit: "ms" },
  gap: { min: 0, max: 64, step: 1, unit: "px" },
};

/** 부정형 boolean — 칩은 긍정형 (켜짐 = 보임). */
const NEGATED: ReadonlySet<string> = new Set(["hideTimeZone", "hideArrow"]);

/** On/Off 값 enum — 칩으로. */
const ON_OFF: ReadonlySet<string> = new Set(["autoCorrect", "spellCheck"]);

/** 반폭 seg 에 들어가는 라벨 상한 — 86.5 열 / 옵션 수 (padding 4 + gap 4 제외). */
function fitsHalfSeg(labels: readonly string[]): boolean {
  const cell = (86.5 - 8 - (labels.length - 1) * 4) / labels.length;
  return labels.every((label) => textWidth(label) + 8 <= cell);
}
/** 전폭 seg (181) 에 들어가는가. */
function fitsWideSeg(labels: readonly string[]): boolean {
  const cell = (181 - 8 - (labels.length - 1) * 4) / labels.length;
  return labels.every((label) => textWidth(label) + 8 <= cell);
}
/** 글자 폭 근사 (seg 글꼴 11px Pretendard) — jsdom 과 브라우저가 같은 답을 내도록 표로 잰다. */
function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/[A-Z]/.test(ch)) w += 6.9;
    else if (/[ilfjt.' ]/.test(ch)) w += 3.0;
    else if (/[0-9]/.test(ch)) w += 5.8;
    else w += 5.7;
  }
  return w;
}

function chipLabel(key: string, label: string): string {
  if (NEGATED.has(key)) return label.replace(/^Hide\s+/, "");
  return label.replace(/^(Show|Fill|Is|Should)\s+/, "");
}
function chipGroup(key: string, label: string): ChipGroup {
  if (NEGATED.has(key)) return "Show";
  if (/^show/.test(key) || /^Show\s/.test(label)) return "Show";
  if (/^fill/.test(key) || /^Fill\s/.test(label)) return "Fill";
  return "Options";
}

function isBinaryVariant(field: ResolvedField): boolean {
  return field.kind === "variant" && (field.options?.length ?? 0) === 2;
}
/** 옵션의 절반 이상이 Spectrum 색 이름 — 값이 곧 색인 variant (Badge · StatusLight). */
function isHueGridVariant(field: ResolvedField): boolean {
  const options = field.options ?? [];
  if (field.kind !== "variant" || options.length < 5) return false;
  const hues = options.filter((o) => HUE_VARIANT_NAMES.has(o.value)).length;
  return hues * 2 >= options.length;
}
function isSemanticColorVariant(field: ResolvedField): boolean {
  const options = field.options ?? [];
  if (field.kind !== "variant" || options.length < 3) return false;
  const colored = options.filter((o) => VARIANT_SWATCH[o.value] != null).length;
  return colored >= options.length - 1;
}

export function resolveFieldEditor(field: ResolvedField): FieldEditor {
  const options = field.options ?? [];
  const labels = options.map((o) => o.label);
  switch (field.kind) {
    case "boolean":
      return {
        type: "chip",
        group: chipGroup(field.key, field.label),
        label: chipLabel(field.key, field.label),
        negate: NEGATED.has(field.key) || undefined,
      };
    case "size": {
      const n = Math.min(options.length, SIZE_MAX_STEPS);
      return { type: "seg", span: n <= 3 ? "half" : "wide" };
    }
    case "fillStyle":
      return { type: "seg", span: fitsHalfSeg(labels) ? "half" : "wide" };
    case "variant": {
      if (isBinaryVariant(field))
        return { type: "seg", span: fitsHalfSeg(labels) ? "half" : "wide" };
      if (isHueGridVariant(field))
        return { type: "select", swatch: true, grid: true };
      if (isSemanticColorVariant(field)) {
        return options.length <= 4
          ? { type: "seg", span: "wide", swatch: true }
          : { type: "select", swatch: true };
      }
      if (options.length <= 4 && fitsWideSeg(labels))
        return { type: "seg", span: fitsHalfSeg(labels) ? "half" : "wide" };
      return {
        type: "select",
        swatch: options.some((o) => VARIANT_SWATCH[o.value] != null),
      };
    }
    case "enum": {
      if (ON_OFF.has(field.key)) {
        return {
          type: "chip",
          group: "Options",
          label: field.label,
          onValue: "on",
          offValue: "off",
        };
      }
      if (field.key === "placement") return { type: "placement" };
      if (field.key === "staticColor") return { type: "swatch-seg" };
      const icons = ICON_SEG[field.key];
      if (icons && options.every((o) => icons[o.value] != null)) {
        return {
          type: "seg",
          span: options.length <= 4 ? "half" : "wide",
          icons,
        };
      }
      if (options.length >= 2 && options.length <= 4 && fitsWideSeg(labels)) {
        return { type: "seg", span: fitsHalfSeg(labels) ? "half" : "wide" };
      }
      return { type: "select" };
    }
    case "number": {
      if (field.key === "value")
        return {
          type: "slider-bound",
          minKey: "minValue",
          maxKey: "maxValue",
          stepKey: "step",
        };
      const range = SLIDER_RANGE[field.key];
      if (range) {
        return {
          type: "slider",
          min: field.min ?? range.min,
          max: field.max ?? range.max,
          step: field.step ?? range.step,
          unit: range.unit,
        };
      }
      if (field.min != null && field.max != null) {
        return {
          type: "slider",
          min: field.min,
          max: field.max,
          step: field.step ?? 1,
        };
      }
      return { type: "stepper" };
    }
    case "icon":
      return { type: "icon" };
    case "binding":
      return { type: "binding" };
    case "items-manager":
      return { type: "items-manager" };
    default:
      return { type: "input" };
  }
}

/** size 옵션을 상한 (5) 까지 자른다 — 순서 척도의 앞 5단. */
export function sizeSegOptions<T extends { value: string; label: string }>(
  options: readonly T[],
): T[] {
  return options.slice(0, SIZE_MAX_STEPS);
}
