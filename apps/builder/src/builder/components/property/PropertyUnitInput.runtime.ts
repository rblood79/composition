import React from "react";
import { cssVarToTokenRef, resolveToken } from "@composition/rendering";

import type { PropertyUnitPreset } from "./propertyUnitPresets";

export interface SizeInputControl {
  kind: "css" | "fill" | "fit" | "ratio";
  fraction?: boolean;
  computed?: number;
  description?: string;
  disabledModes?: string[];
  onModeChange: (unit: string) => void;
}

export interface PropertyUnitInputProps {
  /** ADR-224: Size 절만 사용하는 한 상자 semantic 입력. */
  sizeControl?: SizeInputControl;
  label?: string;
  value: string; // "100px", "50%", "auto"
  onChange: (value: string) => void;
  /** RAF 스로틀 업데이트 (화살표 키 반복 입력용) */
  onDrag?: (value: string) => void;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
  units?: string[];
  defaultUnit?: string;
  allowKeywords?: boolean;
  /**
   * 빈 optional 값에서 단위만 선택했을 때 0을 커밋하지 않고,
   * 숫자가 입력될 때까지 선택 단위를 로컬 draft로 유지한다.
   */
  preserveEmptyValueOnUnitChange?: boolean;
  /** 빈 입력을 inline style 제거로 커밋한다. */
  allowEmptyReset?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  /** 우측 chevron 목록에서 현재 숫자값을 교체하는 preset 명령. */
  presets?: readonly PropertyUnitPreset[];
  /** preset trigger의 접근성 이름. */
  presetAriaLabel?: string;
  /**
   * "suffix" — legend·아이콘 없이 라벨을 필드 안 우측 suffix (10 mono caps) 로 둔다.
   * 라벨 행 18 이 없어져 행 하나가 28 (panel-ui 01, 2026-09-14). 86px 열이므로 짧은 토큰
   * (W · H · MIN W) 만 — 긴 이름은 열 2개짜리 필드에서. 접근 이름은 input aria-label.
   * "icon" — legend 없이 `icon` 글리프가 라벨 (Border 코너 「◜ 8 PX」, panel-ui 02) + 단위 suffix
   * 트리거 (unitSuffix 와 같은 조각). 접근 이름은 label.
   */
  labelMode?: "legend" | "suffix" | "icon";
  /** suffix 모드의 표시 글자 (기본 label). 접근 이름은 언제나 label — "Width" 를 "W" 로 보일 때 */
  suffixLabel?: string;
  /**
   * legend 모드에서 ▾ 상자 대신 현재 단위를 suffix 트리거로 (「8 PX」 — panel-ui 01 Gap ·
   * 20 Settings). preset 이 있으면 무시 (preset 은 ▾ 메뉴 그대로).
   */
  unitSuffix?: boolean;
}

export const DEFAULT_UNITS = ["px", "%", "rem", "em", "vh", "vw", "reset"];

export const KEYWORDS = [
  "reset",
  "auto",
  "inherit",
  "initial",
  "unset",
  "normal",
  "fit-content",
  "min-content",
  "max-content", // CSS intrinsic sizing
  "fill",
];

/**
 * `units` 에 실렸을 때만 typed 입력을 받는 키워드 — "fill" 은 CSS 값이 아니라 Size 절의
 * Fill 모드 명령 (panel-ui 01 「fit W」: Hug · Fill 이 단위 메뉴 안에 산다). 다른 필드에
 * "fill" 을 쳐도 commit 되지 않는다.
 */
export const UNIT_GATED_KEYWORDS = ["fill"];

/** input 표시용 축약 label (드롭다운 목록은 원본 유지) */
const INPUT_DISPLAY_LABELS: Record<string, string> = {
  "fit-content": "fit",
};

/** 축약 label → 원본 keyword 역매핑 (input 입력값 복원용) */
export const INPUT_LABEL_TO_KEYWORD: Record<string, string> = {
  fit: "fit-content",
};

export function parseUnitValue(value: string): {
  numericValue: number | null;
  unit: string;
} {
  const trimmed = value.trim();

  if (KEYWORDS.includes(trimmed)) {
    return { numericValue: null, unit: trimmed };
  }

  // CSS custom property references are valid style values but are not numeric
  // units. Preserve them so preset selection and the input can reflect the
  // active token instead of falling back to 0px.
  if (/^var\(--[a-z0-9-]+\)$/i.test(trimmed)) {
    return { numericValue: null, unit: trimmed };
  }

  // ⭐ Shorthand 값 처리: "8px 12px" → 첫 번째 값 "8px" 사용
  // padding, margin 등의 shorthand CSS 속성이 여러 값을 가질 때 첫 번째 값을 파싱
  const firstValue = trimmed.split(/\s+/)[0];

  const match = firstValue.match(/^(-?\d+\.?\d*)([a-z%]+)?$/i);
  if (match) {
    const numericValue = parseFloat(match[1]);
    const unit = match[2] || "";
    return { numericValue, unit };
  }

  return { numericValue: 0, unit: "px" };
}

/**
 * resolver 가 Preview · Publish root 에 싣는 범주 (radius · typography · border) 의 토큰만 — 그 값이
 * 빌더 root 의 chrome 값과 다르다. spacing 은 테마 밖이라 두 root 가 같은 `shared-tokens.css` 를 읽는다
 * (그리고 Skia `spacing` 맵은 CSS 와 md 이상이 달라 쓰지 않는다 — ADR-295 §6.0).
 */
export function themedTokenRef(cssVar: string) {
  const ref = cssVarToTokenRef(cssVar);
  return ref && /^\{(radius|typography|border)\./.test(ref) ? ref : null;
}

function getCssVariableValue(value: string): string | undefined {
  const match = value.trim().match(/^var\((--[a-z0-9-]+)\)$/i);
  if (!match) return undefined;
  // ADR-295 Decision 5: 토큰 preset (`var(--radius-md)` …) 의 표시 · commit 값은 활성 테마의 해석값
  //   (`resolveToken` — 설치된 snapshot 맵) 이다. 빌더 문서 root 의 computed value 는 chrome 의 정적 값
  //   (`shared-tokens.css`) 이라 사용자 컴포넌트 값과 다르다.
  const tokenRef = themedTokenRef(match[0]);
  if (tokenRef) {
    const token = resolveToken(tokenRef);
    if (typeof token === "number" && Number.isFinite(token)) return `${token}px`;
  }
  if (typeof document === "undefined") return undefined;

  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();
  return resolved || undefined;
}

function formatPixelValue(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(4))}px`;
}

function toPixelValue(value: string): string {
  const trimmed = value.trim();
  const remMatch = trimmed.match(/^(-?\d*\.?\d+)rem$/i);
  if (!remMatch) return trimmed;

  const rootFontSize =
    typeof document !== "undefined"
      ? parseFloat(getComputedStyle(document.documentElement).fontSize)
      : NaN;
  const baseFontSize = Number.isFinite(rootFontSize) ? rootFontSize : 16;
  return formatPixelValue(Number(remMatch[1]) * baseFontSize);
}

export function getPresetDisplayValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const resolvedValue = getCssVariableValue(trimmed) ?? trimmed;
  const resolved = toPixelValue(resolvedValue);
  const resolvedParsed = parseUnitValue(resolved);
  if (resolvedParsed.numericValue !== null) {
    return String(resolvedParsed.numericValue);
  }

  const parsed = parseUnitValue(trimmed);
  return parsed.numericValue !== null
    ? parsed.unit
      ? `${parsed.numericValue}${parsed.unit}`
      : String(parsed.numericValue)
    : trimmed;
}

export function findMatchingPreset(
  inputValue: string,
  presets?: PropertyUnitInputProps["presets"],
) {
  const trimmedInputValue = inputValue.trim();

  return presets?.find((preset) => {
    const presetValue = preset.value.trim();
    const presetDisplayValue = getPresetDisplayValue(preset.value);
    return (
      presetValue === trimmedInputValue ||
      presetDisplayValue === trimmedInputValue
    );
  });
}

export function getPresetCommitValue(preset: {
  id: string;
  label: string;
  value: string;
}): string {
  const trimmed = preset.value.trim();
  if (trimmed === "") return "";

  const resolved = getCssVariableValue(trimmed);
  return resolved ? toPixelValue(resolved) : preset.value;
}

export function presetsUseCssUnits(
  presets?: PropertyUnitInputProps["presets"],
): boolean {
  return Boolean(
    presets?.some((preset) => {
      const value = preset.value.trim();
      return value !== "" && parseUnitValue(value).unit !== "";
    }),
  );
}

export function getInputDisplayValue(
  value: string,
  parsed: ReturnType<typeof parseUnitValue>,
  isPreservedEmptyValue: boolean,
  presets?: PropertyUnitInputProps["presets"],
): string {
  const trimmed = value.trim();
  const hasResetPreset = presets?.some((preset) => preset.value.trim() === "");

  if (isPreservedEmptyValue || (hasResetPreset && trimmed === "")) {
    return "";
  }

  const matchingPreset = presets?.find(
    (preset) =>
      preset.value.trim() === trimmed ||
      getPresetDisplayValue(preset.value) === trimmed,
  );
  if (matchingPreset) {
    return getPresetDisplayValue(matchingPreset.value);
  }

  return parsed.numericValue !== null
    ? String(parsed.numericValue)
    : (INPUT_DISPLAY_LABELS[parsed.unit] ?? parsed.unit);
}

/** 값 비교 memo 는 그대로, 호출은 최신 콜백으로 (`withLatestCallbacks`). */
