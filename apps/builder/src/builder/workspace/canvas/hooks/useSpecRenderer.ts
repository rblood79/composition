/**
 * useSpecRenderer - Spec 기반 렌더링 공유 유틸리티
 *
 * Legacy cssVariableReader에서 @composition/specs 기반으로 전환하기 위한
 * Feature Flag 및 헬퍼 함수 제공
 *
 * @since 2026-02-12 Spec Migration Phase 0
 */

import {
  getVariantColors as getSpecVariantColors,
  getSizePreset as getSpecSizePreset,
  resolveColor,
  hexStringToNumber,
} from "@composition/specs";
import type { TokenRef } from "@composition/specs";

// ADR-912 단계5 — useSpecVariantColors / useSpecSizePreset hook + SpecVariantColors /
//   SpecSizePreset 인터페이스는 orphan(호출처 0)이라 제거. getSpecVariantColors /
//   getSpecSizePreset(=getVariantColors / getSizePreset)은 하단 re-export 로 유지
//   (rule-파생 shape 어댑트 소비, 영구 엔진).

// ============================================
// Utilities
// ============================================

/**
 * TokenRef Record를 hex number Record로 resolve
 *
 * 컴포넌트별 추가 색상 상수를 resolve할 때 사용
 * 예: TEXT_FIELD_EXTRA_COLORS -> { placeholderColor: 0x49454f, ... }
 */
export function resolveColorRecord<T extends Record<string, TokenRef>>(
  record: T,
  theme: "light" | "dark" = "light",
): Record<keyof T, number> {
  const result = {} as Record<keyof T, number>;
  for (const key of Object.keys(record) as Array<keyof T>) {
    const resolved = resolveColor(record[key], theme);
    result[key] =
      typeof resolved === "string"
        ? hexStringToNumber(resolved)
        : (resolved as number);
  }
  return result;
}

/**
 * 단일 TokenRef를 hex number로 resolve
 */
export function resolveTokenColor(
  tokenRef: TokenRef,
  theme: "light" | "dark" = "light",
): number {
  const resolved = resolveColor(tokenRef, theme);
  return typeof resolved === "string"
    ? hexStringToNumber(resolved)
    : (resolved as number);
}

// ============================================
// Label & Description Style Presets
// ============================================

export interface LabelStylePreset {
  fontSize: number;
  fontWeight: string;
  color: number;
  fontFamily: string;
}

export interface DescriptionStylePreset {
  fontSize: number;
  color: number;
  errorColor: number;
  fontFamily: string;
}

const LABEL_STYLE_PRESETS: Record<string, LabelStylePreset> = {
  sm: {
    fontSize: 12,
    fontWeight: "500",
    color: 0x374151,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  md: {
    fontSize: 14,
    fontWeight: "500",
    color: 0x374151,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  lg: {
    fontSize: 16,
    fontWeight: "500",
    color: 0x374151,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

const DESCRIPTION_STYLE_PRESETS: Record<string, DescriptionStylePreset> = {
  sm: {
    fontSize: 11,
    color: 0x6b7280,
    errorColor: 0xef4444,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  md: {
    fontSize: 12,
    color: 0x6b7280,
    errorColor: 0xef4444,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  lg: {
    fontSize: 14,
    color: 0x6b7280,
    errorColor: 0xef4444,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export function getLabelStylePreset(size: string): LabelStylePreset {
  return LABEL_STYLE_PRESETS[size] ?? LABEL_STYLE_PRESETS.md;
}

export function getDescriptionStylePreset(
  size: string,
): DescriptionStylePreset {
  return DESCRIPTION_STYLE_PRESETS[size] ?? DESCRIPTION_STYLE_PRESETS.md;
}

// Re-export for convenience
export { getSpecVariantColors, getSpecSizePreset };
